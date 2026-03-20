import * as MusicMetadata from "music-metadata";

interface SoundMetadata {
  artist?: string;
  title?: string;
}

/**
 * WAV (RIFF) ファイルの INFO チャンクから指定タグの生バイト列を読み取る
 */
function readRiffInfoTag(data: Buffer, tagId: string): Buffer | null {
  // "LIST" チャンクの中の "INFO" サブチャンクを探す
  let offset = 12; // RIFF ヘッダー (12 bytes) をスキップ
  while (offset + 8 <= data.length) {
    const chunkId = data.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = data.readUInt32LE(offset + 4);

    if (chunkId === "LIST") {
      const listType = data.subarray(offset + 8, offset + 12).toString("ascii");
      if (listType === "INFO") {
        // INFO チャンク内のタグを走査
        let tagOffset = offset + 12;
        const listEnd = offset + 8 + chunkSize;
        while (tagOffset + 8 <= listEnd) {
          const id = data.subarray(tagOffset, tagOffset + 4).toString("ascii");
          const size = data.readUInt32LE(tagOffset + 4);
          if (id === tagId) {
            const raw = data.subarray(tagOffset + 8, tagOffset + 8 + size);
            // null 終端を除去
            const end = raw.indexOf(0);
            return end !== -1 ? raw.subarray(0, end) : raw;
          }
          // RIFF チャンクは 2 バイト境界にアラインされる
          tagOffset += 8 + size + (size % 2);
        }
      }
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }
  return null;
}

/**
 * バイト列が有効な UTF-8 かどうかを簡易判定する
 */
function isValidUtf8(buf: Buffer): boolean {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return decoded.length > 0;
  } catch {
    return false;
  }
}

/**
 * RIFF INFO タグのバイト列を文字列にデコードする
 * UTF-8 として有効ならそのまま、そうでなければ Shift-JIS としてデコードする
 */
function decodeRiffInfoValue(buf: Buffer): string {
  if (isValidUtf8(buf)) {
    return buf.toString("utf8").trim();
  }
  return new TextDecoder("shift_jis").decode(buf).trim();
}

export async function extractMetadataFromSound(data: Buffer): Promise<SoundMetadata> {
  try {
    const metadata = await MusicMetadata.parseBuffer(data);
    let { artist, title } = metadata.common;

    // WAV の RIFF INFO チャンクは Shift-JIS の場合があるため、生バイト列から再デコードする
    const isRiff = data.length >= 4 && data.subarray(0, 4).toString("ascii") === "RIFF";
    if (isRiff) {
      const inamBuf = readRiffInfoTag(data, "INAM");
      if (inamBuf) {
        title = decodeRiffInfoValue(inamBuf);
      }
      const iartBuf = readRiffInfoTag(data, "IART");
      if (iartBuf) {
        artist = decodeRiffInfoValue(iartBuf);
      }
    }

    return { artist, title };
  } catch {
    return {
      artist: undefined,
      title: undefined,
    };
  }
}
