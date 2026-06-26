#!/usr/bin/env node
/**
 * Export SVG slides to PDF using Playwright
 *
 * Cross-platform solution (Windows/macOS/Linux) that uses Playwright
 * to render SVG files via a headless browser and generate a merged PDF.
 *
 * Usage: node export_pdf.js <input_dir> [output_path]
 */

const fs = require('fs');
const path = require('path');
const { validateInputDir, findSvgFiles, parseCliArgs } = require('./utils');

async function checkDependencies() {
  const missing = [];

  try {
    require('playwright');
  } catch (e) {
    missing.push('playwright');
  }

  try {
    require('pdf-lib');
  } catch (e) {
    missing.push('pdf-lib');
  }

  if (missing.length > 0) {
    console.error('\u274C Missing dependencies: ' + missing.join(', '));
    console.error('\nInstall required packages:');
    console.error('  cd ' + path.dirname(__filename));
    console.error('  npm install');
    console.error('\nOr install globally:');
    console.error('  npm install -g ' + missing.join(' '));

    if (missing.includes('playwright')) {
      console.error('\nPlaywright also requires browser installation:');
      console.error('  npx playwright install chromium');
    }

    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Export SVG slides to PDF

Usage: node export_pdf.js <input_dir> [output_path]

Arguments:
  input_dir     Directory containing SVG files
  output_path   (Optional) Output PDF file path
                Default: <input_dir>/slides-YYYY-MM-DD.pdf

Options:
  --help, -h    Show this help message

Examples:
  node export_pdf.js ./ppt-output/
  node export_pdf.js ./ppt-output/ ./presentation.pdf

Cross-platform: Works on Windows, macOS, and Linux.
`);
}

async function svgToPdfBuffer(browser, svgPath) {
  const svgContent = fs.readFileSync(svgPath, 'utf-8');

  let width = 1920;
  let height = 1080;

  const widthMatch = svgContent.match(/width=["'](\d+)/);
  const heightMatch = svgContent.match(/height=["'](\d+)/);

  if (widthMatch) width = parseInt(widthMatch[1], 10);
  if (heightMatch) height = parseInt(heightMatch[1], 10);

  const page = await browser.newPage({
    viewport: { width, height }
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
${svgContent}
</body>
</html>`;

  await page.setContent(html, {
    waitUntil: 'networkidle'
  });

  const pdfBuffer = await page.pdf({
    width: `${width}px`,
    height: `${height}px`,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await page.close();

  return pdfBuffer;
}

async function mergePdfs(pdfBuffers) {
  const { PDFDocument } = require('pdf-lib');

  const mergedPdf = await PDFDocument.create();

  for (const buffer of pdfBuffers) {
    const pdf = await PDFDocument.load(buffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach(page => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}

async function exportToPdf(inputDir, outputPath) {
  const { chromium } = require('playwright');

  validateInputDir(inputDir);
  const svgFiles = findSvgFiles(inputDir);

  console.log(`\n\uD83D\uDCC4 Found ${svgFiles.length} SVG file(s)`);
  console.log('\uD83D\uDE80 Starting PDF conversion (using Playwright)...\n');

  let browser;
  try {
    browser = await chromium.launch({
      headless: true
    });
  } catch (e) {
    if (e.message.includes('Executable doesn\'t exist') || e.message.includes('browserType.launch')) {
      console.error('\u274C Chromium browser not installed for Playwright');
      console.error('\nInstall the browser with:');
      console.error('  npx playwright install chromium');
      process.exit(1);
    }
    throw e;
  }

  try {
    const pdfBuffers = [];

    for (let i = 0; i < svgFiles.length; i++) {
      const svgFile = svgFiles[i];
      const svgPath = path.join(inputDir, svgFile);

      process.stdout.write(`  [${i + 1}/${svgFiles.length}] Converting ${svgFile}...`);

      try {
        const pdfBuffer = await svgToPdfBuffer(browser, svgPath);
        pdfBuffers.push(pdfBuffer);
        console.log(' \u2705');
      } catch (err) {
        console.log(' \u274C');
        console.error(`\n\u274C Failed to convert ${svgFile}: ${err.message}`);
        process.exit(1);
      }
    }

    console.log('\n\uD83D\uDCCE Merging pages...');
    const mergedPdf = await mergePdfs(pdfBuffers);

    fs.writeFileSync(outputPath, mergedPdf);

    console.log(`\n\u2705 PDF exported: ${outputPath} (${svgFiles.length} pages)\n`);

  } finally {
    await browser.close();
  }
}

// Main
async function main() {
  const parsed = parseCliArgs('export_pdf.js', 'pdf');

  if (parsed.help) {
    showHelp();
    process.exit(0);
  }

  await checkDependencies();

  await exportToPdf(parsed.inputDir, parsed.outputPath);
}

main().catch(err => {
  console.error(`\u274C Fatal error: ${err.message}`);
  process.exit(1);
});
