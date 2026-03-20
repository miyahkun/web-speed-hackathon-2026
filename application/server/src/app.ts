import bodyParser from "body-parser";
import Express from "express";

import { apiRouter } from "@web-speed-hackathon-2026/server/src/routes/api";
import { staticRouter } from "@web-speed-hackathon-2026/server/src/routes/static";
import { sessionMiddleware } from "@web-speed-hackathon-2026/server/src/session";

export const app = Express();

app.set("trust proxy", true);

// リクエスト応答時間ログ (PERF_LOG=1 で有効, PERF_LOG=verbose で全リクエスト出力)
const PERF_LOG = process.env["PERF_LOG"] ?? "";
if (PERF_LOG) {
  const isVerbose = PERF_LOG === "verbose";
  app.use((req, res, next) => {
    const start = performance.now();
    res.on("finish", () => {
      const duration = performance.now() - start;
      const isApi = req.path.startsWith("/api/");
      const isSlow = duration > 100;

      if (isVerbose || isApi || isSlow) {
        console.log(JSON.stringify({
          type: "request",
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: Math.round(duration),
          size: Number(res.getHeader("content-length")) || null,
          ip: req.ip ?? null,
          ua: req.get("user-agent") ?? null,
        }));
      }
    });
    next();
  });
}

app.use(sessionMiddleware);
app.use(bodyParser.json());
app.use(bodyParser.raw({ limit: "20mb" }));

app.use("/api/v1", (_req, res, next) => {
  res.header({
    "Cache-Control": "max-age=0, no-transform",
    Connection: "close",
  });
  return next();
}, apiRouter);
app.use(staticRouter);
