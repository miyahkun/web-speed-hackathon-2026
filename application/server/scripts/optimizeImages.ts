import fs from "fs";
import path from "path";

import sharp from "sharp";

const PUBLIC_PATH = path.resolve(import.meta.dirname, "../../public");

const POST_IMAGE_MAX_WIDTH = 1280; // 640px display * 2x Retina
const PROFILE_IMAGE_SIZE = 256; // 128px display * 2x Retina

async function optimizePostImages() {
  const dir = path.join(PUBLIC_PATH, "images");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".webp"));

  console.log(`Optimizing ${files.length} post images (max width: ${POST_IMAGE_MAX_WIDTH}px)...`);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const meta = await sharp(filePath).metadata();

    if (meta.width && meta.width > POST_IMAGE_MAX_WIDTH) {
      const buffer = await sharp(filePath)
        .resize({ width: POST_IMAGE_MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      fs.writeFileSync(filePath, buffer);
      const newSize = Math.round(buffer.length / 1024);
      console.log(
        `  ${file}: ${meta.width}x${meta.height} -> ${POST_IMAGE_MAX_WIDTH}px wide (${newSize}KB)`,
      );
    } else {
      console.log(`  ${file}: ${meta.width}x${meta.height} (skip, already small enough)`);
    }
  }
}

async function optimizeProfileImages() {
  const dir = path.join(PUBLIC_PATH, "images", "profiles");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".webp"));

  console.log(`Optimizing ${files.length} profile images (max: ${PROFILE_IMAGE_SIZE}px)...`);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const meta = await sharp(filePath).metadata();

    if (meta.width && meta.width > PROFILE_IMAGE_SIZE) {
      const buffer = await sharp(filePath)
        .resize({ width: PROFILE_IMAGE_SIZE, height: PROFILE_IMAGE_SIZE, fit: "cover" })
        .webp({ quality: 80 })
        .toBuffer();

      fs.writeFileSync(filePath, buffer);
      const newSize = Math.round(buffer.length / 1024);
      console.log(
        `  ${file}: ${meta.width}x${meta.height} -> ${PROFILE_IMAGE_SIZE}x${PROFILE_IMAGE_SIZE} (${newSize}KB)`,
      );
    } else {
      console.log(`  ${file}: ${meta.width}x${meta.height} (skip, already small enough)`);
    }
  }
}

async function main() {
  await optimizePostImages();
  await optimizeProfileImages();
  console.log("Done!");
}

main();
