/**
 * Uploads the rendered product shots (apps/web/public/products/*) to R2 under products/.
 *   pnpm images:upload:local   |   pnpm images:upload:remote
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const mode = process.argv.includes("--remote") ? "--remote" : "--local";
const dir = join(import.meta.dirname, "../../web/public/products");
const files = readdirSync(dir).filter((f) => /\.(webp|avif)$/.test(f));
for (const f of files) {
  const type = f.endsWith(".avif") ? "image/avif" : "image/webp";
  execFileSync("npx", ["wrangler", "r2", "object", "put", `lumen-images/products/${f}`, "--file", join(dir, f), "--content-type", type, mode], { stdio: "inherit" });
}
console.log(`Uploaded ${files.length} images (${mode}).`);
