import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

// Build from the lockfile-installed packages, never a runtime CDN fallback.
export function ocrAssets(): Plugin {
  const root = process.cwd();
  const files = new Map<string, string>();
  for (const name of ["tesseract.js", "tesseract.js-core"]) {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8"));
    if (pkg.version !== "7.0.0") throw new Error(`Review OCR assets before upgrading ${name}`);
  }
  files.set("ocr/tesseract-7.0.0/worker.min.js", "node_modules/tesseract.js/dist/worker.min.js");
  files.set("ocr/tesseract-7.0.0/LICENSE", "node_modules/tesseract.js/LICENSE.md");
  for (const variant of ["lstm", "simd-lstm", "relaxedsimd-lstm"]) {
    files.set(`ocr/core-7.0.0/tesseract-core-${variant}.wasm.js`, `node_modules/tesseract.js-core/tesseract-core-${variant}.wasm.js`);
  }
  files.set("ocr/core-7.0.0/LICENSE", "node_modules/tesseract.js-core/LICENSE");
  return {
    name: "same-origin-ocr-assets",
    generateBundle() {
      for (const [fileName, source] of files) this.emitFile({ type: "asset", fileName, source: fs.readFileSync(path.join(root, source)) });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const source = files.get((req.url ?? "").split("?")[0].replace(/^\//, ""));
        if (!source) return next();
        res.setHeader("Content-Type", source.endsWith(".js") ? "application/javascript" : "text/plain");
        res.end(fs.readFileSync(path.join(root, source)));
      });
    },
  };
}
