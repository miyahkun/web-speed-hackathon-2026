import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const PUBLIC_PATH = path.resolve(import.meta.dirname, "../../public");
const MOVIES_DIR = path.join(PUBLIC_PATH, "movies");

async function main() {
  const files = fs.readdirSync(MOVIES_DIR).filter((f) => f.endsWith(".gif"));
  console.log(`Converting ${files.length} GIF files to MP4...`);

  for (const file of files) {
    const gifPath = path.join(MOVIES_DIR, file);
    const mp4Path = path.join(MOVIES_DIR, file.replace(".gif", ".mp4"));
    const sizeBefore = Math.round(fs.statSync(gifPath).size / 1024);

    await execFileAsync("ffmpeg", [
      "-i", gifPath,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "28",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-an",
      "-y",
      mp4Path,
    ]);

    const sizeAfter = Math.round(fs.statSync(mp4Path).size / 1024);
    console.log(`  ${file}: ${sizeBefore}KB -> ${sizeAfter}KB (MP4)`);

    // 元のGIFを削除
    fs.unlinkSync(gifPath);
  }

  console.log("Done!");
}

main();
