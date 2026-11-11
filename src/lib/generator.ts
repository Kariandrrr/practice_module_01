import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { books, chunks, options, questions, quizzes } from "@/db/schema";
import { UserError } from "./errors";
import { splitUnits } from "./text";

import { OPTION_COUNT, QUESTION_COUNT } from "./validate";

export type GeneratorMode = "heuristic" | "llm";

export type DraftQuestion = {
  chunkId: number;
  text: string;
  explanation: string;
  sourceQuote: string;
  options: string[];
  correctIndex: number;
};

type ChunkRow = { id: number; position: number; text: string };

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------------ */
/* Эвристический генератор («заглушка» вместо модели): вопросы с пропуском слова/числа */
/* ------------------------------------------------------------------ */

const STOP = new Set(
  [
    "которые", "которая", "которых", "которой", "которое", "которым", "является", "являются",
    "можно", "между", "после", "также", "потому", "поэтому", "однако", "только", "более",
    "всего", "очень", "несколько", "другие", "других", "каждый", "каждые", "каждое", "который",
    "своей", "своих", "чтобы", "когда", "всегда", "почти", "именно", "сразу", "затем", "вместе",
    "около", "через", "будет", "могут", "может", "больше", "самый", "самая", "самые", "самым",
    "этого", "этой", "этих", "такие", "таких", "должен", "должна", "перед", "иногда", "также",
    "which", "their", "there", "these", "those", "would", "about", "other", "being", "because",
  ],
);

const DEPENDENT_START = new Set([
  "она", "он", "оно", "они", "это", "эти", "этот", "эта", "там", "тут", "его", "её", "ее", "их",
  "поэтому", "однако", "кроме", "также", "тогда", "затем", "потом", "так", "такие", "такой",
  "he", "she", "it", "they", "this", "that", "these", "those", "however", "then",
]);

type Token = { text: string; lower: string; index: number; isNumber: boolean };

function tokenize(s: string): Token[] {
  const out: Token[] = [];
  const re = /\p{L}+|\d+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out.push({
      text: m[0],
      lower: m[0].toLowerCase(),
      index: m.index,
      isNumber: /^\d+$/.test(m[0]),
    });
  }
  return out;
}

function isCapitalized(w: string): boolean {
  return w.length > 1 && w[0] !== w[0].toLowerCase() && w.slice(1) === w.slice(1).toLowerCase();
}

type Stats = {
  freq: Map<string, number>;
  proper: Set<string>;
};

