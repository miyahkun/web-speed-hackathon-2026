import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

import { Router } from "express";
import httpErrors from "http-errors";
import { v4 as uuidv4 } from "uuid";

import { UPLOAD_PATH } from "@web-speed-hackathon-2026/server/src/paths";

const execFileAsync = promisify(execFile);

const ALLOWED_MIMETYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/x-matroska",
  "video/quicktime",
  "video/x-msvideo",
  "video/mpeg",
  "image/gif",
]);

export const movieRouter = Router();

movieRouter.post("/movies", async (req, res) => {
  if (req.session.userId === undefined) {
    throw new httpErrors.Unauthorized();
  }
  if (Buffer.isBuffer(req.body) === false) {
    throw new httpErrors.BadRequest();
  }

  // 一時ファイルに書き出してffmpegで変換
  const tmpInput = path.join(os.tmpdir(), `${uuidv4()}_input`);
  const movieId = uuidv4();
  const outputPath = path.resolve(UPLOAD_PATH, `./movies/${movieId}.mp4`);

  try {
    await fs.mkdir(path.resolve(UPLOAD_PATH, "movies"), { recursive: true });
    await fs.writeFile(tmpInput, req.body);

    // 先頭5秒、正方形クロップ、10fps、無音、H.264 MP4に変換
    await execFileAsync("ffmpeg", [
      "-i", tmpInput,
      "-t", "5",
      "-r", "10",
      "-vf", "crop='min(iw,ih)':'min(iw,ih)',scale=320:320",
      "-an",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "28",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-y",
      outputPath,
    ]);
  } finally {
    await fs.unlink(tmpInput).catch(() => {});
  }

  return res.status(200).type("application/json").send({ id: movieId });
});
