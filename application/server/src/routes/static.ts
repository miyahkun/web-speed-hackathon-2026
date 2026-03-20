import history from "connect-history-api-fallback";
import { Router } from "express";
import path from "path";
import serveStatic from "serve-static";

import {
  CLIENT_DIST_PATH,
  PUBLIC_PATH,
  UPLOAD_PATH,
} from "@web-speed-hackathon-2026/server/src/paths";

function setCacheHeaders(res: serveStatic.ServerResponse, filePath: string) {
  const ext = path.extname(filePath);
  const basename = path.basename(filePath);

  // ハッシュ付きチャンクファイル: 長期キャッシュ
  if (basename.match(/chunk-[a-f0-9]+\.js$/) || basename.match(/\.[a-f0-9]{8,}\.(js|css)$/)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }

  // index.html: キャッシュしない
  if (basename === "index.html") {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return;
  }

  // 静的アセット (画像・動画・フォント・音声・辞書など): 長めのキャッシュ
  const longCacheExts = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg", ".ico",
    ".mp4", ".webm", ".mp3", ".wav", ".ogg",
    ".woff", ".woff2", ".ttf", ".eot",
    ".wasm", ".dict", ".dat", ".bin"];
  if (longCacheExts.includes(ext.toLowerCase())) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    return;
  }

  // その他: 短めのキャッシュ
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
