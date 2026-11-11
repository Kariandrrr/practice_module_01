"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";

const STEPS = ["Проверка файла", "Разбиение на фрагменты", "Сохранение в базу"];
const MAX = 500 * 1024;

export default function UploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<{ id: number }>) {
    setBusy(true);
    setError(null);
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => setStep(2), 900);
    try {
      const res = await task();
      router.push(`/books/${res.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setBusy(false);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Файл не выбран. Выберите TXT-файл с книгой.");
    if (!/\.txt$/i.test(file.name)) return setError("Неподдерживаемый формат файла. Нужен .txt (UTF-8).");
    if (file.size === 0) return setError("Файл пустой. Выберите TXT-файл с текстом книги.");
    if (file.size > MAX) return setError("Файл слишком большой. Максимальный размер — 500 КБ.");
    const fd = new FormData();
    fd.append("file", file);
    if (title.trim()) fd.append("title", title.trim());
    run(() => apiFetch<{ id: number }>("/api/books", { method: "POST", body: fd }));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">1. Загрузка книги</h2>
      <p className="mt-1 text-sm text-slate-600">
        Формат: TXT в кодировке UTF-8, до 500 КБ. Повторная загрузка той же книги заменит старую.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название книги (необязательно)"
          maxLength={200}
          disabled={busy}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border-2 border-dashed border-slate-300 px-4 py-4 text-sm hover:border-indigo-400">
          <span className="truncate text-slate-600">{fileName || "Выберите файл .txt"}</span>
          <span className="rounded-md bg-slate-100 px-3 py-1 font-medium text-slate-700">Обзор</span>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              setFileName(e.target.files?.[0]?.name ?? "");
              setError(null);
            }}
          />
        </label>

        {busy && (
          <ol className="space-y-1 rounded-lg bg-indigo-50 p-3 text-sm" aria-live="polite">
            {STEPS.map((s, i) => (
              <li key={s} className={i <= step ? "text-indigo-800" : "text-slate-400"}>
                {i < step ? "✓" : i === step ? "⏳" : "○"} {s}
              </li>
            ))}
          </ol>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Обработка…" : error ? "Повторить загрузку" : "Загрузить книгу"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => apiFetch<{ id: number }>("/api/books/demo", { method: "POST" }))}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Загрузить демо-книгу
          </button>
          <a
            href="/api/demo-book"
            className="rounded-lg px-3 py-2 text-sm text-indigo-700 underline underline-offset-2"
          >
            Скачать демо TXT
          </a>
        </div>
      </form>
    </div>
  );
}
