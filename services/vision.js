const vision = require('@google-cloud/vision');
const { Storage } = require('@google-cloud/storage');

class VisionService {
  constructor() {
    this.client = new vision.ImageAnnotatorClient();
    this.storage = new Storage();
    this.bucketName = `${process.env.PROJECT_ID}-receipts`;
  }

  /**
   * Extract text from receipt image using Cloud Vision API
   */
  async extractText(imageBuffer) {
    try {
      const [result] = await this.client.textDetection({
        image: { content: imageBuffer }
      });
      
      const detections = result.textAnnotations;
      const fullText = detections.length > 0 ? detections[0].description : '';
      
      return {
        fullText,
        blocks: detections.slice(1), // Individual text blocks
        success: true
      };
    } catch (error) {
      console.error('Vision API error:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  /**
   * Parse receipt data from extracted text
   */
  parseReceiptData(textResult) {
    const { fullText } = textResult;
    const lines = fullText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Extract basic information
    const receiptData = {
      vendor: this.extractVendor(lines),
      date: this.extractDate(lines),
      total: this.extractTotal(lines),
      items: this.extractItems(lines),
      category: this.categorizeExpense(lines),
      confidence: 0.85, // Base confidence score
      rawText: fullText
    };

    return receiptData;
  }

  /**
   * Extract vendor name from receipt lines
   */
  extractVendor(lines) {
    // Look for vendor in first few lines
    const vendorPatterns = [
      /^[A-Z\s&]+$/,  // All caps company names
      /S\.?L\.?/i,     // Spanish company suffixes
      /S\.?A\.?/i,
      /LTDA/i
    ];

    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (line.length > 3 && line.length < 50) {
        for (const pattern of vendorPatterns) {
          if (pattern.test(line)) {
            return line;
          }
        }
      }
    }

    // Fallback: return first substantial line
    return lines.find(line => line.length > 3 && line.length < 50) || 'Comercio desconocido';
  }

  /**
   * Extract date from receipt lines
   */
  extractDate(lines) {
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,  // DD/MM/YYYY or DD-MM-YYYY
      /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/,          // DD.MM.YYYY
      /(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})/   // YYYY/MM/DD
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          // Convert to ISO date format
          const [, day, month, year] = match;
          const fullYear = year.length === 2 ? `20${year}` : year;
          const date = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
          
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      }
    }

