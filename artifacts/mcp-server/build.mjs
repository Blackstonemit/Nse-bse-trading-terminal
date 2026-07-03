import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm, mkdir } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(artifactDir, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: path.resolve(distDir, "index.js"),
  external: [
    "*.node",
    "better-sqlite3",
    "@libsql/client",
    "drizzle-orm",
    "@workspace/db",
    "canvas",
    "fsevents",
  ],
  sourcemap: true,
  logLevel: "info",
  banner: {
    js: "// NSE/BSE Trading Terminal MCP Server\n",
  },
});

console.log("✅ MCP server built → dist/index.js");
