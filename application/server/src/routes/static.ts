import { promises as fs } from "fs";
import type { ServerResponse } from "http";
import path from "path";

import history from "connect-history-api-fallback";
import { Router } from "express";
import serveStatic from "serve-static";

import { Post } from "@web-speed-hackathon-2026/server/src/models";
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

const CACHE_BUSTER = "v=4";

let indexHtmlCache: string | null = null;
async function getIndexHtml(): Promise<string> {
  if (indexHtmlCache == null) {
    indexHtmlCache = await fs.readFile(path.resolve(CLIENT_DIST_PATH, "index.html"), "utf-8");
  }
  return indexHtmlCache;
}

export const staticRouter = Router();

// SSR バンドル (ビルド時に生成)
let ssrModule: { renderHome: (posts: unknown[]) => string } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ssrModule = require(path.resolve(CLIENT_DIST_PATH, "ssr.cjs")) as typeof ssrModule;
} catch {
  // SSR バンドルが無い場合はフォールバック
}

// ホームページ: SSR + 初期データ注入
staticRouter.get("/", async (_req, res, next) => {
  try {
    const posts = await Post.findAll({ limit: 30 });
    const postsJSON = posts.map((p) => p.toJSON());
    const html = await getIndexHtml();

    // SSR で HTML を生成
    let appHtml = "";
    if (ssrModule) {
      try {
        appHtml = ssrModule.renderHome(postsJSON);
      } catch {
        // SSR 失敗時はクライアントレンダリングにフォールバック
      }
    }

    // 初期データをインライン注入 (API コール不要に)
    const dataScript = `<script>window.__SSR_POSTS__=${JSON.stringify(postsJSON)};</script>`;

    let injected = html;
    if (appHtml) {
      injected = injected.replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`);
    }
    injected = injected.replace("</head>", `${dataScript}</head>`);

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return res.send(injected);
  } catch {
    // DB error — fall through
  }
  return next();
});

// 投稿詳細ページ: LCP画像のpreloadヒントをHTMLに注入
staticRouter.get("/posts/:postId", async (req, res, next) => {
  try {
    const post = await Post.findByPk(req.params.postId);
    if (post == null) return next();

    const postData = post.toJSON() as Record<string, unknown>;
    const images = postData["images"] as Array<{ id: string }> | undefined;
    const movie = postData["movie"] as { id: string } | undefined;
    const user = postData["user"] as { profileImage?: { id: string } } | undefined;

    const preloadTags: string[] = [];

    // 最初の画像をpreload
    if (images && images.length > 0) {
      preloadTags.push(
        `<link rel="preload" as="image" href="/images/${images[0]!.id}.webp?${CACHE_BUSTER}">`,
      );
    }

    // 動画をpreload
    if (movie) {
      preloadTags.push(
        `<link rel="preload" as="video" href="/movies/${movie.id}.mp4?${CACHE_BUSTER}">`,
      );
    }

    // プロフィール画像をpreload
    if (user?.profileImage) {
      preloadTags.push(
        `<link rel="preload" as="image" href="/images/profiles/${user.profileImage.id}.webp?${CACHE_BUSTER}">`,
      );
    }

    if (preloadTags.length > 0) {
      const html = await getIndexHtml();
      const injected = html.replace("</head>", `${preloadTags.join("")}</head>`);
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      return res.send(injected);
    }
  } catch {
    // DB error — fall through to normal static serving
  }
  return next();
});

// 利用規約ページ: カスタムフォントをpreload
staticRouter.get("/terms", async (_req, res, next) => {
  try {
    const html = await getIndexHtml();
    const preloadTag = `<link rel="preload" as="font" href="/fonts/ReiNoAreMincho-Heavy.subset.woff2" type="font/woff2" crossorigin>`;
    const injected = html.replace("</head>", `${preloadTag}</head>`);
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return res.send(injected);
  } catch {
    return next();
  }
});

// SPA 対応のため、ファイルが存在しないときに index.html を返す
staticRouter.use(history() as unknown as import("express").RequestHandler);

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
