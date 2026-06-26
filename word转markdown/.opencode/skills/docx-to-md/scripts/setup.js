const https = require("https");
const fs = require("fs");
const path = require("path");

const tessdataDir = path.join(__dirname, "tessdata");
const baseUrl = "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0";

const files = [
  { name: "chi_sim.traineddata.gz", desc: "Chinese Simplified" },
  { name: "eng.traineddata.gz", desc: "English" }
];

if (!fs.existsSync(tessdataDir)) {
  fs.mkdirSync(tessdataDir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    file.on("error", (err) => {
      file.close();
      try { fs.unlinkSync(dest); } catch (_) {}
      reject(new Error(`Write error for ${dest}: ${err.message}`));
    });
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch (_) {}
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const total = parseInt(response.headers["content-length"], 10);
      let downloaded = 0;
      response.on("data", (chunk) => {
        downloaded += chunk.length;
        if (total) {
          const pct = ((downloaded / total) * 100).toFixed(0);
          process.stdout.write(`\r  Downloading: ${pct}%`);
        }
      });
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => {
      file.close();
      try { fs.unlinkSync(dest); } catch (_) {}
      reject(err);
    });
  });
}

async function setup() {
  console.log("Setting up Tesseract language data...\n");

  const failures = [];
  for (const file of files) {
    const gzPath = path.join(tessdataDir, file.name);

    if (fs.existsSync(gzPath)) {
      console.log(`[SKIP] ${file.desc} (${file.name}) already exists`);
      continue;
    }

    console.log(`[DOWNLOAD] ${file.desc} (${file.name})`);
    const url = `${baseUrl}/${file.name}`;

    try {
      await download(url, gzPath);
      const sizeMB = (fs.statSync(gzPath).size / 1024 / 1024).toFixed(1);
      console.log(`\n[DONE] ${file.desc}: ${sizeMB} MB\n`);
    } catch (err) {
      console.error(`\n[ERROR] ${file.desc}: ${err.message}\n`);
      failures.push(file.desc);
    }
  }

  if (failures.length > 0) {
    console.error(`Setup failed for: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("Setup complete. Language data in:", tessdataDir);
}

setup().catch((err) => {
  console.error(`Setup failed: ${err.message}`);
  process.exit(1);
});
