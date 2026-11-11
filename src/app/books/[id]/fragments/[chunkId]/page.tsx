import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { books, chunks, questions } from "@/db/schema";
import { Card, findQuote } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FragmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; chunkId: string }>;
  searchParams: Promise<{ question?: string }>;
}) {
  const { id: rawId, chunkId: rawChunk } = await params;
  const { question } = await searchParams;
  const bookId = Number(rawId);
  const chunkId = Number(rawChunk);
  if (!Number.isInteger(bookId) || !Number.isInteger(chunkId)) notFound();

  const [chunk] = await db
    .select()
    .from(chunks)
    .where(and(eq(chunks.id, chunkId), eq(chunks.bookId, bookId)));
  if (!chunk) notFound();
  const [book] = await db.select({ title: books.title }).from(books).where(eq(books.id, bookId));

  const [prev] = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(and(eq(chunks.bookId, bookId), eq(chunks.position, chunk.position - 1)));
  const [next] = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(and(eq(chunks.bookId, bookId), eq(chunks.position, chunk.position + 1)));

  let range: [number, number] | null = null;
  const qid = Number(question);
  if (Number.isInteger(qid) && qid > 0) {
    const [q] = await db
      .select({ quote: questions.sourceQuote })
      .from(questions)
      .where(and(eq(questions.id, qid), eq(questions.chunkId, chunkId)));
    if (q) range = findQuote(chunk.text, q.quote);
  }

  return (
    <div className="space-y-4">
      <Link href={`/books/${bookId}`} className="text-sm text-indigo-700 hover:underline">
        ← {book?.title ?? "К книге"}
      </Link>
      <Card>
        <h1 className="text-xl font-bold">Фрагмент №{chunk.position}</h1>
        <p className="text-sm text-slate-500">
          Положение в книге: символы {chunk.startChar}–{chunk.endChar}
        </p>
        <p className="mt-4 whitespace-pre-line leading-relaxed">
          {range ? (
            <>
              {chunk.text.slice(0, range[0])}
              <mark className="rounded bg-yellow-200 px-0.5">{chunk.text.slice(range[0], range[1])}</mark>
              {chunk.text.slice(range[1])}
            </>
          ) : (
            chunk.text
          )}
        </p>
      </Card>
      <div className="flex justify-between text-sm">
        {prev ? (
          <Link href={`/books/${bookId}/fragments/${prev.id}`} className="text-indigo-700 hover:underline">
            ← Предыдущий
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/books/${bookId}/fragments/${next.id}`} className="text-indigo-700 hover:underline">
            Следующий →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
