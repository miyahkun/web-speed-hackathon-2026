import { promises as fs } from "fs";
import type { ServerResponse } from "http";
import path from "path";

import history from "connect-history-api-fallback";
import { Router } from "express";
import serveStatic from "serve-static";

import {
  CLIENT_DIST_PATH,
  PUBLIC_PATH,
  UPLOAD_PATH,
} from "@web-speed-hackathon-2026/server/src/paths";

const LONG_CACHE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".gif",
  ".svg",
  ".ico",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".wasm",
  ".dat",
  ".bin",
]);

function setCacheHeaders(res: ServerResponse, filePath: string) {
  const basename = path.basename(filePath);

  // コンテンツハッシュ付きファイル (main.xxxx.js, chunk-xxxx.js, main.xxxx.css 等) は長期キャッシュ
  if (/\.[a-f0-9]{8,}\.(js|css)$/.test(basename)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }

  // index.html は常に最新を取得
  if (basename === "index.html") {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return;
  }

  // 画像・動画・フォント・WASM 等は1日キャッシュ
  const ext = path.extname(filePath).toLowerCase();
  if (LONG_CACHE_EXTS.has(ext)) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    return;
  }

  // その他 (main.js, main.css 等ハッシュなしファイル)
  res.setHeader("Cache-Control", "public, max-age=3600");
}

export const staticRouter = Router();

// SPA 対応のため、ファイルが存在しないときに index.html を返す
staticRouter.use(history());

// MP3 が未生成の場合、元ファイル（wav, ogg, flac 等）にフォールバックする
staticRouter.use("/sounds", async (req, res, next) => {
  if (!req.path.endsWith(".mp3")) return next();

  const mp3Path = path.resolve(UPLOAD_PATH, "sounds", path.basename(req.path));
  try {
    await fs.access(mp3Path);
    return next(); // MP3 が存在するのでそのまま配信
  } catch {
    // MP3 がなければ同じ soundId で別拡張子のファイルを探す
    const soundId = path.basename(req.path, ".mp3");
    const soundsDir = path.resolve(UPLOAD_PATH, "sounds");
    try {
      const files = await fs.readdir(soundsDir);
      const fallback = files.find((f) => f.startsWith(soundId + ".") && !f.endsWith(".mp3"));
      if (fallback) {
        const fallbackPath = path.resolve(soundsDir, fallback);
        res.setHeader("Cache-Control", "no-cache");
        const data = await fs.readFile(fallbackPath);
        return res.send(data);
      }
    } catch {}
    return next();
  }
});

staticRouter.use(
  serveStatic(UPLOAD_PATH, {
    etag: true,
    lastModified: true,
    setHeaders: setCacheHeaders,
  }),
);

staticRouter.use(
  serveStatic(PUBLIC_PATH, {
    etag: true,
    lastModified: true,
    setHeaders: setCacheHeaders,
  }),
);

staticRouter.use(
  serveStatic(CLIENT_DIST_PATH, {
    etag: true,
    lastModified: true,
    setHeaders: setCacheHeaders,
  }),
);
