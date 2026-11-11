import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { books, chunks, quizzes } from "@/db/schema";
import QuizEditor, { type EditorQuestion } from "@/components/QuizEditor";
import { Card, QuizStatusBadge } from "@/components/ui";
import { loadQuizQuestions } from "@/lib/quiz";

export const dynamic = "force-dynamic";

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id));
  if (!quiz) notFound();
  const [book] = await db.select({ id: books.id, title: books.title }).from(books).where(eq(books.id, quiz.bookId));

  const qs = await loadQuizQuestions(id);
  const chunkRows = qs.length
    ? await db
        .select({ id: chunks.id, position: chunks.position })
        .from(chunks)
        .where(inArray(chunks.id, qs.map((q) => q.chunkId)))
    : [];
  const posById = new Map(chunkRows.map((c) => [c.id, c.position]));

  const initial: EditorQuestion[] = qs.map((q) => ({
    id: q.id,
    text: q.text,
    explanation: q.explanation,
    approved: q.approved,
    sourceQuote: q.sourceQuote,
    chunkId: q.chunkId,
    chunkPosition: posById.get(q.chunkId) ?? 0,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
    correctOptionId: q.options.find((o) => o.isCorrect)?.id ?? null,
  }));

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/books/${book.id}`} className="text-sm text-indigo-700 hover:underline">
          ← {book.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Проверка теста автором</h1>
          <QuizStatusBadge status={quiz.status} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Проверьте каждый вопрос по источнику, при необходимости исправьте, утвердите и опубликуйте. Без утверждения всех
          вопросов тест остаётся черновиком.
        </p>
      </div>

      {quiz.lastError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Ошибка генерации: {quiz.lastError} Тест остаётся черновиком.
        </p>
      )}

      {qs.length === 0 ? (
        <Card>
          <p className="text-slate-600">
            В черновике пока нет вопросов.{" "}
            <Link href={`/books/${book.id}`} className="text-indigo-700 underline">
              Вернитесь к книге
            </Link>{" "}
            и повторите генерацию.
          </p>
        </Card>
      ) : (
        <QuizEditor quizId={quiz.id} bookId={book.id} published={quiz.status === "published"} initial={initial} />
      )}
    </div>
  );
}
