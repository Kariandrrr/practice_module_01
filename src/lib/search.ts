import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chunks } from "@/db/schema";
import { wordsOf } from "./text";

function stem(w: string): string {
  if (w.length > 6) return w.slice(0, w.length - 2);
  if (w.length > 4) return w.slice(0, w.length - 1);
  return w;
}

export type SearchHit = {
  id: number;
  position: number;
  startChar: number;
  endChar: number;
  text: string;
  score: number;
};

export function queryStems(query: string): string[] {
  return Array.from(new Set(wordsOf(query).filter((w) => w.length >= 2).map(stem)));
}

/** Базовый поиск по словам внутри выбранной книги (QUIZ-02). */
export async function searchBook(bookId: number, query: string, limit = 5): Promise<SearchHit[]> {
  const stems = queryStems(query);
  if (stems.length === 0) return [];
  const rows = await db.select().from(chunks).where(eq(chunks.bookId, bookId));
  const n = rows.length;

  const tokenized = rows.map((r) => ({ row: r, words: wordsOf(r.text) }));
  const df = stems.map(
    (s) => tokenized.filter((t) => t.words.some((w) => w.startsWith(s))).length,
  );

  const hits: SearchHit[] = [];
  for (const t of tokenized) {
    let score = 0;
    stems.forEach((s, i) => {
      const count = t.words.filter((w) => w.startsWith(s)).length;
      if (count > 0) score += (1 + Math.log(count)) * Math.log(1 + n / (1 + df[i]));
    });
    if (score > 0) {
      hits.push({
        id: t.row.id,
        position: t.row.position,
        startChar: t.row.startChar,
        endChar: t.row.endChar,
        text: t.row.text,
        score,
      });
    }
  }
  hits.sort((a, b) => b.score - a.score || a.position - b.position);
  return hits.slice(0, limit);
}
