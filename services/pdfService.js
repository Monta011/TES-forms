const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const { execSync } = require('child_process');

/**
 * Find Chrome executable (for Render deployment)
 * @returns {string|null} Path to Chrome or null
 */
function findChromeExecutable() {
  console.log('🔍 Looking for Chrome executable...');
  console.log('Environment:', {
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
    PUPPETEER_CACHE_DIR: process.env.PUPPETEER_CACHE_DIR,
    NODE_ENV: process.env.NODE_ENV,
    PWD: process.cwd()
  });

  // If explicitly set, use it
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log('✅ Using PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Try Puppeteer's default
  try {
    const defaultPath = puppeteer.executablePath();
    console.log('✅ Using Puppeteer default path:', defaultPath);
    return defaultPath;
  } catch (e) {
    console.warn('⚠️  Puppeteer default path failed:', e.message);
    
    // If that fails, try to find Chrome in Puppeteer cache (Render)
    const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(process.cwd(), '.cache', 'puppeteer');
    console.log('🔍 Searching in cache directory:', cacheDir);
    
    if (existsSync(cacheDir)) {
      try {
        // Find chrome executable in cache directory
        const findCommand = process.platform === 'win32' 
          ? `dir /s /b "${cacheDir}\\chrome.exe"` 
          : `find "${cacheDir}" -type f -name "chrome" 2>/dev/null | head -n 1`;
        
        console.log('Running command:', findCommand);
        const chromePath = execSync(findCommand, { encoding: 'utf8' }).trim();
        
        if (chromePath && existsSync(chromePath)) {
          console.log('✅ Found Chrome at:', chromePath);
          return chromePath;
        } else {
          console.warn('⚠️  Chrome path not found or does not exist:', chromePath);
        }
      } catch (err) {
        console.error('❌ Could not find Chrome in cache:', err.message);
        
        // List cache directory contents for debugging
        try {
          const lsCommand = `ls -la "${cacheDir}" 2>/dev/null || echo "Cache dir not accessible"`;
          const dirContents = execSync(lsCommand, { encoding: 'utf8' });
          console.log('📁 Cache directory contents:', dirContents);
        } catch (lsErr) {
          console.error('Could not list cache directory');
        }
      }
    } else {
      console.error('❌ Cache directory does not exist:', cacheDir);
    }
  }

  console.error('❌ No Chrome executable found');
  return null;
}

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

    // Find Chrome executable
    const executablePath = findChromeExecutable();
    if (!executablePath) {
      const errorMsg = 'Chrome executable not found. Puppeteer installation may have failed during build.';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    console.log('🚀 Launching Puppeteer with Chrome at:', executablePath);

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
      executablePath
    });

    console.log('✅ Browser launched successfully');

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

    console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    return pdfBuffer;
  } catch (error) {
    console.error('❌ PDF generation error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

module.exports = {
  generatePDF
};
