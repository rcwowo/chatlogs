import {
  fromDateKey,
  mergeDateKeys,
  toDateKey,
  type AvailableLogDate,
} from "@/lib/dates"
import { fetchTimeout, isTimeoutError } from "@/lib/http"
import { PROVIDER_SLOW_MS, recordProviderOutcome } from "@/lib/provider-health"
import type { Provider } from "@/lib/providers"
import { parseTarget, type NamedTarget } from "@/lib/twitch"

export type ChatMessage = {
  text?: string
  systemText?: string
  username?: string
  displayName?: string
  channel?: string
  timestamp?: string | { seconds?: number; nanos?: number }
  id?: string
  type?: number
  raw?: string
  tags?: Record<string, string>
}

export type MergedMessage = {
  key: string
  text: string
  systemText: string
  username: string
  displayName: string
  channel: string
  timestamp: string
  id: string
  type: number
  tags: Record<string, string>
  providers: string[]
}

export type ProviderStatus = {
  providerId: string
  status: "ok" | "missing" | "error"
  error?: string
  timedOut?: boolean
  /** The user chose to continue without waiting for this provider. */
  skipped?: boolean
}

/**
 * Reported as each provider finishes, so the UI can show progress before the
 * slowest provider responds. `count` is days for discovery, messages for logs.
 */
export type ProviderResult = ProviderStatus & { count: number }

export type ProviderResultHandler = (result: ProviderResult) => void

export const REQUEST_TIMEOUT_MS = 20000

export type DateDiscovery = {
  dates: string[]
  statuses: ProviderStatus[]
  providersForDate: Map<string, string[]>
}

const REQUEST_MS = REQUEST_TIMEOUT_MS

function rustlogPath(target: NamedTarget, kind: "channel" | "user") {
  if (kind === "channel") {
    return target.kind === "id"
      ? `channelid/${encodeURIComponent(target.value)}`
      : `channel/${encodeURIComponent(target.value)}`
  }
  return target.kind === "id"
    ? `userid/${encodeURIComponent(target.value)}`
    : `user/${encodeURIComponent(target.value)}`
}

