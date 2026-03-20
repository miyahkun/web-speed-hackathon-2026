import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

/**
 * EXIF バッファから ImageDescription (tag 0x010E) を読み取る
 * TIFF IFD0 を簡易パースする
 */
function readImageDescription(exifBuf) {
  // Exif header: "Exif\0\0" + TIFF header
  const tiffOffset = exifBuf.indexOf("MM") !== -1 ? exifBuf.indexOf("MM") : exifBuf.indexOf("II");
  if (tiffOffset === -1) return "";

  const isBigEndian = exifBuf[tiffOffset] === 0x4d; // 'M'

  function readUint16(offset) {
    return isBigEndian
      ? exifBuf.readUInt16BE(offset)
      : exifBuf.readUInt16LE(offset);
  }

  function readUint32(offset) {
    return isBigEndian
      ? exifBuf.readUInt32BE(offset)
      : exifBuf.readUInt32LE(offset);
  }

  // IFD0 offset
  const ifd0Offset = readUint32(tiffOffset + 4) + tiffOffset;
  const numEntries = readUint16(ifd0Offset);

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifd0Offset + 2 + i * 12;
    const tag = readUint16(entryOffset);

    if (tag === 0x010e) {
      // ImageDescription
      const type = readUint16(entryOffset + 2);
      const count = readUint32(entryOffset + 4);

      let valueOffset;
      if (count <= 4) {
        valueOffset = entryOffset + 8;
      } else {
        valueOffset = readUint32(entryOffset + 8) + tiffOffset;
      }

      const raw = exifBuf.subarray(valueOffset, valueOffset + count);
      // null 終端を除去
      const end = raw.indexOf(0);
      const trimmed = end !== -1 ? raw.subarray(0, end) : raw;
      return trimmed.toString("utf8").trim();
    }
  }

  return "";
}

async function extractAlt(gitRef, imagePath) {
  const tmpFile = join(tmpdir(), `exif_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
  try {
    execSync(`git show ${gitRef}:${imagePath} > "${tmpFile}"`, {
      maxBuffer: 20 * 1024 * 1024,
    });
    const meta = await sharp(tmpFile).metadata();
    if (meta.exif) {
      return readImageDescription(meta.exif);
    }
  } catch (e) {
    console.error(`Failed to process ${imagePath}: ${e.message}`);
  } finally {
    try { execSync(`rm -f "${tmpFile}"`); } catch {}
  }
  return "";
}

async function main() {
  const seedsDir = new URL("../server/seeds/", import.meta.url).pathname;

  // images.jsonl
  {
    const lines = readFileSync(join(seedsDir, "images.jsonl"), "utf8").trim().split("\n");
    const updated = [];
    for (const line of lines) {
      const entry = JSON.parse(line);
      const alt = await extractAlt("base", `application/public/images/${entry.id}.jpg`);
      entry.alt = alt;
      updated.push(JSON.stringify(entry));
      if (alt) console.log(`Image ${entry.id}: "${alt}"`);
    }
    writeFileSync(join(seedsDir, "images.jsonl"), updated.join("\n") + "\n");
    console.log(`Updated images.jsonl (${updated.length} entries)`);
  }

  // profileImages.jsonl
  {
    const lines = readFileSync(join(seedsDir, "profileImages.jsonl"), "utf8").trim().split("\n");
    const updated = [];
    for (const line of lines) {
      const entry = JSON.parse(line);
      const alt = await extractAlt("base", `application/public/images/profiles/${entry.id}.jpg`);
      entry.alt = alt;
      updated.push(JSON.stringify(entry));
      if (alt) console.log(`Profile ${entry.id}: "${alt}"`);
    }
    writeFileSync(join(seedsDir, "profileImages.jsonl"), updated.join("\n") + "\n");
    console.log(`Updated profileImages.jsonl (${updated.length} entries)`);
  }
}

main();
