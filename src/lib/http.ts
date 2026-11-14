/** Fetches JSON, giving up after `timeoutMs`. Rejects on timeouts, network errors, bad statuses and non-JSON bodies. */
export async function fetchJson<T>(url: string, timeoutMs = 5000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}