function buildUrl(
  base: string,
  path: string,
  query: Record<string, string | undefined> = {}
) {
  const url = new URL(path.replace(/^\//, ""), `${base.replace(/\/+$/, "")}/`)
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

async function fetchJson<T>(
  url: string,
  signal?: AbortSignal
): Promise<
  | { ok: true; data: T }
  | {
      ok: false
      missing: boolean
      error: string
      timedOut?: boolean
      skipped?: boolean
    }
> {
  try {
    const response = await fetchTimeout(url, {
      signal,
      timeoutMs: REQUEST_MS,
      headers: { Accept: "application/json" },
    })

    if (response.status === 404) {
      return { ok: false, missing: true, error: "Not found" }
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      const message = body.trim().slice(0, 180) || response.statusText
      return {
        ok: false,
        missing: response.status === 403,
        error: message || `HTTP ${response.status}`,
      }
    }

    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.includes("json")) {
      return { ok: false, missing: false, error: "Response was not JSON" }
    }

    return { ok: true, data: (await response.json()) as T }
  } catch (error) {
    if (signal?.aborted) {
      throw error
    }
    if (isTimeoutError(error)) {
      return {
        ok: false,
        missing: false,
        timedOut: true,
        error: `Timed out after ${Math.round(REQUEST_MS / 1000)}s`,
      }
    }
    const message = error instanceof Error ? error.message : "Request failed"
    return { ok: false, missing: false, error: message }
  }
}

/**
 * Fetches one provider's part of a load. Aborting `skip` stops
 * waiting on it without failing the whole load, and the outcome feeds the
 * repeated-failure warning.
 */
async function fetchProviderJson<T>(
  providerId: string,
  url: string,
  signal?: AbortSignal,
  skip?: AbortSignal
) {
  const skipped = {
    ok: false as const,
    missing: false,
    skipped: true,
    timedOut: false,
    error: "Skipped",
  }
  const startedAt = Date.now()
  // Skipping a provider that was already slow counts against it too.
  const markSkipped = () => {
    if (Date.now() - startedAt >= PROVIDER_SLOW_MS) {
      recordProviderOutcome(providerId, "failed")
    }
    return skipped
  }
  const signals = [signal, skip].filter((item) => item !== undefined)
  const combined = signals.length > 1 ? AbortSignal.any(signals) : signal
  try {
    const result = await fetchJson<T>(url, combined)
    if (!result.ok && skip?.aborted) {
      return markSkipped()
    }
    recordProviderOutcome(
      providerId,
      result.ok || result.missing ? "ok" : "failed"
    )
    return result
  } catch (error) {
    if (skip?.aborted && !signal?.aborted) {
      return markSkipped()
    }
    throw error
  }
}

function messageTimestamp(message: ChatMessage) {
  if (typeof message.timestamp === "string") {
    return message.timestamp
  }
  if (message.timestamp && typeof message.timestamp.seconds === "number") {
    return new Date(message.timestamp.seconds * 1000).toISOString()
  }
  const tag = message.tags?.["tmi-sent-ts"]
  if (tag) {
    const n = Number(tag)
    if (!Number.isNaN(n)) {
      return new Date(n).toISOString()
    }
  }
  return ""
}

function messageKey(message: ChatMessage) {
  if (message.id) {
    return message.id
  }
  return [
    messageTimestamp(message),
    message.username ?? "",
    message.text ?? message.systemText ?? "",
    message.channel ?? "",
  ].join("|")
}

export function mergeMessages(
  batches: Array<{ providerId: string; messages: ChatMessage[] }>
) {
  const byKey = new Map<string, MergedMessage>()

  for (const batch of batches) {
    for (const message of batch.messages) {
      const key = messageKey(message)
      const existing = byKey.get(key)
      if (existing) {
        if (!existing.providers.includes(batch.providerId)) {
          existing.providers.push(batch.providerId)
        }
        continue
      }

      byKey.set(key, {
        key,
        text: message.text ?? "",
        systemText: message.systemText ?? "",
        username: message.username ?? "",
        displayName: message.displayName || message.username || "",
        channel: message.channel ?? "",
        timestamp: messageTimestamp(message),
        id: message.id ?? key,
        type: message.type ?? 1,
        tags: message.tags ?? {},
        providers: [batch.providerId],
      })
    }
  }

  // Timestamps are ISO 8601 strings, so lexicographic comparison matches
  // chronological order and is far cheaper than localeCompare.
  return [...byKey.values()].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0
  )
}

export async function discoverAvailableLogs(
  providers: Provider[],
  channelInput: string,
  signal?: AbortSignal,
  onProvider?: ProviderResultHandler,
  skip?: AbortSignal
): Promise<DateDiscovery> {
  const channel = parseTarget(channelInput)
  if (!channel) {
    return { dates: [], statuses: [], providersForDate: new Map() }
  }

  const query: Record<string, string | undefined> = {
    [channel.kind === "id" ? "channelid" : "channel"]: channel.value,
  }

  const results = await Promise.all(
    providers.map(async (provider) => {
      const url = buildUrl(provider.url, "list", query)
      const result = await fetchProviderJson<{
        availableLogs?: AvailableLogDate[]
      }>(provider.id, url, signal, skip)
      if (result.ok) {
        const dates = result.data.availableLogs ?? []
        onProvider?.({
          providerId: provider.id,
          status: "ok",
          count: dates.filter((date) => date.day).length,
        })
        return {
          providerId: provider.id,
          status: "ok" as const,
          dates,
        }
      }
      const status = result.missing ? ("missing" as const) : ("error" as const)
      onProvider?.({
        providerId: provider.id,
        status,
        error: result.error,
        timedOut: result.timedOut,
        skipped: result.skipped,
        count: 0,
      })
      return {
        providerId: provider.id,
        status,
        error: result.error,
        timedOut: result.timedOut,
        skipped: result.skipped,
        dates: [] as AvailableLogDate[],
      }
    })
  )

  const providersForDate = new Map<string, string[]>()
  for (const result of results) {
    for (const date of result.dates) {
      const key = toDateKey(date)
      const current = providersForDate.get(key) ?? []
      current.push(result.providerId)
      providersForDate.set(key, current)
    }
  }

  return {
    dates: mergeDateKeys(results.map((result) => result.dates)),
    statuses: results.map(toStatus),
    providersForDate,
  }
}

export async function fetchChannelLogs(
  providers: Provider[],
  channelInput: string,
  dateKey: string,
  signal?: AbortSignal,
  callbacks: {
    onProvider?: ProviderResultHandler
    /** Called once every provider has answered, before merging starts. */
    onMerge?: (total: number) => void
    /** Abort to stop waiting on providers that haven't answered yet. */
    skip?: AbortSignal
  } = {}
) {
  const channel = parseTarget(channelInput)
  const date = fromDateKey(dateKey)
  if (!channel || !date?.day) {
    return { messages: [], statuses: [] as ProviderStatus[] }
  }

  const path = `${rustlogPath(channel, "channel")}/${date.year}/${date.month}/${date.day}`
  const batches = await Promise.all(
    providers.map(async (provider) => {
      const url = buildUrl(provider.url, path, { json: "1" })
      const result = await fetchProviderJson<{ messages?: ChatMessage[] }>(
        provider.id,
        url,
        signal,
        callbacks.skip
      )
      if (result.ok) {
        const messages = result.data.messages ?? []
        callbacks.onProvider?.({
          providerId: provider.id,
          status: "ok",
          count: messages.length,
        })
        return {
          providerId: provider.id,
          status: "ok" as const,
          messages,
        }
      }
      const status = result.missing ? ("missing" as const) : ("error" as const)
      callbacks.onProvider?.({
        providerId: provider.id,
        status,
        error: result.error,
        timedOut: result.timedOut,
        skipped: result.skipped,
        count: 0,
      })
      return {
        providerId: provider.id,
        status,
        error: result.error,
        timedOut: result.timedOut,
        skipped: result.skipped,
        messages: [] as ChatMessage[],
      }
    })
  )

  const total = batches.reduce((sum, batch) => sum + batch.messages.length, 0)
  if (callbacks.onMerge && total > 0) {
    callbacks.onMerge(total)
    // Merging blocks the main thread, so let the UI paint the merge step first.
    await nextPaint()
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError")
    }
  }

  return {
    messages: mergeMessages(batches),
    statuses: batches.map(toStatus),
  }
}

