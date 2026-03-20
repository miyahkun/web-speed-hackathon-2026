import history from "connect-history-api-fallback";
import { Router } from "express";
import type { ServerResponse } from "http";
import path from "path";
import serveStatic from "serve-static";

import {
  CLIENT_DIST_PATH,
  PUBLIC_PATH,
  UPLOAD_PATH,
} from "@web-speed-hackathon-2026/server/src/paths";

const LONG_CACHE_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg", ".ico",
  ".mp4", ".webm", ".mp3", ".wav", ".ogg",
  ".woff", ".woff2", ".ttf", ".eot",
  ".wasm", ".dat", ".bin",
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