function buildStats(rows: ChunkRow[]): Stats {
  const freq = new Map<string, number>();
  const properCount = new Map<string, number>();
  for (const r of rows) {
    const toks = tokenize(r.text);
    for (const t of toks) {
      if (t.isNumber) continue;
      freq.set(t.lower, (freq.get(t.lower) ?? 0) + 1);
      if (isCapitalized(t.text)) {
        const before = r.text.slice(0, t.index).trimEnd();
        const sentenceStart = before === "" || /[.!?…:«"“(—-]$/.test(before);
        if (!sentenceStart) properCount.set(t.lower, (properCount.get(t.lower) ?? 0) + 1);
      }
    }
  }
  const proper = new Set<string>();
  for (const [w, c] of properCount) if (c >= (freq.get(w) ?? 0) / 2) proper.add(w);
  return { freq, proper };
}

type Cand = {
  chunk: ChunkRow;
  sentence: string;
  token: Token;
  score: number;
  tokens: Token[];
};

function candidatesOfChunk(chunk: ChunkRow, stats: Stats): Cand[] {
  const res: Cand[] = [];
  for (const u of splitUnits(chunk.text)) {
    const sentence = chunk.text.slice(u.start, u.end).replace(/\s+/g, " ").trim();
    const tokens = tokenize(sentence);
    const wordCount = tokens.length;
    if (wordCount < 7 || wordCount > 35 || sentence.length < 50 || sentence.length > 300) continue;
    // предложения, зависящие от предыдущего контекста («Она…», «Это…»), не берём
    if (tokens[0] && DEPENDENT_START.has(tokens[0].lower)) continue;
    let best: Cand | null = null;
    tokens.forEach((t, i) => {
      let score: number;
      if (t.isNumber) {
        if (t.text.length < 2 || t.text.length > 6 || t.text.startsWith("0")) return;
        score = 20;
      } else {
        if (i === 0 || t.lower.length < 6 || t.lower.length > 16 || STOP.has(t.lower)) return;
        const f = stats.freq.get(t.lower) ?? 1;
        score =
          Math.min(t.lower.length, 12) + (stats.proper.has(t.lower) ? 4 : 0) - 2 * Math.log(1 + f);
      }
      if (!best || score > best.score) best = { chunk, sentence, token: t, score, tokens };
    });
    if (best) res.push(best);
  }
  return res.sort((a, b) => b.score - a.score);
}

function capitalize(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function numberDistractors(n: number): string[] | null {
  const step = n >= 1000 && n <= 2100 ? 10 : Math.max(1, Math.round(n / 5));
  const pool = new Set<number>(
    [n + step, n - step, n + 2 * step, n - 2 * step, n * 2, Math.round(n / 2), n + 3 * step, n + 1, n - 1].filter(
      (x) => x > 0 && x !== n,
    ),
  );
  const arr = shuffle(Array.from(pool));
  if (arr.length < 3) return null;
  return arr.slice(0, 3).map(String);
}

function wordDistractors(c: Cand, stats: Stats): string[] | null {
  const ans = c.token.lower;
  const inSentence = new Set(c.tokens.map((t) => t.lower));
  const isProper = stats.proper.has(ans) || isCapitalized(c.token.text);
  const stemOf = (w: string) => w.slice(0, 4);
  const scored: { w: string; s: number }[] = [];
  for (const w of stats.freq.keys()) {
    if (w.length < 5 || w.length > 18 || Math.abs(w.length - ans.length) > 3) continue;
    if (STOP.has(w) || inSentence.has(w) || stemOf(w) === stemOf(ans)) continue;
    if (stats.proper.has(w) !== isProper) continue;
    let s = Math.random();
    if (w.slice(-2) === ans.slice(-2)) s += 2;
    else if (w.slice(-1) === ans.slice(-1)) s += 1;
    scored.push({ w, s });
  }
  scored.sort((a, b) => b.s - a.s);
  const picked: string[] = [];
  const stems = new Set<string>([stemOf(ans)]);
  for (const { w } of scored) {
    if (stems.has(stemOf(w))) continue;
    stems.add(stemOf(w));
    picked.push(isProper ? capitalize(w) : w);
    if (picked.length === 3) break;
  }
  return picked.length === 3 ? picked : null;
}

function buildQuestion(c: Cand, stats: Stats): DraftQuestion | null {
  const answer = c.token.text;
  const distractors = c.token.isNumber
    ? numberDistractors(parseInt(answer, 10))
    : wordDistractors(c, stats);
  if (!distractors) return null;

  // пропуск: заменяем все вхождения ответа в предложении
  let blanked = "";
  let pos = 0;
  for (const t of c.tokens) {
    if (t.lower === c.token.lower) {
      blanked += c.sentence.slice(pos, t.index) + "_____";
      pos = t.index + t.text.length;
    }
  }
  blanked += c.sentence.slice(pos);

  const all = shuffle([answer, ...distractors]);
  const kind = c.token.isNumber ? "число" : "слово";
  return {
    chunkId: c.chunk.id,
    text: `Вставьте пропущенное ${kind} в предложении из книги: «${blanked}»`,
    explanation: `Верный ответ — «${answer}». Исходное предложение: «${c.sentence}»`,
    sourceQuote: c.sentence,
    options: all,
    correctIndex: all.indexOf(answer),
  };
}

function spaced<T>(list: T[], count: number): T[] {
  if (list.length <= count) return list;
  const idx = new Set<number>();
  for (let i = 0; i < count; i++) idx.add(Math.floor(((i + 0.5) * list.length) / count));
  return [...list.filter((_, i) => idx.has(i)), ...list.filter((_, i) => !idx.has(i))];
}

export function generateHeuristic(rows: ChunkRow[]): DraftQuestion[] {
  const stats = buildStats(rows);
  const perChunk = rows.map((r) => candidatesOfChunk(r, stats)).filter((l) => l.length > 0);
  const ordered: Cand[] = [];
  for (let round = 0; round < 10; round++) {
    ordered.push(...spaced(perChunk.filter((l) => l[round]).map((l) => l[round]), QUESTION_COUNT));
  }
  const result: DraftQuestion[] = [];
  const usedAnswers = new Set<string>();
  const usedSentences = new Set<string>();
  for (const c of ordered) {
    if (result.length >= QUESTION_COUNT) break;
    if (usedAnswers.has(c.token.lower) || usedSentences.has(c.sentence)) continue;
    const q = buildQuestion(c, stats);
    if (!q) continue;
    usedAnswers.add(c.token.lower);
    usedSentences.add(c.sentence);
    result.push(q);
  }
  if (result.length < QUESTION_COUNT) {
    throw new UserError(
      `Недостаточно материала для теста: удалось составить только ${result.length} из ${QUESTION_COUNT} вопросов. Загрузите более длинную книгу.`,
      422,
    );
  }
  const pos = new Map(rows.map((r) => [r.id, r.position]));
  return result.sort((a, b) => (pos.get(a.chunkId) ?? 0) - (pos.get(b.chunkId) ?? 0));
}

/* ------------------------------------------------------------------ */
/* Генератор на LLM (OpenAI-совместимый API), включается переменной OPENAI_API_KEY */
/* ------------------------------------------------------------------ */

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

type LlmQuestion = {
  question?: unknown;
  options?: unknown;
  correctIndex?: unknown;
  explanation?: unknown;
  fragment?: unknown;
  quote?: unknown;
};

export async function generateWithLlm(rows: ChunkRow[]): Promise<DraftQuestion[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new UserError("Модель не настроена (нет OPENAI_API_KEY).", 503);
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // выборка до ~14 равномерно распределённых фрагментов
  const sample = rows.length <= 14 ? rows : spaced(rows, 14).slice(0, 14).sort((a, b) => a.position - b.position);
  const material = sample.map((r) => `[Ф${r.position}]\n${r.text}`).join("\n\n");

  const prompt =
    `Составь тест из ровно ${QUESTION_COUNT} вопросов по фрагментам книги ниже. ` +
    `У каждого вопроса ровно 4 разных варианта ответа, ровно один верный; остальные должны быть заведомо неверными по тексту. ` +
    `Используй только факты из фрагментов. Отвечай на языке книги. Верни ТОЛЬКО JSON вида: ` +
    `{"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"...","fragment":<номер фрагмента из метки [Ф N]>,"quote":"<дословная цитата из этого фрагмента, подтверждающая ответ>"}]}\n\n` +
    material;

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Ты составляешь учебные тесты строго по предоставленному тексту." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    throw new UserError(
      `Модель недоступна или вернула ошибку (${e instanceof Error ? e.message : "неизвестно"}). Тест остаётся черновиком — повторите попытку или используйте режим «заглушка».`,
      502,
    );
  }

  let parsed: { questions?: LlmQuestion[] };
  try {
    const raw = (data.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?|```$/gm, "").trim();
    parsed = JSON.parse(raw);
  } catch {
    throw new UserError("Ответ модели не удалось разобрать как JSON. Повторите попытку.", 502);
  }

  const list = parsed.questions;
  if (!Array.isArray(list) || list.length < QUESTION_COUNT) {
    throw new UserError(`Модель вернула меньше ${QUESTION_COUNT} вопросов. Повторите попытку.`, 502);
  }

  const result: DraftQuestion[] = [];
  for (const [i, q] of list.slice(0, QUESTION_COUNT).entries()) {
    const n = i + 1;
    const opts = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
    const ci = q.correctIndex;
    if (
      typeof q.question !== "string" || !q.question.trim() ||
      opts.length !== OPTION_COUNT || opts.some((o) => !o) ||
      new Set(opts.map(norm)).size !== OPTION_COUNT ||
      typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci >= OPTION_COUNT ||
      typeof q.explanation !== "string" || !q.explanation.trim() ||
      typeof q.quote !== "string" || !q.quote.trim()
    ) {
      throw new UserError(`Вопрос ${n} от модели некорректен (варианты, ключ или пояснение). Повторите попытку.`, 502);
    }
    const quote = norm(q.quote);
    const byNumber = rows.find((r) => r.position === Number(q.fragment));
    const chunk =
      (byNumber && norm(byNumber.text).includes(quote) ? byNumber : undefined) ??
      rows.find((r) => norm(r.text).includes(quote));
    if (!chunk) {
      throw new UserError(`Для вопроса ${n} модель привела цитату, которой нет в книге. Повторите попытку.`, 502);
    }
    result.push({
      chunkId: chunk.id,
      text: q.question.trim(),
      explanation: q.explanation.trim(),
      sourceQuote: q.quote.trim(),
      options: opts,
      correctIndex: ci,
    });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Оркестрация: генерация → сохранение черновика */
/* ------------------------------------------------------------------ */

export async function generateQuizForBook(bookId: number, mode: GeneratorMode) {
  const [book] = await db.select({ id: books.id }).from(books).where(eq(books.id, bookId));
  if (!book) throw new UserError("Книга не найдена", 404);

  const [existing] = await db.select().from(quizzes).where(eq(quizzes.bookId, bookId));
  if (existing?.status === "published") {
    throw new UserError("Тест уже опубликован. Сначала снимите его с публикации, затем создайте заново.", 409);
  }

  const rows = await db
    .select({ id: chunks.id, position: chunks.position, text: chunks.text })
    .from(chunks)
    .where(eq(chunks.bookId, bookId))
    .orderBy(asc(chunks.position));

  let drafts: DraftQuestion[];
  try {
    drafts = mode === "llm" ? await generateWithLlm(rows) : generateHeuristic(rows);
  } catch (e) {
    const message = e instanceof UserError ? e.message : "Ошибка генерации теста.";
    // тест остаётся черновиком (создаём пустой черновик с ошибкой, если его не было)
    if (existing) {
      await db.update(quizzes).set({ lastError: message, updatedAt: new Date() }).where(eq(quizzes.id, existing.id));
    } else {
      await db.insert(quizzes).values({ bookId, status: "draft", generator: mode, lastError: message });
    }
    if (e instanceof UserError) throw e;
    console.error(e);
    throw new UserError(message, 500);
  }

  return db.transaction(async (tx) => {
    if (existing) await tx.delete(quizzes).where(eq(quizzes.id, existing.id));
    const [quiz] = await tx
      .insert(quizzes)
      .values({ bookId, status: "draft", generator: mode, lastError: null })
      .returning({ id: quizzes.id });
    for (const [i, d] of drafts.entries()) {
      const [q] = await tx
        .insert(questions)
        .values({
          quizId: quiz.id,
          chunkId: d.chunkId,
          position: i + 1,
          text: d.text,
          explanation: d.explanation,
          sourceQuote: d.sourceQuote,
          approved: false,
        })
        .returning({ id: questions.id });
      await tx.insert(options).values(
        d.options.map((text, j) => ({
          questionId: q.id,
          position: j + 1,
          text,
          isCorrect: j === d.correctIndex,
        })),
      );
    }
    return { quizId: quiz.id };
  });
}
