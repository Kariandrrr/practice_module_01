import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { books, options, questions, quizzes } from "@/db/schema";
import TakeQuiz, { type TakeQuestion } from "@/components/TakeQuiz";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TakeQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id));
  if (!quiz) notFound();

  if (quiz.status !== "published") {
    return (
      <Card>
        <h1 className="text-xl font-bold">Тест ещё не опубликован</h1>
        <p className="mt-2 text-slate-600">Автор должен проверить вопросы и опубликовать тест.</p>
        <Link href="/quizzes" className="mt-4 inline-block text-indigo-700 underline">
          К списку тестов
        </Link>
      </Card>
    );
  }

  const [book] = await db.select({ title: books.title }).from(books).where(eq(books.id, quiz.bookId));

  // ВАЖНО: ключи (is_correct) и объяснения не выбираются — до отправки они не попадают в браузер
  const qs = await db
    .select({ id: questions.id, text: questions.text })
    .from(questions)
    .where(eq(questions.quizId, id))
    .orderBy(asc(questions.position));
  const opts = qs.length
    ? await db
        .select({ id: options.id, questionId: options.questionId, text: options.text })
        .from(options)
        .where(inArray(options.questionId, qs.map((q) => q.id)))
        .orderBy(asc(options.position))
    : [];

  const data: TakeQuestion[] = qs.map((q) => ({
    id: q.id,
    text: q.text,
    options: opts.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, text: o.text })),
  }));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/quizzes" className="text-sm text-indigo-700 hover:underline">
          ← Все тесты
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Тест: {book?.title}</h1>
        <p className="text-sm text-slate-600">Выберите по одному варианту в каждом вопросе.</p>
      </div>
      <TakeQuiz quizId={id} questions={data} />
    </div>
  );
}
