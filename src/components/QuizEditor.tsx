"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";
import { validateQuestion, type EditableQuestion } from "@/lib/validate";

export type EditorQuestion = EditableQuestion & {
  chunkId: number;
  chunkPosition: number;
  sourceQuote: string;
};

export default function QuizEditor({
  quizId,
  bookId,
  published,
  initial,
}: {
  quizId: number;
  bookId: number;
  published: boolean;
  initial: EditorQuestion[];
}) {
  const router = useRouter();
  const [qs, setQs] = useState<EditorQuestion[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const readOnly = published;
  const approvedCount = qs.filter((q) => q.approved).length;

  function patch(i: number, p: Partial<EditorQuestion>, resetApproval = true) {
    setQs((cur) =>
      cur.map((q, idx) => (idx === i ? { ...q, ...p, approved: resetApproval ? false : (p.approved ?? q.approved) } : q)),
    );
    setInfo(null);
  }

  function toggleApprove(i: number) {
    const q = qs[i];
    if (!q.approved) {
      const err = validateQuestion(q, i);
      if (err) return setError(`Нельзя утвердить. ${err}`);
    }
    setError(null);
    patch(i, { approved: !q.approved }, false);
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    apiFetch(`/api/quizzes/${quizId}`, {
      method: "PUT",
      json: {
        questions: qs.map(({ id, text, explanation, approved, options, correctOptionId }) => ({
          id, text, explanation, approved, options, correctOptionId,
        })),
      },
    });

  const onSave = () =>
    run(async () => {
      await save();
      setInfo("Черновик сохранён.");
      router.refresh();
    });

  const onPublish = () =>
    run(async () => {
      await save();
      await apiFetch(`/api/quizzes/${quizId}/publish`, { method: "POST" });
      router.refresh();
    });

  const onUnpublish = () =>
    run(async () => {
      await apiFetch(`/api/quizzes/${quizId}/unpublish`, { method: "POST" });
      router.refresh();
    });

  function approveAll() {
    const next = qs.map((q, i) => ({ q, err: validateQuestion(q, i) }));
    const bad = next.find((n) => n.err);
    if (bad) return setError(`Нельзя утвердить. ${bad.err}`);
    setError(null);
    setQs(qs.map((q) => ({ ...q, approved: true })));
  }

  return (
    <div className="space-y-5">
      {qs.map((q, i) => (
        <section
          key={q.id}
          className={`rounded-2xl border bg-white p-5 shadow-sm ${q.approved ? "border-emerald-300" : "border-slate-200"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Вопрос {i + 1}</h3>
            <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${q.approved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {q.approved ? "Утверждён" : "Не утверждён"}
            </span>
          </div>

          <label className="mt-3 block text-sm font-medium text-slate-700">Текст вопроса</label>
          <textarea
            value={q.text}
            disabled={readOnly}
            onChange={(e) => patch(i, { text: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          />

          <p className="mt-3 text-sm font-medium text-slate-700">Варианты ответа (отметьте правильный)</p>
          <div className="mt-1 space-y-2">
            {q.options.map((o, j) => (
              <div key={o.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  checked={q.correctOptionId === o.id}
                  disabled={readOnly}
                  onChange={() => patch(i, { correctOptionId: o.id })}
                  aria-label={`Правильный вариант ${j + 1}`}
                  className="h-4 w-4 accent-emerald-600"
                />
                <input
                  type="text"
                  value={o.text}
                  disabled={readOnly}
                  onChange={(e) =>
                    patch(i, { options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })
                  }
                  className={`w-full rounded-lg border px-3 py-1.5 text-sm disabled:bg-slate-50 ${q.correctOptionId === o.id ? "border-emerald-400 bg-emerald-50" : "border-slate-300"}`}
                />
              </div>
            ))}
          </div>

          <label className="mt-3 block text-sm font-medium text-slate-700">Объяснение</label>
          <textarea
            value={q.explanation}
            disabled={readOnly}
            onChange={(e) => patch(i, { explanation: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          />

          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Источник: </span>«{q.sourceQuote}»{" "}
            <Link
              href={`/books/${bookId}/fragments/${q.chunkId}?question=${q.id}`}
              target="_blank"
              className="whitespace-nowrap text-indigo-700 underline underline-offset-2"
            >
              открыть фрагмент №{q.chunkPosition} ↗
            </Link>
          </div>

          {!readOnly && (
            <button
              onClick={() => toggleApprove(i)}
              className={`mt-3 rounded-lg px-4 py-1.5 text-sm font-medium ${q.approved ? "border border-slate-300 text-slate-700 hover:bg-slate-50" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
            >
              {q.approved ? "Снять утверждение" : "Утвердить вопрос"}
            </button>
          )}
        </section>
      ))}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {info && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{info}</p>}

      <div className="sticky bottom-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        {readOnly ? (
          <>
            <Link href={`/quizzes/${quizId}/take`} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Пройти тест
            </Link>
            <button onClick={onUnpublish} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
              Снять с публикации
            </button>
          </>
        ) : (
          <>
            <button onClick={onSave} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              Сохранить черновик
            </button>
            <button onClick={approveAll} disabled={busy} className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
              Утвердить все
            </button>
            <button
              onClick={onPublish}
              disabled={busy || approvedCount !== qs.length || qs.length === 0}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              Опубликовать
            </button>
            <span className="text-sm text-slate-500">
              Утверждено: {approvedCount} из {qs.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