function toStatus({
  providerId,
  status,
  error,
  timedOut,
  skipped,
}: ProviderStatus): ProviderStatus {
  return { providerId, status, error, timedOut, skipped }
}

function nextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0))
  })
}

export type RawLogBatch = {
  providerId: string
  content: string
}

export async function fetchRawChannelLogs(
  providers: Provider[],
  channelInput: string,
  dateKey: string,
  signal?: AbortSignal
) {
  const channel = parseTarget(channelInput)
  const date = fromDateKey(dateKey)
  if (!channel || !date?.day) {
    return [] as RawLogBatch[]
  }

  const path = `${rustlogPath(channel, "channel")}/${date.year}/${date.month}/${date.day}`
  const batches = await Promise.all(
    providers.map(async (provider): Promise<RawLogBatch | null> => {
      try {
        const response = await fetchTimeout(buildUrl(provider.url, path), {
          signal,
          timeoutMs: REQUEST_MS,
        })
        if (!response.ok) {
          recordProviderOutcome(
            provider.id,
            response.status === 404 || response.status === 403 ? "ok" : "failed"
          )
          return null
        }
        const text = await response.text()
        recordProviderOutcome(provider.id, "ok")
        if (!text.trim()) {
          return null
        }
        return { providerId: provider.id, content: text }
      } catch {
        if (!signal?.aborted) {
          recordProviderOutcome(provider.id, "failed")
        }
        return null
      }
    })
  )

  return batches.filter((batch) => batch !== null)
}

export type ChannelStats = {
  messageCount: number
  topChatters: Array<{
    userId: string
    userLogin?: string
    messageCount: number
  }>
}

export async function fetchChannelStats(
  providers: Provider[],
  channelInput: string,
  signal?: AbortSignal
) {
  const channel = parseTarget(channelInput)
  if (!channel) {
    return {
      stats: null as (ChannelStats & { providerId: string }) | null,
      statuses: [] as ProviderStatus[],
    }
  }

  const path = `${rustlogPath(channel, "channel")}/stats`
  const isEmptyStats = (data: ChannelStats) =>
    data.messageCount <= 0 && (data.topChatters ?? []).length === 0
  const results = await Promise.all(
    providers.map(async (provider) => {
      const url = buildUrl(provider.url, path)
      const result = await fetchProviderJson<ChannelStats>(
        provider.id,
        url,
        signal
      )
      if (result.ok && !isEmptyStats(result.data)) {
        return {
          providerId: provider.id,
          status: "ok" as const,
          stats: result.data,
        }
      }
      return {
        providerId: provider.id,
        status: (result.ok || result.missing ? "missing" : "error") as
          "missing" | "error",
        error: result.ok ? "No stats" : result.error,
        stats: null as ChannelStats | null,
      }
    })
  )

  const hits = results.filter(
    (result): result is (typeof results)[number] & { stats: ChannelStats } =>
      result.stats !== null
  )
  const best = hits.reduce<(typeof hits)[number] | null>((current, result) => {
    if (!current) {
      return result
    }
    return result.stats.messageCount > current.stats.messageCount
      ? result
      : current
  }, null)

  return {
    stats: best ? { ...best.stats, providerId: best.providerId } : null,
    statuses: results.map(({ providerId, status, error }) => ({
      providerId,
      status,
      error,
    })),
  }
}
