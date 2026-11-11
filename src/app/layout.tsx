import type { Metadata } from "next";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "КнигоТест — тесты по загруженной книге",
  description: "Загрузите книгу в формате TXT, проверьте автоматически созданный тест и пройдите его.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Header />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-slate-500">
          КнигоТест · учебный MVP · персональные данные не собираются
        </footer>
      </body>
    </html>
  );
}
