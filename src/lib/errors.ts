import { NextResponse } from "next/server";

/** Ошибка с понятным пользователю сообщением */
export class UserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Обёртка для route handlers: превращает ошибки в понятный JSON */
export async function respond(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof UserError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера. Повторите действие." },
      { status: 500 },
    );
  }
}

export function parseId(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new UserError("Некорректный идентификатор", 400);
  return n;
}
