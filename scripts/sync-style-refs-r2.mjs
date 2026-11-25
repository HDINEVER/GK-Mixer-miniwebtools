#!/usr/bin/env node
/**
 * Sync local AI Paint Studio style reference images from `public/ai-style-refs/`
 * to the private Cloudflare R2 bucket (`gk-mixer-style-refs` by default).
 *
 * Usage:
 *   npm run r2:sync-refs
 *   R2_STYLE_REFS_BUCKET=my-bucket npm run r2:sync-refs
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const refsDir = path.join(projectRoot, "public", "ai-style-refs");
const presetsPath = path.join(refsDir, "presets.json");

const bucketName =
  process.env.R2_STYLE_REFS_BUCKET || process.argv[2] || "gk-mixer-style-refs";

function getExpectedSlots() {
  if (!fs.existsSync(presetsPath)) return [];
  const raw = JSON.parse(fs.readFileSync(presetsPath, "utf8"));
  const slots = [];
  for (const preset of raw) {
    if (!preset || preset.enabled === false) continue;
    if (Array.isArray(preset.subStyles) && preset.subStyles.length > 0) {
      for (const sub of preset.subStyles) {
        if (sub && sub.enabled !== false && sub.sampleImage) {
          slots.push({
            file: path.basename(sub.sampleImage),
            label: `${preset.name} / ${sub.name}`,
          });
        }
      }
    } else if (preset.sampleImage) {
      slots.push({
        file: path.basename(preset.sampleImage),
        label: preset.name,
      });
    }
  }
  return slots;
}

if (!fs.existsSync(refsDir)) {
  console.error(`[r2:sync-refs] Directory not found: ${refsDir}`);
  process.exit(1);
}

const imageFiles = fs
  .readdirSync(refsDir)
  .filter((f) => /^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(f))
  .sort();

const expectedSlots = getExpectedSlots();

if (imageFiles.length === 0) {
  console.log(`[r2:sync-refs] No local image files found in ${refsDir}.`);
  if (expectedSlots.length > 0) {
    console.log("\nExpected 13 core filenames (place them in public/ai-style-refs/ first):");
    for (const s of expectedSlots) {
      console.log(`  - ${s.file}  (${s.label})`);
    }
  }
  process.exit(0);
}

console.log(
  `[r2:sync-refs] Uploading ${imageFiles.length} image(s) to R2 bucket "${bucketName}"...`
);

let uploaded = 0;
for (const file of imageFiles) {
  const fullPath = path.join(refsDir, file);
  const lower = file.toLowerCase();
  const contentType = lower.endsWith(".png")
    ? "image/png"
    : lower.endsWith(".webp")
    ? "image/webp"
    : "image/jpeg";

  console.log(`\n-> Uploading ${file} (${contentType})...`);
  execFileSync(
    "npx",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucketName}/${file}`,
      `--file=${fullPath}`,
      "--remote",
      `--content-type=${contentType}`,
    ],
    { cwd: projectRoot, stdio: "inherit" }
  );
  uploaded += 1;
}

const uploadedSet = new Set(imageFiles);
const missing = expectedSlots.filter((s) => !uploadedSet.has(s.file));

console.log(`\n[r2:sync-refs] Done! Uploaded ${uploaded} image(s) to "${bucketName}".`);
if (missing.length > 0) {
  console.log(`[r2:sync-refs] Remaining slots (${missing.length}) still waiting for images:`);
  for (const s of missing) {
    console.log(`  - ${s.file}  (${s.label})`);
  }
} else if (expectedSlots.length > 0) {
  console.log("[r2:sync-refs] All 13 core slots are populated!");
}
