import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { books, chunks, quizzes } from "@/db/schema";
import UploadForm from "@/components/UploadForm";
import { Badge, Card, QuizStatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      filename: books.filename,
      charCount: books.charCount,
      status: books.status,
      createdAt: books.createdAt,
      quizId: quizzes.id,
      quizStatus: quizzes.status,
      chunkCount: sql<number>`(select count(*)::int from ${chunks} where ${chunks.bookId} = ${books.id})`,
    })
    .from(books)
    .leftJoin(quizzes, eq(quizzes.bookId, books.id))
    .orderBy(desc(books.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Режим автора</h1>
        <p className="mt-1 text-slate-600">
          Загрузите книгу → сгенерируйте тест → проверьте и утвердите вопросы → опубликуйте.
        </p>
      </div>

      <UploadForm />

      <Card>
        <h2 className="text-lg font-semibold">Загруженные книги</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Пока нет ни одной книги. Загрузите TXT-файл или демо-книгу.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {rows.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/books/${b.id}`} className="font-medium text-indigo-700 hover:underline">
                    {b.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {b.filename} · {Math.ceil(b.charCount / 1024)} КБ · фрагментов: {b.chunkCount} ·{" "}
                    {b.createdAt.toLocaleString("ru-RU")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {b.status !== "ready" && <Badge tone="red">Ошибка обработки</Badge>}
                  <QuizStatusBadge status={b.quizStatus} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
