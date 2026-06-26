const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

const imagesDir = process.argv[2];
const outputFile = process.argv[3];
const tessdataDir = process.argv[4] || path.join(__dirname, "tessdata");

if (!imagesDir || !outputFile) {
  console.error("Usage: node ocr.js <images-dir> <output.json> [tessdata-dir]");
  process.exit(1);
}

if (!fs.existsSync(imagesDir)) {
  console.error(`Error: images directory not found: ${imagesDir}`);
  process.exit(1);
}

const normalizedTessdata = tessdataDir.replace(/\\/g, "/");

let imageFiles;
try {
  imageFiles = fs.readdirSync(imagesDir)
    .filter(f => /\.(png|jpg|jpeg|bmp|tiff)$/i.test(f))
    .sort();
} catch (err) {
  console.error(`Error reading images directory: ${err.message}`);
  process.exit(1);
}

if (imageFiles.length === 0) {
  console.error(`No image files found in: ${imagesDir}`);
  process.exit(1);
}

async function run() {
  const results = {};
  const hasChiSim = fs.existsSync(path.join(tessdataDir, "chi_sim.traineddata"));
  const langs = hasChiSim ? "chi_sim+eng" : "eng";
  console.log(`Using languages: ${langs}`);
  console.log(`Tessdata dir: ${normalizedTessdata}`);

  const worker = await Tesseract.createWorker(langs, 1, {
    langPath: normalizedTessdata,
    logger: (m) => {
      if (m.status === "recognizing text") {
        process.stdout.write(`\r  Progress: ${(m.progress * 100).toFixed(0)}%`);
      }
    }
  });

  for (const file of imageFiles) {
    const filepath = path.join(imagesDir, file);
    console.log(`\nProcessing: ${file}...`);

    try {
      const { data } = await worker.recognize(filepath);
      console.log("");
      results[file] = data.text.trim();
    } catch (err) {
      console.log(`\n  Error: ${err.message}`);
      results[file] = `[OCR failed: ${err.message}]`;
    }
  }

  await worker.terminate();
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nResults saved to: ${outputFile}`);
}

run().catch((err) => {
  console.error(`OCR failed: ${err.message}`);
  process.exit(1);
});
