import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, books, quizzes } from "@/db/schema";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function QuizzesPage() {
  const rows = await db
    .select({
      id: quizzes.id,
      title: books.title,
      publishedAt: quizzes.publishedAt,
      attemptCount: sql<number>`(select count(*)::int from ${attempts} where ${attempts.quizId} = ${quizzes.id})`,
    })
    .from(quizzes)
    .innerJoin(books, eq(books.id, quizzes.bookId))
    .where(eq(quizzes.status, "published"))
    .orderBy(desc(quizzes.publishedAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Режим читателя</h1>
        <p className="mt-1 text-slate-600">Выберите опубликованный тест, ответьте на 5 вопросов и узнайте результат.</p>
      </div>
      {rows.length === 0 ? (
        <Card>
          <p className="text-slate-600">
            Опубликованных тестов пока нет. Перейдите в{" "}
            <Link href="/" className="text-indigo-700 underline">
              режим автора
            </Link>
            , загрузите книгу и опубликуйте тест.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((q) => (
            <Card key={q.id}>
              <h2 className="font-semibold">{q.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                5 вопросов · попыток: {q.attemptCount}
                {q.publishedAt && ` · опубликован ${q.publishedAt.toLocaleDateString("ru-RU")}`}
              </p>
              <Link
                href={`/quizzes/${q.id}/take`}
                className="mt-4 inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Пройти тест
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
