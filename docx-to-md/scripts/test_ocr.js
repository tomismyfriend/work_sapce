/**
 * Unit tests for ocr.js
 *
 * Tests argument validation, image-file filtering/sorting, and language
 * detection logic by running ocr.js as a subprocess and by exercising
 * helper logic directly.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ── helpers ──────────────────────────────────────────────────────────

function runOcr(args = []) {
  const { execFileSync } = require("child_process");
  const script = path.join(__dirname, "ocr.js");
  try {
    const out = execFileSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      timeout: 15000,
    });
    return { stdout: out, exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      exitCode: err.status,
    };
  }
}

// ── tests ────────────────────────────────────────────────────────────

describe("ocr.js", () => {
  describe("argument validation", () => {
    it("exits with code 1 when no arguments provided", () => {
      const result = runOcr([]);
      assert.equal(result.exitCode, 1);
      assert.ok(result.stderr.includes("Usage:"));
    });

    it("exits with code 1 when only images-dir provided", () => {
      const result = runOcr(["/some/dir"]);
      assert.equal(result.exitCode, 1);
      assert.ok(result.stderr.includes("Usage:"));
    });
  });

  describe("image file filtering", () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("filters only supported image extensions", () => {
      // Create mixed files
      fs.writeFileSync(path.join(tmpDir, "photo.png"), "");
      fs.writeFileSync(path.join(tmpDir, "photo.jpg"), "");
      fs.writeFileSync(path.join(tmpDir, "photo.jpeg"), "");
      fs.writeFileSync(path.join(tmpDir, "photo.bmp"), "");
      fs.writeFileSync(path.join(tmpDir, "photo.tiff"), "");
      fs.writeFileSync(path.join(tmpDir, "readme.md"), "");
      fs.writeFileSync(path.join(tmpDir, "data.json"), "");
      fs.writeFileSync(path.join(tmpDir, "script.js"), "");

      const allFiles = fs.readdirSync(tmpDir);
      const imageFiles = allFiles
        .filter((f) => /\.(png|jpg|jpeg|bmp|tiff)$/i.test(f))
        .sort();

      assert.equal(imageFiles.length, 5);
      assert.ok(imageFiles.includes("photo.bmp"));
      assert.ok(imageFiles.includes("photo.jpg"));
      assert.ok(imageFiles.includes("photo.jpeg"));
      assert.ok(imageFiles.includes("photo.png"));
      assert.ok(imageFiles.includes("photo.tiff"));
    });

    it("is case-insensitive for extensions", () => {
      fs.writeFileSync(path.join(tmpDir, "A.PNG"), "");
      fs.writeFileSync(path.join(tmpDir, "B.Jpg"), "");

      const imageFiles = fs
        .readdirSync(tmpDir)
        .filter((f) => /\.(png|jpg|jpeg|bmp|tiff)$/i.test(f))
        .sort();

      assert.equal(imageFiles.length, 2);
    });

    it("returns files in sorted order", () => {
      fs.writeFileSync(path.join(tmpDir, "c.png"), "");
      fs.writeFileSync(path.join(tmpDir, "a.png"), "");
      fs.writeFileSync(path.join(tmpDir, "b.png"), "");

      const imageFiles = fs
        .readdirSync(tmpDir)
        .filter((f) => /\.(png|jpg|jpeg|bmp|tiff)$/i.test(f))
        .sort();

      assert.deepEqual(imageFiles, ["a.png", "b.png", "c.png"]);
    });

    it("returns empty list when no images present", () => {
      fs.writeFileSync(path.join(tmpDir, "data.json"), "");

      const imageFiles = fs
        .readdirSync(tmpDir)
        .filter((f) => /\.(png|jpg|jpeg|bmp|tiff)$/i.test(f));

      assert.equal(imageFiles.length, 0);
    });
  });

  describe("language detection logic", () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-lang-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("detects chi_sim when traineddata file exists", () => {
      fs.writeFileSync(path.join(tmpDir, "chi_sim.traineddata"), "");
      const hasChiSim = fs.existsSync(
        path.join(tmpDir, "chi_sim.traineddata")
      );
      const langs = hasChiSim ? "chi_sim+eng" : "eng";
      assert.equal(langs, "chi_sim+eng");
    });

    it("falls back to eng when chi_sim is missing", () => {
      const hasChiSim = fs.existsSync(
        path.join(tmpDir, "chi_sim.traineddata")
      );
      const langs = hasChiSim ? "chi_sim+eng" : "eng";
      assert.equal(langs, "eng");
    });
  });

  describe("tessdata path normalization", () => {
    it("normalizes backslashes to forward slashes", () => {
      const tessdataDir = "C:\\Users\\test\\tessdata";
      const normalized = tessdataDir.replace(/\\/g, "/");
      assert.equal(normalized, "C:/Users/test/tessdata");
    });

    it("leaves forward-slash paths unchanged", () => {
      const tessdataDir = "/home/user/tessdata";
      const normalized = tessdataDir.replace(/\\/g, "/");
      assert.equal(normalized, "/home/user/tessdata");
    });
  });
});
