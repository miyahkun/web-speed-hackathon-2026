import { promises as fs } from "fs";
import path from "path";

import { Router } from "express";
import { fileTypeFromBuffer } from "file-type";
import httpErrors from "http-errors";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import { UPLOAD_PATH } from "@web-speed-hackathon-2026/server/src/paths";

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"]);

/**
 * EXIF バッファから ImageDescription (tag 0x010E) を読み取る
 */
function readImageDescription(exifBuf: Buffer): string {
  const tiffOffset = exifBuf.indexOf("MM") !== -1 ? exifBuf.indexOf("MM") : exifBuf.indexOf("II");
  if (tiffOffset === -1) return "";

  const isBigEndian = exifBuf[tiffOffset] === 0x4d;

  const readUint16 = (offset: number) =>
    isBigEndian ? exifBuf.readUInt16BE(offset) : exifBuf.readUInt16LE(offset);
  const readUint32 = (offset: number) =>
    isBigEndian ? exifBuf.readUInt32BE(offset) : exifBuf.readUInt32LE(offset);

  try {
    const ifd0Offset = readUint32(tiffOffset + 4) + tiffOffset;
    const numEntries = readUint16(ifd0Offset);

    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifd0Offset + 2 + i * 12;
      const tag = readUint16(entryOffset);

      if (tag === 0x010e) {
        const count = readUint32(entryOffset + 4);
        const valueOffset = count <= 4 ? entryOffset + 8 : readUint32(entryOffset + 8) + tiffOffset;
        const raw = exifBuf.subarray(valueOffset, valueOffset + count);
        const end = raw.indexOf(0);
        const trimmed = end !== -1 ? raw.subarray(0, end) : raw;
        return trimmed.toString("utf8").trim();
      }
    }
  } catch {
    // EXIF パースエラーは無視
  }

  return "";
}

export const imageRouter = Router();

imageRouter.post("/images", async (req, res) => {
  if (req.session.userId === undefined) {
    throw new httpErrors.Unauthorized();
  }
  if (Buffer.isBuffer(req.body) === false) {
    throw new httpErrors.BadRequest();
  }

  const type = await fileTypeFromBuffer(req.body);
  if (type === undefined || !ALLOWED_EXTENSIONS.has(type.ext)) {
    throw new httpErrors.BadRequest("Invalid file type");
  }

  // EXIF から ImageDescription を読み取る
  // TIFF の場合、sharp は exif を返さないため、ファイルバイナリから直接 IFD を読む
  let alt = "";
  try {
    const meta = await sharp(req.body).metadata();
    if (meta.exif) {
      alt = readImageDescription(meta.exif);
    } else if (meta.format === "tiff") {
      alt = readImageDescription(req.body as Buffer);
    }
  } catch {
    // メタデータ読み取りエラーは無視
  }

  const imageId = uuidv4();

  // アップロード画像をリサイズ・WebP に変換して保存（表示領域の2倍 = 1280px幅に制限）
  const webpBuffer = await sharp(req.body)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const filePath = path.resolve(UPLOAD_PATH, `./images/${imageId}.webp`);
  await fs.mkdir(path.resolve(UPLOAD_PATH, "images"), { recursive: true });
  await fs.writeFile(filePath, webpBuffer);

  return res.status(200).type("application/json").send({ id: imageId, alt });
});
