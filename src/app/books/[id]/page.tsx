import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { books, chunks, quizzes } from "@/db/schema";
import { DeleteBookButton, GenerateQuizPanel } from "@/components/BookActions";
import { Badge, Card, HighlightWords, QuizStatusBadge } from "@/components/ui";
import { isLlmConfigured } from "@/lib/generator";
import { queryStems, searchBook } from "@/lib/search";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { id: rawId } = await params;
  const { q = "", page: rawPage } = await searchParams;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [book] = await db
    .select({
      id: books.id,
      title: books.title,
      filename: books.filename,
      charCount: books.charCount,
      status: books.status,
      createdAt: books.createdAt,
    })
    .from(books)
    .where(eq(books.id, id));
  if (!book) notFound();

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.bookId, id));
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(chunks)
    .where(eq(chunks.bookId, id));

  const query = q.trim().slice(0, 200);
  const hits = query ? await searchBook(id, query, 5) : [];
  const stems = queryStems(query);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(rawPage) || 1));
  const list = await db
    .select()
    .from(chunks)
    .where(eq(chunks.bookId, id))
    .orderBy(asc(chunks.position))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-indigo-700 hover:underline">
            ← Все книги
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{book.title}</h1>
          <p className="text-sm text-slate-500">
            {book.filename} · {book.charCount.toLocaleString("ru-RU")} символов · фрагментов: {total}
          </p>
        </div>
        <DeleteBookButton bookId={book.id} />
      </div>

      {book.status !== "ready" && <Badge tone="red">Книга не обработана</Badge>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Тест по книге</h2>
          <QuizStatusBadge status={quiz?.status ?? null} />
        </div>
        {quiz?.lastError && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Последняя генерация не удалась: {quiz.lastError}
            {quiz.status === "draft" && " Тест остаётся черновиком."}
          </p>
        )}
        <div className="mt-4 space-y-4">
          <GenerateQuizPanel
            bookId={book.id}
            llmAvailable={isLlmConfigured()}
            hasQuiz={Boolean(quiz)}
            published={quiz?.status === "published"}
          />
          {quiz && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/quizzes/${quiz.id}/edit`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                {quiz.status === "published" ? "Просмотр теста" : "Открыть черновик"}
              </Link>
              {quiz.status === "published" && (
                <Link href={`/quizzes/${quiz.id}/take`} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  Пройти тест
                </Link>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Поиск по книге</h2>
        <form method="get" className="mt-3 flex gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="Введите слова, например: Юпитер спутники"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <button className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">Найти</button>
        </form>
        {query && (
          <div className="mt-4 space-y-3">
            {hits.length === 0 ? (
              <p className="text-sm text-slate-500">В этой книге ничего не найдено по запросу «{query}».</p>
            ) : (
              <>
                <p className="text-sm text-slate-500">Найдено фрагментов (топ-5): {hits.length}</p>
                {hits.map((h, i) => (
                  <article key={h.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        #{i + 1} · фрагмент №{h.position} · символы {h.startChar}–{h.endChar}
                      </span>
                      <Link href={`/books/${id}/fragments/${h.id}`} className="text-indigo-700 hover:underline">
                        открыть
                      </Link>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                      <HighlightWords text={h.text} stems={stems} />
                    </p>
                  </article>
                ))}
              </>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Фрагменты книги</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {list.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Фрагмент №{c.position} · символы {c.startChar}–{c.endChar}
                </span>
                <Link href={`/books/${id}/fragments/${c.id}`} className="text-indigo-700 hover:underline">
                  открыть
                </Link>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-700">{c.text}</p>
            </li>
          ))}
        </ul>
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={`/books/${id}?page=${page - 1}${query ? `&q=${encodeURIComponent(query)}` : ""}`} className="text-indigo-700 hover:underline">
                ← Назад
              </Link>
            ) : (
              <span />
            )}
            <span className="text-slate-500">
              Страница {page} из {pages}
            </span>
            {page < pages ? (
              <Link href={`/books/${id}?page=${page + 1}${query ? `&q=${encodeURIComponent(query)}` : ""}`} className="text-indigo-700 hover:underline">
                Вперёд →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
