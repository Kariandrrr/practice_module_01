import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attemptAnswers, attempts, books, options, questions, quizzes } from "@/db/schema";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, id));
  if (!attempt) notFound();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, attempt.quizId));
  const [book] = await db.select({ id: books.id, title: books.title }).from(books).where(eq(books.id, quiz.bookId));

  const qs = await db.select().from(questions).where(eq(questions.quizId, quiz.id)).orderBy(asc(questions.position));
  const opts = qs.length
    ? await db
        .select()
        .from(options)
        .where(inArray(options.questionId, qs.map((q) => q.id)))
        .orderBy(asc(options.position))
    : [];
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, id));
  const chosen = new Map(answers.map((a) => [a.questionId, a.optionId]));

  const pct = Math.round((attempt.score / attempt.total) * 100);
  const tone = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-5">
      <Card className="text-center">
        <p className="text-sm text-slate-500">Результат теста «{book.title}»</p>
        <p className={`mt-2 text-6xl font-bold ${tone}`}>
          {attempt.score} <span className="text-3xl text-slate-400">из {attempt.total}</span>
        </p>
        <p className="mt-1 text-slate-600">{pct}% правильных ответов</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href={`/quizzes/${quiz.id}/take`} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Пройти ещё раз
          </Link>
          <Link href="/quizzes" className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium hover:bg-slate-50">
            К списку тестов
          </Link>
        </div>
      </Card>

      {qs.map((q, i) => {
        const chosenId = chosen.get(q.id);
        const ok = Boolean(answers.find((a) => a.questionId === q.id)?.isCorrect);
        return (
          <Card key={q.id} className={ok ? "border-emerald-300" : "border-red-300"}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Вопрос {i + 1}</p>
              <span className={`text-sm font-semibold ${ok ? "text-emerald-700" : "text-red-700"}`}>
                {ok ? "✓ Верно" : "✗ Неверно"}
              </span>
            </div>
            <p className="mt-1 font-medium">{q.text}</p>
            <ul className="mt-3 space-y-1.5">
              {opts
                .filter((o) => o.questionId === q.id)
                .map((o) => {
                  const isChosen = chosenId === o.id;
                  const cls = o.isCorrect
                    ? "border-emerald-400 bg-emerald-50"
                    : isChosen
                      ? "border-red-400 bg-red-50"
                      : "border-slate-200";
                  return (
                    <li key={o.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${cls}`}>
                      <span>{o.text}</span>
                      <span className="text-xs text-slate-600">
                        {isChosen && "ваш ответ"}
                        {isChosen && o.isCorrect && " · "}
                        {o.isCorrect && "правильный"}
                      </span>
                    </li>
                  );
                })}
            </ul>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p>
                <span className="font-medium">Объяснение: </span>
                {q.explanation}
              </p>
              <p className="mt-1">
                <Link
                  href={`/books/${book.id}/fragments/${q.chunkId}?question=${q.id}`}
                  className="text-indigo-700 underline underline-offset-2"
                  target="_blank"
                >
                  Источник в книге ↗
                </Link>
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
