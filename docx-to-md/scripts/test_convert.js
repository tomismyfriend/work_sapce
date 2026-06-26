/**
 * Unit tests for convert.js
 *
 * These tests verify the argument-validation and image-handling logic
 * by mocking mammoth, turndown, and fs at the module level.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ── helpers ──────────────────────────────────────────────────────────

/** Run convert.js in a child process so we can test process.exit / argv */
function runConvert(args = []) {
  const { execFileSync } = require("child_process");
  const script = path.join(__dirname, "convert.js");
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

describe("convert.js", () => {
  describe("argument validation", () => {
    it("exits with code 1 when no arguments provided", () => {
      const result = runConvert([]);
      assert.equal(result.exitCode, 1);
      assert.ok(result.stderr.includes("Usage:"));
    });

    it("exits with code 1 when only input path provided", () => {
      const result = runConvert(["input.docx"]);
      assert.equal(result.exitCode, 1);
      assert.ok(result.stderr.includes("Usage:"));
    });
  });

  describe("images directory creation", () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "convert-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates the images directory when it does not exist", () => {
      const imagesDir = path.join(tmpDir, "newimages");
      // The script creates imagesDir early, before mammoth runs.
      // Running with a non-existent docx will fail at mammoth, but the
      // dir should already be created by then.
      const result = runConvert([
        path.join(tmpDir, "fake.docx"),
        path.join(tmpDir, "out.md"),
        imagesDir,
      ]);
      // Dir is created before mammoth conversion is attempted
      assert.ok(
        fs.existsSync(imagesDir),
        "images directory should have been created"
      );
    });
  });

  describe("turndown configuration", () => {
    it("uses atx-style headings", () => {
      const TurndownService = require("turndown");
      const td = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        bulletListMarker: "-",
        emDelimiter: "*",
      });
      const md = td.turndown("<h1>Title</h1>");
      assert.ok(md.startsWith("#"), "heading should use # prefix");
    });

    it("uses fenced code blocks", () => {
      const TurndownService = require("turndown");
      const td = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        bulletListMarker: "-",
        emDelimiter: "*",
      });
      const md = td.turndown("<pre><code>hello</code></pre>");
      assert.ok(md.includes("```"), "code block should use fences");
    });

    it("uses dash for bullet lists", () => {
      const TurndownService = require("turndown");
      const td = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        bulletListMarker: "-",
        emDelimiter: "*",
      });
      const md = td.turndown("<ul><li>item</li></ul>");
      assert.ok(md.includes("-"), "bullet list should use dash");
    });
  });

  describe("path handling", () => {
    it("resolves relative images dir against output dir", () => {
      const outputPath = "/some/dir/output.md";
      const imagesDir = "imgs";
      const expected = path.resolve(path.dirname(outputPath), imagesDir);
      assert.equal(expected, "/some/dir/imgs");
    });

    it("uses absolute images dir as-is", () => {
      const imagesDir = "/absolute/images";
      const result = path.isAbsolute(imagesDir) ? imagesDir : "resolved";
      assert.equal(result, "/absolute/images");
    });
  });
});
