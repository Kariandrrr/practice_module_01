import { UserError } from "./errors";

export const MAX_FILE_BYTES = 500 * 1024;

/** Проверка и декодирование загруженного файла (QUIZ-01). Возвращает нормализованный текст. */
export function validateAndDecode(
  filename: string,
  mime: string,
  bytes: Uint8Array,
): string {
  if (!/\.txt$/i.test(filename)) {
    throw new UserError(
      "Неподдерживаемый формат файла. Загрузите текстовый файл с расширением .txt (UTF-8).",
    );
  }
  if (mime && !mime.startsWith("text/") && mime !== "application/octet-stream") {
    throw new UserError(
      `Неподдерживаемый тип файла (${mime}). Допускается только текстовый TXT.`,
    );
  }
  if (bytes.length === 0) {
    throw new UserError("Файл пустой. Выберите TXT-файл с текстом книги.");
  }
  if (bytes.length > MAX_FILE_BYTES) {
    throw new UserError(
      `Файл слишком большой (${Math.ceil(bytes.length / 1024)} КБ). Максимальный размер — 500 КБ.`,
    );
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new UserError(
      "Файл не в кодировке UTF-8. Пересохраните его как «Текст UTF-8» и повторите загрузку.",
    );
  }
  if (text.includes("\u0000")) {
    throw new UserError("Файл не похож на текстовый (содержит бинарные данные).");
  }
  const normalized = normalizeText(text);
  if (normalized.length === 0) {
    throw new UserError("Файл не содержит текста (только пробелы и переводы строк).");
  }
  return normalized;
}

export function normalizeText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

export type Unit = { start: number; end: number; paraStart: boolean };

/**
 * Делит текст на предложения с координатами [start, end).
 * Абзацы разделяются пустой строкой.
 */
export function splitUnits(content: string, maxLen = 1200): Unit[] {
  const units: Unit[] = [];
  const paraRe = /\S[\s\S]*?(?=\n\s*\n|$)/g;
  let pm: RegExpExecArray | null;
  while ((pm = paraRe.exec(content)) !== null) {
    const pStart = pm.index;
    const pText = pm[0];
    let first = true;
    const sentRe = /[^.!?…]+(?:[.!?…]+["»”’')\]]*|$)/g;
    let sm: RegExpExecArray | null;
    while ((sm = sentRe.exec(pText)) !== null) {
      const raw = sm[0];
      const lead = raw.length - raw.trimStart().length;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const start = pStart + sm.index + lead;
      const end = start + trimmed.length;
      // слишком длинное «предложение» режем жёстко
      for (let s = start; s < end; s += maxLen) {
        units.push({ start: s, end: Math.min(end, s + maxLen), paraStart: first });
        first = false;
      }
    }
  }
  return units;
}

export type RawChunk = {
  position: number;
  startChar: number;
  endChar: number;
  text: string;
};

/** Разбиение книги на фрагменты ~900 символов по границам предложений (QUIZ-02). */
export function splitIntoChunks(content: string, target = 900): RawChunk[] {
  const units = splitUnits(content);
  const result: RawChunk[] = [];
  let cur: { start: number; end: number } | null = null;

  const flush = () => {
    if (!cur) return;
    result.push({
      position: result.length + 1,
      startChar: cur.start,
      endChar: cur.end,
      text: content.slice(cur.start, cur.end),
    });
    cur = null;
  };

  for (const u of units) {
    if (cur) {
      const len = cur.end - cur.start;
      if (u.end - cur.start > target || (u.paraStart && len >= 600)) flush();
    }
    if (!cur) cur = { start: u.start, end: u.end };
    else cur.end = u.end;
  }
  flush();
  return result;
}

export function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}
