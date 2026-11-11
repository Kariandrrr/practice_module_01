/** Запрос к API с понятной обработкой ошибок (для клиентских компонентов) */
export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "content-type": "application/json" } : undefined,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new Error("Нет связи с сервером. Проверьте подключение и повторите действие.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || "Не удалось выполнить действие. Повторите попытку.");
  }
  return data as T;
}
