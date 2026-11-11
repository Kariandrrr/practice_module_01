"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";

export function DeleteBookButton({ bookId }: { bookId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("Удалить книгу вместе с фрагментами и тестом?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/books/${bookId}`, { method: "DELETE" });
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }

  return (
    <span>
      <button
        onClick={del}
        disabled={busy}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Удалить книгу
      </button>
      {error && <span className="ml-2 text-sm text-red-700">{error}</span>}
    </span>
  );
}

export function GenerateQuizPanel({
  bookId,
  llmAvailable,
  hasQuiz,
  published,
}: {
  bookId: number;
  llmAvailable: boolean;
  hasQuiz: boolean;
  published: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"heuristic" | "llm">(llmAvailable ? "llm" : "heuristic");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (hasQuiz && !confirm("Текущий черновик будет заменён новым. Продолжить?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ quizId: number }>(`/api/books/${bookId}/quiz`, {
        method: "POST",
        json: { mode },
      });
      router.push(`/quizzes/${res.quizId}/edit`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка генерации");
      setBusy(false);
      router.refresh();
    }
  }

  if (published) {
    return (
      <p className="text-sm text-slate-600">
        Тест опубликован. Чтобы создать новый, сначала снимите его с публикации на странице редактирования.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "heuristic" | "llm")}
          disabled={busy}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          aria-label="Способ генерации"
        >
          <option value="heuristic">Заглушка (без модели, пропуск слов)</option>
          {llmAvailable && <option value="llm">LLM (OpenAI-совместимая модель)</option>}
        </select>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "Генерация…" : hasQuiz ? "Сгенерировать заново" : "Сгенерировать тест (5 вопросов)"}
        </button>
      </div>
      {!llmAvailable && (
        <p className="text-xs text-slate-500">
          Для генерации через LLM задайте переменную окружения OPENAI_API_KEY (см. README).
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
