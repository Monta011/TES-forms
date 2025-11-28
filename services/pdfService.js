const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');

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

    // Render EJS template to HTML
    const templatePath = path.join(__dirname, '../views/pdf', templateFile);
    const html = await ejs.renderFile(templatePath, { data });

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set content and wait for images/fonts to load
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'load']
    });

    // Generate PDF with A4 format
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
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
