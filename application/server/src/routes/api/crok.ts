import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BM25 } from "bayesian-bm25";
import { Router } from "express";
import httpErrors from "http-errors";
import kuromoji, { type Tokenizer, type IpadicFeatures } from "kuromoji";
import analyze from "negaposi-analyzer-ja";

import { QaSuggestion } from "@web-speed-hackathon-2026/server/src/models";

export const crokRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const response = fs.readFileSync(path.join(__dirname, "crok-response.md"), "utf-8");

const STOP_POS = new Set(["助詞", "助動詞", "記号"]);

function extractTokens(tokens: IpadicFeatures[]): string[] {
  return tokens
    .filter((t) => t.surface_form !== "" && t.pos !== "" && !STOP_POS.has(t.pos))
    .map((t) => t.surface_form.toLowerCase());
}

const tokenizerReady: Promise<Tokenizer<IpadicFeatures>> = new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: "node_modules/kuromoji/dict" }).build((err, tokenizer) => {
    if (err) reject(err);
    else resolve(tokenizer);
  });
});

crokRouter.get("/crok/suggestions", async (req, res) => {
  const suggestions = await QaSuggestion.findAll({ logging: false });
  const candidates = suggestions.map((s) => s.question);

  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  if (!q) {
    res.json({ suggestions: candidates });
    return;
  }

  const tokenizer = await tokenizerReady;
  const queryTokens = extractTokens(tokenizer.tokenize(q));
  if (queryTokens.length === 0) {
    res.json({ suggestions: [] });
    return;
  }

  const bm25 = new BM25({ k1: 1.2, b: 0.75 });
  const tokenizedCandidates = candidates.map((c) => extractTokens(tokenizer.tokenize(c)));
  bm25.index(tokenizedCandidates);

  const scores = bm25.getScores(queryTokens) as number[];
  const results = candidates
    .map((text, i) => ({ text, score: scores[i]! }))
    .filter((s) => s.score > 0)
    .sort((a, b) => a.score - b.score)
    .slice(-10)
    .map((s) => s.text);

  res.json({ suggestions: results, queryTokens });
});

crokRouter.get("/crok/sentiment", async (req, res) => {
  const text = typeof req.query["text"] === "string" ? req.query["text"].trim() : "";
  if (!text) {
    res.json({ score: 0, label: "neutral" });
    return;
  }

  const tokenizer = await tokenizerReady;
  const tokens = tokenizer.tokenize(text);
  const score: number = analyze(tokens);

  let label: "positive" | "negative" | "neutral";
  if (score > 0.1) label = "positive";
  else if (score < -0.1) label = "negative";
  else label = "neutral";

  res.json({ score, label });
});

crokRouter.get("/crok", async (req, res) => {
  if (req.session.userId === undefined) {
    throw new httpErrors.Unauthorized();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let messageId = 0;

  for (const char of response) {
    if (res.closed) break;

    const data = JSON.stringify({ text: char, done: false });
    res.write(`event: message\nid: ${messageId++}\ndata: ${data}\n\n`);
  }

  if (!res.closed) {
    const data = JSON.stringify({ text: "", done: true });
    res.write(`event: message\nid: ${messageId}\ndata: ${data}\n\n`);
  }

  res.end();
});
