import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public/images");
const profilesDir = path.resolve(__dirname, "../public/images/profiles");

async function convertDirectory(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jpg"));
  console.log(`Converting ${files.length} JPG files in ${dir}`);

  for (const file of files) {
    const inputPath = path.join(dir, file);
    const outputPath = path.join(dir, file.replace(/\.jpg$/, ".webp"));

    await sharp(inputPath).webp({ quality: 80 }).toFile(outputPath);

    fs.unlinkSync(inputPath);
    console.log(`  ${file} -> ${file.replace(/\.jpg$/, ".webp")}`);
  }
}

await convertDirectory(publicDir);
await convertDirectory(profilesDir);

console.log("Done!");
