const mammoth = require("mammoth");
const TurndownService = require("turndown");
const fs = require("fs");
const path = require("path");

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const imagesDir = process.argv[4] || "images";

if (!inputPath || !outputPath) {
  console.error("Usage: node convert.js <input.docx> <output.md> [images-dir]");
  process.exit(1);
}

const absoluteImagesDir = path.isAbsolute(imagesDir) 
  ? imagesDir 
  : path.resolve(path.dirname(outputPath), imagesDir);

if (!fs.existsSync(absoluteImagesDir)) {
  fs.mkdirSync(absoluteImagesDir, { recursive: true });
}

let imageCounter = 0;

const options = {
  convertImage: mammoth.images.imgElement((image) => {
    return image.read("base64").then((imageBuffer) => {
      imageCounter++;
      const ext = image.contentType.split("/")[1] || "png";
      const filename = `image_${String(imageCounter).padStart(3, "0")}.${ext}`;
      const filepath = path.join(absoluteImagesDir, filename);
      
      fs.writeFileSync(filepath, Buffer.from(imageBuffer, "base64"));
      
      const relativePath = path.relative(path.dirname(outputPath), filepath).replace(/\\/g, "/");
      return { src: relativePath };
    });
  })
};

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*"
});

turndownService.escape = (string) => string;

turndownService.addRule("preserveLineBreaks", {
  filter: ["br"],
  replacement: () => "\n"
});

mammoth.convertToHtml({ path: inputPath }, options)
  .then((result) => {
    const markdown = turndownService.turndown(result.value);
    fs.writeFileSync(outputPath, markdown, "utf8");
    console.log(`Converted: ${inputPath} -> ${outputPath}`);
    console.log(`Extracted ${imageCounter} images to: ${absoluteImagesDir}`);
    if (result.messages.length > 0) {
      console.log("Warnings:");
      result.messages.forEach((m) => console.log(`  - ${m.message}`));
    }
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
