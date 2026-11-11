import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { books, chunks } from "@/db/schema";
import { splitIntoChunks } from "./text";
import { UserError } from "./errors";

/**
 * Создание книги из уже проверенного текста: фрагментация и сохранение в одной транзакции.
 * При любой ошибке транзакция откатывается — недоделанная книга в каталоге не появляется.
 * Повторная загрузка того же текста заменяет старую книгу.
 */
export async function createBook(params: {
  title: string;
  filename: string;
  content: string;
}): Promise<{ id: number; chunkCount: number; replaced: boolean }> {
  const { title, filename, content } = params;
  const hash = createHash("sha256").update(content).digest("hex");
  const parts = splitIntoChunks(content);
  if (parts.length === 0) {
    throw new UserError("Не удалось выделить фрагменты из текста книги.");
  }

  return db.transaction(async (tx) => {
    const old = await tx.select({ id: books.id }).from(books).where(eq(books.contentHash, hash));
    for (const o of old) await tx.delete(books).where(eq(books.id, o.id));

    const [book] = await tx
      .insert(books)
      .values({
        title,
        filename,
        content,
        contentHash: hash,
        charCount: content.length,
        status: "processing",
      })
      .returning({ id: books.id });

    for (let i = 0; i < parts.length; i += 400) {
      await tx.insert(chunks).values(
        parts.slice(i, i + 400).map((p) => ({
          bookId: book.id,
          position: p.position,
          startChar: p.startChar,
          endChar: p.endChar,
          text: p.text,
        })),
      );
    }
    await tx.update(books).set({ status: "ready" }).where(eq(books.id, book.id));
    return { id: book.id, chunkCount: parts.length, replaced: old.length > 0 };
  });
}

export function titleFromFilename(filename: string): string {
  return filename.replace(/\.txt$/i, "").replace(/[_]+/g, " ").trim() || "Без названия";
}
