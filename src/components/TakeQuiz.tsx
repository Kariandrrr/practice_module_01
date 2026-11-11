"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";

export type TakeQuestion = {
  id: number;
  text: string;
  options: { id: number; text: string }[];
};

export default function TakeQuiz({ quizId, questions }: { quizId: number; questions: TakeQuestion[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = Object.keys(answers).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (answered < questions.length) return setError("Ответьте на все вопросы перед отправкой.");
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ attemptId: number }>(`/api/quizzes/${quizId}/attempts`, {
        method: "POST",
        json: { answers },
      });
      router.push(`/attempts/${res.attemptId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {questions.map((q, i) => (
        <fieldset key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <legend className="sr-only">Вопрос {i + 1}</legend>
          <p className="text-sm font-medium text-indigo-700">Вопрос {i + 1} из {questions.length}</p>
          <p className="mt-1 font-medium">{q.text}</p>
          <div className="mt-3 space-y-2">
            {q.options.map((o) => (
              <label
                key={o.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${answers[q.id] === o.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={answers[q.id] === o.id}
                  onChange={() => {
                    setAnswers((a) => ({ ...a, [q.id]: o.id }));
                    setError(null);
                  }}
                  className="h-4 w-4 accent-indigo-600"
                />
                {o.text}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "Отправка…" : error && answered === questions.length ? "Повторить отправку" : "Отправить ответы"}
        </button>
        <span className="text-sm text-slate-500">Отвечено: {answered} из {questions.length}</span>
      </div>
    </form>
  );
}
