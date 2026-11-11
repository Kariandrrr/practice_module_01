import type { ReactNode } from "react";

export function Badge({ tone, children }: { tone: "gray" | "amber" | "green" | "red" | "indigo"; children: ReactNode }) {
  const tones = {
    gray: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-700",
    indigo: "bg-indigo-100 text-indigo-800",
  };
  return <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function QuizStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge tone="gray">Теста нет</Badge>;
  if (status === "published") return <Badge tone="green">Опубликован</Badge>;
  return <Badge tone="amber">Черновик</Badge>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>{children}</section>;
}

/** Подсветка слов, начинающихся с одной из основ запроса */
export function HighlightWords({ text, stems }: { text: string; stems: string[] }) {
  const parts = text.split(/([\p{L}\p{N}]+)/u);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 && stems.some((s) => p.toLowerCase().startsWith(s)) ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

/** Находит цитату в тексте с учётом различий в пробелах. Возвращает [start, end) или null. */
export function findQuote(text: string, quote: string): [number, number] | null {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const m = new RegExp(pattern, "i").exec(text);
  return m ? [m.index, m.index + m[0].length] : null;
}
