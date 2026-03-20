import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

import { Router } from "express";
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

  const tmpInput = path.join(os.tmpdir(), `${uuidv4()}_input`);
  const soundId = uuidv4();
  const outputPath = path.resolve(UPLOAD_PATH, `./sounds/${soundId}.mp3`);

  try {
    await fs.mkdir(path.resolve(UPLOAD_PATH, "sounds"), { recursive: true });
    await fs.writeFile(tmpInput, req.body);

    // MP3に変換
    await execFileAsync("ffmpeg", [
      "-i", tmpInput,
      "-vn",
      "-c:a", "libmp3lame",
      "-q:a", "4",
      "-y",
      outputPath,
    ]);
  } finally {
    await fs.unlink(tmpInput).catch(() => {});
  }

  return res.status(200).type("application/json").send({ artist, id: soundId, title });
});
