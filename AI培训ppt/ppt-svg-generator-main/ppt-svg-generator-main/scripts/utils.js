const fs = require('fs');
const path = require('path');

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function getOutputPath(inputDir, customPath, ext) {
  if (customPath) {
    if (!fs.existsSync(customPath)) {
      return customPath;
    }

    const dir = path.dirname(customPath);
    const fileExt = path.extname(customPath);
    const base = path.basename(customPath, fileExt);

    let counter = 2;
    while (true) {
      const newPath = path.join(dir, `${base}-${counter}${fileExt}`);
      if (!fs.existsSync(newPath)) {
        return newPath;
      }
      counter++;
    }
  }

  const timestamp = new Date().toISOString().split('T')[0];
  let outputPath = path.join(inputDir, `slides-${timestamp}.${ext}`);

  if (!fs.existsSync(outputPath)) {
    return outputPath;
  }

  let counter = 2;
  while (true) {
    outputPath = path.join(inputDir, `slides-${timestamp}-${counter}.${ext}`);
    if (!fs.existsSync(outputPath)) {
      return outputPath;
    }
    counter++;
  }
}

function validateInputDir(inputDir) {
  if (!fs.existsSync(inputDir)) {
    console.error(`\u274C Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  if (!fs.statSync(inputDir).isDirectory()) {
    console.error(`\u274C Not a directory: ${inputDir}`);
    process.exit(1);
  }
}

function findSvgFiles(inputDir) {
  const files = fs.readdirSync(inputDir);
  const svgFiles = files
    .filter(f => f.toLowerCase().endsWith('.svg'))
    .sort(naturalSort);

  if (svgFiles.length === 0) {
    console.error(`\u274C No SVG files found in ${inputDir}`);
    process.exit(1);
  }

  return svgFiles;
}

function parseCliArgs(scriptName, ext) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    return { help: true, args };
  }

  if (args.length === 0) {
    console.error('\u274C Missing required argument: input_dir');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  const inputDir = path.resolve(args[0]);
  const customOutputPath = args[1] ? path.resolve(args[1]) : null;
  const outputPath = getOutputPath(inputDir, customOutputPath, ext);

  return { inputDir, outputPath, args };
}

module.exports = {
  naturalSort,
  getOutputPath,
  validateInputDir,
  findSvgFiles,
  parseCliArgs,
};
