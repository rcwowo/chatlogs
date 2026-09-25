import {
  fromDateKey,
  mergeDateKeys,
  toDateKey,
  type AvailableLogDate,
} from "@/lib/dates"
import { fetchTimeout } from "@/lib/http"
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
}

export type DateDiscovery = {
  dates: string[]
  statuses: ProviderStatus[]
  providersForDate: Map<string, string[]>
}

const REQUEST_MS = 20000

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
  { ok: true; data: T } | { ok: false; missing: boolean; error: string }
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
    const message = error instanceof Error ? error.message : "Request failed"
    return { ok: false, missing: false, error: message }
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
  signal?: AbortSignal
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
      const result = await fetchJson<{ availableLogs?: AvailableLogDate[] }>(
        url,
        signal
      )
      if (result.ok) {
        const dates = result.data.availableLogs ?? []
        return {
          providerId: provider.id,
          status: "ok" as const,
          dates,
        }
      }
      return {
        providerId: provider.id,
        status: result.missing ? ("missing" as const) : ("error" as const),
        error: result.error,
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
    statuses: results.map(({ providerId, status, error }) => ({
      providerId,
      status,
      error,
    })),
    providersForDate,
  }
}

export async function fetchChannelLogs(
  providers: Provider[],
  channelInput: string,
  dateKey: string,
  signal?: AbortSignal
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
      const result = await fetchJson<{ messages?: ChatMessage[] }>(url, signal)
      if (result.ok) {
        return {
          providerId: provider.id,
          status: "ok" as const,
          messages: result.data.messages ?? [],
        }
      }
      return {
        providerId: provider.id,
        status: result.missing ? ("missing" as const) : ("error" as const),
        error: result.error,
        messages: [] as ChatMessage[],
      }
    })
  )

  return {
    messages: mergeMessages(batches),
    statuses: batches.map(({ providerId, status, error }) => ({
      providerId,
      status,
      error,
    })),
  }
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
          return null
        }
        const text = await response.text()
        if (!text.trim()) {
          return null
        }
        return { providerId: provider.id, content: text }
      } catch {
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
      const result = await fetchJson<ChannelStats>(url, signal)
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
