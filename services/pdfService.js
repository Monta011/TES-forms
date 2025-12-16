const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs').promises;

/**
 * Convert image to base64
 * @param {string} imagePath - Path to image file
 * @returns {Promise<string>} Base64 data URL
 */
async function imageToBase64(imagePath) {
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  } catch (error) {
    console.error(`Error reading image ${imagePath}:`, error);
    return '';
  }
}

/**
 * Generate PDF from EJS template
 * @param {string} type - Form type (rejoining, leave-expats, leave-omani)
 * @param {Object} data - Form data to populate template
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePDF(type, data) {
  try {
    // Map type to template filename
    const templateMap = {
      'rejoining': 'rejoining.ejs',
      'leave-expats': 'leave_expats.ejs',
      'leave-omani': 'leave_omani.ejs'
    };

    const templateFile = templateMap[type];
    if (!templateFile) {
      throw new Error(`Invalid form type: ${type}`);
    }

    // Convert logo to base64
    const logoPath = path.join(__dirname, '../public/images/Picture.png');
    const logoBase64 = await imageToBase64(logoPath);

    // Render EJS template to HTML with logo as base64
    const templatePath = path.join(__dirname, '../views/pdf', templateFile);
    let html = await ejs.renderFile(templatePath, { data, logoBase64 });

    // Launch Puppeteer with cache configuration
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath()
    });

    const page = await browser.newPage();
    
    // Set content and wait for everything to load
    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded', 'networkidle0']
    });
    
    // Wait a bit more for fonts to render
    await page.evaluateHandle('document.fonts.ready');
    await page.emulateMediaType('print');

    // Generate PDF with A4 format
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    });

    await browser.close();

    return pdfBuffer;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

module.exports = {
  generatePDF
};
