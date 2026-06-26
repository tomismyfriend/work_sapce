#!/usr/bin/env node
/**
 * Export SVG slides to PPTX
 * Usage: node export_pptx.js <input_dir> [output_path]
 */

const path = require('path');
const { validateInputDir, findSvgFiles, parseCliArgs } = require('./utils');

// Check for pptxgenjs
let PptxGenJS;
try {
  PptxGenJS = require('pptxgenjs');
} catch (e) {
  console.error('\u274C Missing dependency: pptxgenjs');
  console.error('\nInstall required package:');
  console.error('  npm install pptxgenjs');
  process.exit(1);
}

function showHelp() {
  console.log(`
Export SVG slides to PPTX

Usage: node export_pptx.js <input_dir> [output_path]

Arguments:
  input_dir     Directory containing SVG files
  output_path   (Optional) Output PPTX file path
                Default: <input_dir>/slides-YYYY-MM-DD.pptx

Examples:
  node export_pptx.js ./ppt-output/
  node export_pptx.js ./ppt-output/ ./presentation.pptx
`);
}

async function exportToPptx(inputDir, outputPath) {
  validateInputDir(inputDir);
  const svgFiles = findSvgFiles(inputDir);

  // Create presentation
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  // Add slides
  console.log(`\n\uD83D\uDCCA Creating presentation with ${svgFiles.length} slide(s)...`);
  for (const svgFile of svgFiles) {
    const svgPath = path.join(inputDir, svgFile);
    const slide = pptx.addSlide();

    try {
      slide.addImage({
        path: svgPath,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%'
      });
      console.log(`  \u2713 Added: ${svgFile}`);
    } catch (err) {
      console.error(`  \u2717 Error adding ${svgFile}: ${err.message}`);
      process.exit(1);
    }
  }

  // Save presentation
  try {
    pptx.writeFile(outputPath);
    console.log(`\n\u2705 PPTX exported: ${outputPath} (${svgFiles.length} slides)\n`);
  } catch (err) {
    console.error(`\u274C Error saving PPTX: ${err.message}`);
    process.exit(1);
  }
}

// Main
const parsed = parseCliArgs('export_pptx.js', 'pptx');

if (parsed.help) {
  showHelp();
  process.exit(0);
}

exportToPptx(parsed.inputDir, parsed.outputPath).catch(err => {
  console.error(`\u274C Fatal error: ${err.message}`);
  process.exit(1);
});