    // Fallback to current date
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Extract total amount from receipt lines
   */
  extractTotal(lines) {
    const totalPatterns = [
      /TOTAL[:\s]*([0-9]+[,.]?[0-9]*)/i,
      /SUMA[:\s]*([0-9]+[,.]?[0-9]*)/i,
      /IMPORTE[:\s]*([0-9]+[,.]?[0-9]*)/i,
      /([0-9]+[,.]?[0-9]*)\s*€/,
      /€\s*([0-9]+[,.]?[0-9]*)/,
      /([0-9]+[,.]?[0-9]*)\s*EUR/i
    ];

    // Look for total in reverse (bottom up)
    const reversedLines = [...lines].reverse();
    
    for (const line of reversedLines) {
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          const amount = match[1].replace(',', '.');
          const total = parseFloat(amount);
          if (!isNaN(total) && total > 0) {
            return total;
          }
        }
      }
    }

    // Fallback: look for any number with currency
    for (const line of reversedLines) {
      const amounts = line.match(/([0-9]+[,.]?[0-9]*)/g);
      if (amounts) {
        for (const amount of amounts.reverse()) {
          const value = parseFloat(amount.replace(',', '.'));
          if (!isNaN(value) && value > 0) {
            return value;
          }
        }
      }
    }

    return 0;
  }

  /**
   * Extract individual items from receipt
   */
  extractItems(lines) {
    const items = [];
    const itemPatterns = [
      /(.+?)\s+([0-9]+[,.]?[0-9]*)\s*€?$/,  // Item name + price
      /(.+?)\s+([0-9]+[,.]?[0-9]*)\s*EUR$/i,
      /([0-9]+[,.]?[0-9]*)\s*€?\s+(.+)$/    // Price + item name
    ];

    for (const line of lines) {
      // Skip obvious header/footer lines
      if (this.isHeaderOrFooter(line)) continue;

      for (const pattern of itemPatterns) {
        const match = line.match(pattern);
        if (match) {
          let name, price;
          
          if (pattern.source.includes('(.+?).*([0-9]')) {
            [, name, price] = match;
          } else {
            [, price, name] = match;
          }

          const itemPrice = parseFloat(price.replace(',', '.'));
          
          if (!isNaN(itemPrice) && itemPrice > 0 && name.trim().length > 1) {
            items.push({
              name: name.trim(),
              price: itemPrice,
              quantity: 1
            });
          }
        }
      }
    }

    return items.slice(0, 20); // Limit to 20 items max
  }

  /**
   * Check if line is header or footer information
   */
  isHeaderOrFooter(line) {
    const skipPatterns = [
      /total/i,
      /suma/i,
      /iva/i,
      /fecha/i,
      /date/i,
      /gracias/i,
      /thank/i,
      /tel[eé]fono/i,
      /phone/i,
      /dirección/i,
      /address/i,
      /www\./i,
      /@/,
      /n[úu]mero/i,
      /ticket/i,
      /factura/i,
      /invoice/i
    ];

    return skipPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Categorize expense based on vendor and items
   */
  categorizeExpense(lines) {
    const fullText = lines.join(' ').toLowerCase();
    
    const categories = {
      'Alimentación': ['supermercado', 'mercado', 'carrefour', 'mercadona', 'lidl', 'aldi', 'dia', 'eroski', 'alcampo', 'hipercor', 'el corte inglés', 'panadería', 'charcutería', 'frutería'],
      'Transporte': ['gasolinera', 'shell', 'repsol', 'cepsa', 'bp', 'galp', 'taxi', 'uber', 'cabify', 'metro', 'bus', 'tren', 'parking', 'aparcamiento'],
      'Restaurantes': ['restaurante', 'bar', 'café', 'cafetería', 'pizzería', 'hamburguesa', 'mcdonald', 'burger', 'kfc', 'telepizza', 'dominos'],
      'Farmacia': ['farmacia', 'parafarmacia', 'medicina', 'medicamento'],
      'Ropa': ['zara', 'h&m', 'mango', 'primark', 'decathlon', 'nike', 'adidas', 'el corte inglés', 'moda'],
      'Hogar': ['ikea', 'leroy merlin', 'bricomart', 'aki', 'ferretería', 'electrodomésticos', 'mediamarkt', 'carrefour'],
      'Entretenimiento': ['cine', 'teatro', 'concierto', 'spotify', 'netflix', 'amazon prime', 'juego'],
      'Servicios': ['electricidad', 'agua', 'gas', 'telefono', 'internet', 'seguro', 'banco']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => fullText.includes(keyword))) {
        return category;
      }
    }

    return 'Otros';
  }

  /**
   * Save receipt image to Cloud Storage
   */
  async saveReceiptImage(imageBuffer, fileName) {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(`receipts/${Date.now()}-${fileName}`);
      
      await file.save(imageBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          cacheControl: 'public, max-age=31536000'
        }
      });

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
      });

      return {
        fileName: file.name,
        url,
        bucket: this.bucketName
      };
    } catch (error) {
      console.error('Storage error:', error);
      throw new Error('Failed to save receipt image');
    }
  }

  /**
   * Initialize storage bucket if it doesn't exist
   */
  async initializeBucket() {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        await bucket.create({
          location: 'US-CENTRAL1',
          storageClass: 'STANDARD'
        });
        console.log(`Bucket ${this.bucketName} created`);
      }
    } catch (error) {
      console.error('Bucket initialization error:', error);
    }
  }
}

module.exports = VisionService;