/**
 * Renders a studio shot for every catalog variant using the procedural 3D model,
 * then encodes AVIF + WebP at two sizes into public/products/.
 *   pnpm dev   (in another terminal, port 5173)
 *   pnpm render:products [--only=slug]
 */
import { createRequire } from "node:module";
import sharp from "sharp";
import { mkdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "@lumen/core";
import { seedProducts } from "@lumen/core/seed";
import { finishFor } from "../src/lib/finish";

// Playwright is preinstalled globally (with its browser); CJS require honours NODE_PATH.
const { chromium } = createRequire(import.meta.url)("playwright") as typeof import("playwright");

const BASE = process.env.RENDER_URL ?? "http://127.0.0.1:5173";
const OUT = join(import.meta.dirname, "../public/products");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const force = process.argv.includes("--force");
// --since=<file>: re-render shots older than that file (e.g. after a lighting change), keep newer ones.
const since = process.argv.find((a) => a.startsWith("--since="))?.slice(8);
const sinceMs = since ? statSync(since).mtimeMs : 0;
const isFresh = (f: string) => existsSync(f) && statSync(f).mtimeMs > sinceMs;
mkdirSync(OUT, { recursive: true });

const jobs = seedProducts().flatMap((p) =>
  p.variants.map((v) => ({
    file: `${p.slug}-${slugify(v.frameColor)}-${slugify(v.lensColor)}`,
    query: { style: p.style, material: p.frameMaterial, frame: v.frameColor, frameHex: v.frameColorHex, lens: v.lensColorHex, finish: finishFor(v.lensColor, p.lensTypes), seed: p.slug },
    slug: p.slug,
  })),
);
// Hero poster (LCP image while the WebGL hero loads)
jobs.push({ file: "hero-poster", query: { style: "aviator", material: "metal", frame: "Gold", frameHex: "#c9a14a", lens: "#c8892b", finish: "gradient", seed: "riviera", view: "front" } as never, slug: "hero" });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("pageerror", e.message));
let n = 0;
for (const j of jobs) {
  if (only && j.slug !== only) continue;
  if (!force && isFresh(join(OUT, `${j.file}.avif`))) continue;
  await page.goto(`${BASE}/render?${new URLSearchParams({ ...j.query, dpr: "1.3" })}`);
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 240_000 });
  const png = await page.screenshot({ omitBackground: true, type: "png" });
  const img = sharp(png).trim({ threshold: 1 }).extend({ top: 40, bottom: 40, left: 40, right: 40, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const trimmed = await img.png().toBuffer();
  const sizes = j.slug === "hero" ? [[1600, "-lg"], [900, ""]] : [[1200, ""], [600, "-sm"]];
  for (const [w, suffix] of sizes as [number, string][]) {
    const base = sharp(trimmed).resize({ width: w, height: Math.round(w * 0.75), fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
    await base.clone().webp({ quality: 82, alphaQuality: 90, effort: 5 }).toFile(join(OUT, `${j.file}${suffix}.webp`));
    await base.clone().avif({ quality: 58, effort: 5 }).toFile(join(OUT, `${j.file}${suffix}.avif`));
  }
  console.log(`${++n}/${jobs.length} ${j.file}`);
}
await browser.close();
