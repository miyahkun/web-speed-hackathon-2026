import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

import { Router } from "express";
import { fileTypeFromBuffer } from "file-type";
import httpErrors from "http-errors";
import { v4 as uuidv4 } from "uuid";

import { UPLOAD_PATH } from "@web-speed-hackathon-2026/server/src/paths";
import { extractMetadataFromSound } from "@web-speed-hackathon-2026/server/src/utils/extract_metadata_from_sound";

const execFileAsync = promisify(execFile);

export const soundRouter = Router();

soundRouter.post("/sounds", async (req, res) => {
  if (req.session.userId === undefined) {
    throw new httpErrors.Unauthorized();
  }
  if (Buffer.isBuffer(req.body) === false) {
    throw new httpErrors.BadRequest();
  }

  // メタデータを先に抽出（元ファイルから）
  const { artist, title } = await extractMetadataFromSound(req.body);

  // アップロードされたファイルの拡張子を判定
  const type = await fileTypeFromBuffer(req.body);
  const origExt = type?.ext ?? "bin";

  const soundId = uuidv4();
  const soundsDir = path.resolve(UPLOAD_PATH, "sounds");
  const origPath = path.resolve(soundsDir, `${soundId}.${origExt}`);
  const mp3Path = path.resolve(soundsDir, `${soundId}.mp3`);

  await fs.mkdir(soundsDir, { recursive: true });

  // 元ファイルをそのまま保存（即座に再生可能にする）
  await fs.writeFile(origPath, req.body);

  // バックグラウンドで MP3 に変換し、完了したら元ファイルを削除
  execFileAsync("ffmpeg", [
    "-i", origPath,
    "-vn",
    "-c:a", "libmp3lame",
    "-b:a", "128k",
    "-compression_level", "0",
    "-y",
    mp3Path,
  ]).then(() => {
    fs.unlink(origPath).catch(() => {});
  }).catch(() => {});
  // 変換完了を待たずにレスポンスを返す
  return res.status(200).type("application/json").send({ artist, id: soundId, title });
});
