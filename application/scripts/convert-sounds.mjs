import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const soundsDir = path.resolve(__dirname, "../public/sounds");

const files = fs.readdirSync(soundsDir).filter((f) => f.endsWith(".mp3"));
console.log(`Converting ${files.length} MP3 files to Opus`);

for (const file of files) {
  const inputPath = path.join(soundsDir, file);
  const outputPath = path.join(soundsDir, file.replace(/\.mp3$/, ".opus"));

  execFileSync("ffmpeg", [
    "-i", inputPath,
    "-vn",
    "-c:a", "libopus",
    "-b:a", "96k",
    "-y",
    outputPath,
  ]);

  fs.unlinkSync(inputPath);
  console.log(`  ${file} -> ${file.replace(/\.mp3$/, ".opus")}`);
}

console.log("Done!");
