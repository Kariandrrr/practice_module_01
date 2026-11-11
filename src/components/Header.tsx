"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const readerMode = (pathname.startsWith("/quizzes") && !pathname.endsWith("/edit")) || pathname.startsWith("/attempts");

  const pill = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">📖</span>
          КнигоТест
        </Link>
        <nav className="flex items-center gap-1 rounded-full bg-slate-100 p-1" aria-label="Режим">
          <Link href="/" className={pill(!readerMode)}>
            Автор
          </Link>
          <Link href="/quizzes" className={pill(readerMode)}>
            Читатель
          </Link>
        </nav>
      </div>
    </header>
  );
}
