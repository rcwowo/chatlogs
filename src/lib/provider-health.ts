import { readJson, writeJson } from "@/lib/storage"

/**
 * Tracks recent failures per provider so the app can offer to disable one
 * that keeps failing. Failure times are saved so they carry across reloads.
 * Successes don't clear them, since flaky providers often recover in between.
 */

const STORAGE_KEY = "chatlogs:provider-failures"
const FAILURE_THRESHOLD = 2
/** Failures older than this no longer count. */
const FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000

/** A provider still pending after this long is treated as slow. */
export const PROVIDER_SLOW_MS = 8000

function loadFailures() {
  const stored = readJson<Record<string, unknown>>(STORAGE_KEY, {})
  const map = new Map<string, number[]>()
  for (const [id, times] of Object.entries(stored)) {
    if (Array.isArray(times)) {
      map.set(
        id,
        times.filter((time): time is number => typeof time === "number")
      )
    }
  }
  return map
}

const failures = loadFailures()
/** Providers already warned about since the page loaded, so we ask once. */
const warned = new Set<string>()
const listeners = new Set<(providerId: string) => void>()

// Leaving or reloading the page cancels in-flight requests, and the browser
// reports those as network errors. They aren't the provider's fault.
let unloading = false
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    unloading = true
  })
  window.addEventListener("pageshow", () => {
    unloading = false
  })
}

function save() {
  writeJson(STORAGE_KEY, Object.fromEntries(failures))
}

export function recordProviderOutcome(
  providerId: string,
  outcome: "ok" | "failed"
) {
  if (outcome === "ok" || unloading) {
    return
  }
  const now = Date.now()
  const recent = (failures.get(providerId) ?? []).filter(
    (time) => now - time < FAILURE_WINDOW_MS
  )
  recent.push(now)
  failures.set(providerId, recent)
  save()
  if (recent.length >= FAILURE_THRESHOLD && !warned.has(providerId)) {
    warned.add(providerId)
    for (const listener of listeners) {
      listener(providerId)
    }
  }
}

/** Start a provider's count over, e.g. after the user disables it. */
export function resetProviderFailures(providerId: string) {
  if (failures.delete(providerId)) {
    save()
  }
}

export function onRepeatedProviderFailure(
  listener: (providerId: string) => void
) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
