export async function fetchTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 20_000, signal, ...rest } = init
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError")
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort)

  try {
    return await fetch(url, { ...rest, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}
