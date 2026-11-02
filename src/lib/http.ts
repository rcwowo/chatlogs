export function isTimeoutError(error: unknown) {
  return error instanceof DOMException && error.name === "TimeoutError"
}

export async function fetchTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 20_000, signal, ...rest } = init
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError")
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort)

  try {
    return await fetch(url, { ...rest, signal: controller.signal })
  } catch (error) {
    if (timedOut && !signal?.aborted) {
      throw new DOMException("Request timed out", "TimeoutError")
    }
    throw error
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}
