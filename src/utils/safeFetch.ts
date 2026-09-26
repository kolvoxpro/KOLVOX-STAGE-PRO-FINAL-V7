/**
 * Safe fetch utility to prevent "Unexpected token '<', <!doctype... is not valid JSON" errors
 * when endpoints return non-JSON content or HTML fallbacks.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallback: T = null as unknown as T
): Promise<T> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const parsed = await res.json();
      return (parsed ?? fallback) as T;
    }
    return fallback;
  } catch (err) {
    console.warn(`safeFetchJson: Notice while fetching ${String(input)}:`, err);
    return fallback;
  }
}

export async function safeResponseJson<T = any>(
  res: Response | null | undefined,
  fallback: T = null as unknown as T
): Promise<T> {
  if (!res) return fallback;
  try {
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const parsed = await res.json();
      return (parsed ?? fallback) as T;
    }
    return fallback;
  } catch (err) {
    console.warn('safeResponseJson: Notice parsing response:', err);
    return fallback;
  }
}
