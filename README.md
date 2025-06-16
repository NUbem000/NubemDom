# NubemDom - Sistema de Control de Gastos Domésticos con OCR

Sistema inteligente para el control y gestión de gastos domésticos mediante reconocimiento óptico de caracteres (OCR) en recibos y facturas.

## 🚀 Características

- 📸 Captura y procesamiento de recibos mediante OCR
- 📊 Dashboard de análisis de gastos
- 🏷️ Categorización automática de gastos
- 📈 Reportes y estadísticas mensuales
- 🔍 Búsqueda inteligente de transacciones
- 💾 Almacenamiento seguro en la nube
- 📱 Interfaz responsive para móvil y escritorio

## 🛠️ Stack Tecnológico

- **Backend**: Node.js + Express.js
- **Frontend**: React + Tailwind CSS
- **OCR**: Google Cloud Vision API
- **Base de datos**: Firestore
- **Infraestructura**: Google Cloud Platform (Cloud Run)
- **CI/CD**: GitHub Actions + Cloud Build

## 📋 Requisitos Previos

- Node.js 18+
- Cuenta de Google Cloud Platform
- gcloud CLI instalado y configurado
- Git

## 🔧 Instalación Local

```bash
# Clonar el repositorio
git clone https://github.com/NUbem000/NubemDom.git
cd NubemDom

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar en desarrollo
npm run dev
```

## 🚀 Despliegue en GCP

```bash
# Configurar proyecto GCP
gcloud config set project nubemdom

# Desplegar a Cloud Run
npm run deploy
```

## 📸 Uso

1. **Captura**: Toma una foto del recibo o factura
2. **Procesamiento**: El sistema extrae automáticamente la información
3. **Revisión**: Verifica y ajusta los datos extraídos si es necesario
4. **Análisis**: Consulta tus gastos categorizados en el dashboard

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea tu rama de características (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 👥 Equipo

- **NubemSystems** - Desarrollo y mantenimiento

---

🌐 [nubemdom.com](https://nubemdom.com) | 📧 soporte@nubemsystems.es