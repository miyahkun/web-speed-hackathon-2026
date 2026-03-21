import { promises as fs } from "fs";
import type { ServerResponse } from "http";
import path from "path";

import history from "connect-history-api-fallback";
import { Router } from "express";
import serveStatic from "serve-static";

import { Post, User } from "@web-speed-hackathon-2026/server/src/models";
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
  ".opus",
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

async function resolveSessionUser(
  req: import("express").Request,
): Promise<Record<string, unknown> | null> {
  const userId = req.session.userId;
  if (userId == null) return null;
  const user = await User.findByPk(userId);
  return user ? (user.toJSON() as Record<string, unknown>) : null;
}

function injectUserScript(html: string, user: Record<string, unknown> | null): string {
  if (user == null) return html;
  const script = `<script>window.__SSR_USER__=${JSON.stringify(user)};</script>`;
  return html.replace("</head>", `${script}</head>`);
}

export const staticRouter = Router();

// SSR バンドル (ビルド時に生成)
type SsrModule = { renderHome: (posts: unknown[]) => string };
let ssrModule: SsrModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ssrModule = require(path.resolve(CLIENT_DIST_PATH, "ssr.cjs")) as SsrModule;
} catch {
  // SSR バンドルが無い場合はフォールバック
}

// ホームページ: SSR + 初期データ注入
staticRouter.get("/", async (req, res, next) => {
  try {
    const [posts, ssrUser] = await Promise.all([
      Post.findAll({ limit: 5 }),
      resolveSessionUser(req),
    ]);
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
    injected = injectUserScript(injected, ssrUser);

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
    const [post, ssrUser] = await Promise.all([
      Post.findByPk(req.params.postId),
      resolveSessionUser(req),
    ]);
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

    let html = await getIndexHtml();
    if (preloadTags.length > 0) {
      html = html.replace("</head>", `${preloadTags.join("")}</head>`);
    }
    html = injectUserScript(html, ssrUser);
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return res.send(html);
  } catch {
    // DB error — fall through to normal static serving
  }
  return next();
});

// 利用規約ページ: カスタムフォントをpreload
staticRouter.get("/terms", async (req, res, next) => {
  try {
    const ssrUser = await resolveSessionUser(req);
    let html = await getIndexHtml();
    const preloadTag = `<link rel="preload" as="font" href="/fonts/ReiNoAreMincho-Heavy.subset.woff2" type="font/woff2" crossorigin>`;
    html = html.replace("</head>", `${preloadTag}</head>`);
    html = injectUserScript(html, ssrUser);
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return res.send(html);
  } catch {
    return next();
  }
});

// SPA 対応のため、ファイルが存在しないときに index.html を返す
staticRouter.use(history() as unknown as import("express").RequestHandler);

// 上記の個別ルートで処理されなかったHTMLリクエストにユーザー情報を注入
staticRouter.use(async (req, res, next) => {
  // history() が書き換えたリクエストのみ対象
  if (!req.headers.accept?.includes("text/html")) return next();
  // 静的ファイルは除外
  if (path.extname(req.path) && req.path !== "/index.html") return next();
  try {
    const ssrUser = await resolveSessionUser(req);
    if (ssrUser == null) return next();
    let html = await getIndexHtml();
    html = injectUserScript(html, ssrUser);
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return res.send(html);
  } catch {
    return next();
  }
});

// Opus が未生成の場合、元ファイル（wav, ogg, flac 等）にフォールバックする
staticRouter.use("/sounds", async (req, res, next) => {
  if (!req.path.endsWith(".opus")) return next();

  const opusPath = path.resolve(UPLOAD_PATH, "sounds", path.basename(req.path));
  try {
    await fs.access(opusPath);
    return next(); // Opus が存在するのでそのまま配信
  } catch {
    // Opus がなければ同じ soundId で別拡張子のファイルを探す
    const soundId = path.basename(req.path, ".opus");
    const soundsDir = path.resolve(UPLOAD_PATH, "sounds");
    try {
      const files = await fs.readdir(soundsDir);
      const fallback = files.find((f) => f.startsWith(soundId + ".") && !f.endsWith(".opus"));
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
