const VisionService = require('../../services/vision');

describe('VisionService', () => {
  let visionService;

  beforeEach(() => {
    visionService = new VisionService();
  });

  describe('extractText', () => {
    it('should extract text from image buffer', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      
      const result = await visionService.extractText(mockBuffer);
      
      expect(result).toHaveProperty('fullText');
      expect(result).toHaveProperty('blocks');
      expect(result).toHaveProperty('success', true);
      expect(result.fullText).toContain('SUPERMERCADO TEST');
    });

    it('should handle vision API errors', async () => {
      // Mock error
      const mockClient = require('@google-cloud/vision').ImageAnnotatorClient;
      mockClient.prototype.textDetection = jest.fn().mockRejectedValue(
        new Error('Vision API Error')
      );

      const mockBuffer = Buffer.from('fake-image-data');
      
      await expect(visionService.extractText(mockBuffer))
        .rejects.toThrow('Failed to extract text from image');
    });
  });

  describe('parseReceiptData', () => {
    it('should parse receipt data from text result', () => {
      const textResult = {
        fullText: 'SUPERMERCADO TEST\n2024-01-15\nPan 2.50€\nLeche 1.80€\nTotal: 4.30€',
        blocks: []
      };

      const result = visionService.parseReceiptData(textResult);

      expect(result).toHaveProperty('vendor');
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('category');
      expect(result.vendor).toBe('SUPERMERCADO TEST');
      expect(result.total).toBe(4.30);
      expect(result.category).toBe('Alimentación');
    });

    it('should extract vendor name correctly', () => {
      const lines = ['MERCADONA S.A.', 'C/ EJEMPLO 123', '28001 MADRID'];
      
      const vendor = visionService.extractVendor(lines);
      
      expect(vendor).toBe('MERCADONA S.A.');
    });

    it('should extract date correctly', () => {
      const lines = ['MERCADONA', '15/01/2024', 'TICKET: 123'];
      
      const date = visionService.extractDate(lines);
      
      expect(date).toBe('2024-01-15');
    });

    it('should extract total amount correctly', () => {
      const lines = ['Producto 1: 2.50€', 'Producto 2: 3.80€', 'TOTAL: 6.30€'];
      
      const total = visionService.extractTotal(lines);
      
      expect(total).toBe(6.30);
    });

    it('should categorize expenses correctly', () => {
      const lines = ['mercadona', 'supermercado'];
      
      const category = visionService.categorizeExpense(lines);
      
      expect(category).toBe('Alimentación');
    });
  });

  describe('saveReceiptImage', () => {
    it('should save image to cloud storage', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      const fileName = 'test-receipt.jpg';

      const result = await visionService.saveReceiptImage(mockBuffer, fileName);

      expect(result).toHaveProperty('fileName');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('bucket');
      expect(result.url).toContain('https://');
    });

    it('should handle storage errors', async () => {
      // Mock storage error
      const { Storage } = require('@google-cloud/storage');
      Storage.prototype.bucket = jest.fn().mockReturnValue({
        file: jest.fn().mockReturnValue({
          save: jest.fn().mockRejectedValue(new Error('Storage error')),
        }),
      });

      const mockBuffer = Buffer.from('fake-image-data');
      const fileName = 'test-receipt.jpg';

      await expect(visionService.saveReceiptImage(mockBuffer, fileName))
        .rejects.toThrow('Failed to save receipt image');
    });
  });

  describe('isHeaderOrFooter', () => {
    it('should identify header/footer lines', () => {
      expect(visionService.isHeaderOrFooter('TOTAL: 45.67€')).toBe(true);
      expect(visionService.isHeaderOrFooter('GRACIAS POR SU VISITA')).toBe(true);
      expect(visionService.isHeaderOrFooter('www.mercadona.es')).toBe(true);
      expect(visionService.isHeaderOrFooter('Pan integral')).toBe(false);
    });
  });

  describe('extractItems', () => {
    it('should extract individual items from receipt', () => {
      const lines = [
        'Pan integral 2.50€',
        'Leche entera 1.80€',
        'TOTAL: 4.30€'
      ];

      const items = visionService.extractItems(lines);

      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        name: 'Pan integral',
        price: 2.50,
        quantity: 1
      });
      expect(items[1]).toEqual({
        name: 'Leche entera',
        price: 1.80,
        quantity: 1
      });
    });
  });
});