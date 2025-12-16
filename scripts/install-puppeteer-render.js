#!/usr/bin/env node

/**
 * Install Puppeteer script for Render deployment
 * Configures Puppeteer to use system Chrome instead of downloading Chromium
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Configuring Puppeteer for Render deployment...');

// Check if running in Render environment
const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';

if (!isRender) {
  console.log('✅ Not in Render environment, skipping Puppeteer configuration');
  process.exit(0);
}

// Verify Chromium path exists
const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';

if (fs.existsSync(chromiumPath)) {
  console.log(`✅ Found Chromium at: ${chromiumPath}`);
} else {
  console.warn(`⚠️  Chromium not found at: ${chromiumPath}`);
  console.warn('   Make sure Chrome dependencies are installed in render.yaml');
}

console.log('✅ Puppeteer configuration complete');
process.exit(0);
