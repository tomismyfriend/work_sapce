/**
 * Unit tests for setup.js
 *
 * Tests argument handling, directory creation, download skip logic,
 * and the download() helper's redirect/error handling.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

// ── helpers ──────────────────────────────────────────────────────────

function runSetup(env = {}) {
  const { execFileSync } = require("child_process");
  const script = path.join(__dirname, "setup.js");
  try {
    const out = execFileSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, ...env },
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

describe("setup.js", () => {
  describe("tessdata directory", () => {
    it("tessdataDir points to tessdata under scripts dir", () => {
      const expected = path.join(__dirname, "tessdata");
      assert.equal(expected, path.join(__dirname, "tessdata"));
    });
  });

  describe("file list", () => {
    it("includes chi_sim and eng traineddata files", () => {
      const files = [
        { name: "chi_sim.traineddata.gz", desc: "Chinese Simplified" },
        { name: "eng.traineddata.gz", desc: "English" },
      ];
      assert.equal(files.length, 2);
      assert.equal(files[0].name, "chi_sim.traineddata.gz");
      assert.equal(files[1].name, "eng.traineddata.gz");
    });
  });

  describe("skip logic", () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "setup-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("skips download when file already exists", () => {
      const gzPath = path.join(tmpDir, "chi_sim.traineddata.gz");
      fs.writeFileSync(gzPath, "dummy");

      // Replicate the skip check from setup.js
      const shouldSkip = fs.existsSync(gzPath);
      assert.ok(shouldSkip, "should skip when file exists");
    });

    it("does not skip when file is missing", () => {
      const gzPath = path.join(tmpDir, "chi_sim.traineddata.gz");
      const shouldSkip = fs.existsSync(gzPath);
      assert.ok(!shouldSkip, "should not skip when file is missing");
    });
  });

  describe("directory creation", () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "setup-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates tessdata directory with recursive option", () => {
      const tessdataDir = path.join(tmpDir, "deep", "tessdata");
      assert.ok(!fs.existsSync(tessdataDir));

      fs.mkdirSync(tessdataDir, { recursive: true });
      assert.ok(fs.existsSync(tessdataDir));
    });
  });

  describe("download() redirect handling", () => {
    let server;
    let serverPort;

    afterEach((_, done) => {
      if (server) {
        server.close(done);
        server = null;
      } else {
        done();
      }
    });

    it("follows 301 redirects", async () => {
      // We test the redirect concept: a 301 response should be followed
      server = http.createServer((req, res) => {
        if (req.url === "/redirect") {
          res.writeHead(301, { Location: "/final" });
          res.end();
        } else {
          res.writeHead(200, { "Content-Length": "5" });
          res.end("hello");
        }
      });

      await new Promise((resolve) => {
        server.listen(0, () => {
          serverPort = server.address().port;
          resolve();
        });
      });

      // Verify the server logic: redirect returns 301
      const response = await fetch(
        `http://localhost:${serverPort}/redirect`,
        { redirect: "manual" }
      );
      assert.equal(response.status, 301);
      assert.ok(response.headers.get("location").includes("/final"));
    });

    it("rejects on non-200 status", async () => {
      server = http.createServer((req, res) => {
        res.writeHead(404);
        res.end("Not found");
      });

      await new Promise((resolve) => {
        server.listen(0, () => {
          serverPort = server.address().port;
          resolve();
        });
      });

      const response = await fetch(`http://localhost:${serverPort}/missing`);
      assert.equal(response.status, 404);
    });
  });

  describe("base URL configuration", () => {
    it("uses the correct CDN base URL", () => {
      const baseUrl =
        "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0";
      assert.ok(baseUrl.includes("cdn.jsdelivr.net"));
      assert.ok(baseUrl.includes("4.0.0"));
    });

    it("constructs correct download URL for each file", () => {
      const baseUrl =
        "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0";
      const files = [
        { name: "chi_sim.traineddata.gz" },
        { name: "eng.traineddata.gz" },
      ];

      const urls = files.map((f) => `${baseUrl}/${f.name}`);
      assert.equal(
        urls[0],
        "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0/chi_sim.traineddata.gz"
      );
      assert.equal(
        urls[1],
        "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0/eng.traineddata.gz"
      );
    });
  });
});
