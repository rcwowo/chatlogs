import { fetchTimeout, isTimeoutError } from "@/lib/http"
import { normalizeEndpoint, type Provider } from "@/lib/providers"
import { buildUrl } from "@/lib/rustlog"

/** rustlog and justlog both forget an opt-out code 60 seconds after issuing it. */
export const OPTOUT_CODE_TTL_MS = 60_000

/** A chat counts as logged if the service has logs from it this recently. */
const RECENT_LOGS_MS = 30 * 24 * 60 * 60 * 1000

const REQUEST_MS = 15_000

export type OptoutService = {
  id: string
  name: string
  url: string
}

/** Every listed provider, including the ones switched off for browsing. */
export function getOptoutServices(providers: Provider[]): OptoutService[] {
  return providers.map(({ id, name, url }) => ({ id, name, url }))
}

export type LoggerKind = "rustlog" | "justlog"

export type OptoutCode = {
  code: string
  command: string
  expiresAt: number
}

export function optoutCommand(kind: LoggerKind, code: string) {
  return `!${kind} optout ${code}`
}

function requestError(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) {
    return error
  }
  if (isTimeoutError(error)) {
    return new Error(`Timed out after ${Math.round(REQUEST_MS / 1000)}s`, {
      cause: error,
    })
  }
  return new Error("Couldn't reach this service", { cause: error })
}

const rustlogCheckCache = new Map<string, Promise<boolean | null>>()

/** Only rustlog serves `/capabilities`. Resolves null when it can't tell. */
function isRustlog(url: string) {
  const cached = rustlogCheckCache.get(url)
  if (cached) {
    return cached
  }
  const request = (async () => {
    try {
      const response = await fetchTimeout(buildUrl(url, "capabilities"), {
        timeoutMs: REQUEST_MS,
        headers: { Accept: "application/json" },
      })
      if (response.status === 404) {
        return false
      }
      if (!response.ok) {
        return null
      }
      const data: unknown = await response.json().catch(() => null)
      return Array.isArray(data) ? true : null
    } catch {
      return null
    }
  })()
  rustlogCheckCache.set(url, request)
  void request.then((result) => {
    if (result === null) {
      rustlogCheckCache.delete(url)
    }
  })
  return request
}

export async function requestOptoutCode(
  service: OptoutService,
  signal?: AbortSignal
): Promise<OptoutCode> {
  const kindCheck = isRustlog(service.url)
  // The code's lifetime starts when the server handles the request, so
  // counting from before it's sent never overstates the time left.
  const sentAt = Date.now()
  let response: Response
  try {
    response = await fetchTimeout(buildUrl(service.url, "optout"), {
      method: "POST",
      signal,
      timeoutMs: REQUEST_MS,
      headers: { Accept: "application/json" },
    })
  } catch (error) {
    throw requestError(error, signal)
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (
    response.status === 404 ||
    response.status === 405 ||
    (response.ok && !contentType.includes("json"))
  ) {
    throw new Error("Doesn't offer opt-out codes")
  }
  if (!response.ok) {
    throw new Error(`Request failed (HTTP ${response.status})`)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch (error) {
    if (signal?.aborted) {
      throw error
    }
    throw new Error("Unexpected response from this service", { cause: error })
  }
  if (typeof data !== "string" || !/^[A-Za-z0-9]{1,64}$/.test(data)) {
    throw new Error("Unexpected response from this service")
  }

  // justlog hands out 6 lowercase characters, rustlog 5 mixed-case ones.
  const rustlog = await kindCheck
  const kind: LoggerKind =
    rustlog === true
      ? "rustlog"
      : rustlog === false || /^[a-z0-9]{6}$/.test(data)
        ? "justlog"
        : "rustlog"

  return {
    code: data,
    command: optoutCommand(kind, data),
    expiresAt: sentAt + OPTOUT_CODE_TTL_MS,
  }
}

export type LogCheck =
  | { status: "found"; lastLogged: string }
  | { status: "stale"; lastLogged: string }
  | { status: "none" }
  | { status: "opted-out" }
  | { status: "unreachable" }

type ListedDate = { year?: unknown; month?: unknown; day?: unknown }

function latestLogTime(dates: ListedDate[]) {
  let latest = 0
  for (const date of dates) {
    const year = Number(date.year)
    const month = Number(date.month)
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      continue
    }
    // A month-only entry could cover any day, so count its last day.
    const time =
      date.day === undefined
        ? Date.UTC(year, month, 0)
        : Date.UTC(year, month - 1, Number(date.day))
    if (Number.isFinite(time) && time > latest) {
      latest = time
    }
  }
  return latest
}

const logCheckCache = new Map<string, Promise<LogCheck>>()

/**
 * Looks up the logs a service has of a chat. Recent logs mean the service's
 * bot is still there to read commands sent in it.
 */
export function checkChatLogs(url: string, channel: string) {
  const key = `${url}|${channel}`
  const cached = logCheckCache.get(key)
  if (cached) {
    return cached
  }
  const request = (async (): Promise<LogCheck> => {
    try {
      const response = await fetchTimeout(buildUrl(url, "list", { channel }), {
        timeoutMs: REQUEST_MS,
        headers: { Accept: "application/json" },
      })
      if (response.status === 404) {
        return { status: "none" }
      }
      if (response.status === 403) {
        const body = await response.text().catch(() => "")
        return /opted out/i.test(body)
          ? { status: "opted-out" }
          : { status: "unreachable" }
      }
      if (!response.ok) {
        return { status: "unreachable" }
      }
      const data = (await response.json()) as { availableLogs?: unknown }
      const dates = Array.isArray(data.availableLogs)
        ? (data.availableLogs as ListedDate[])
        : []
      const latest = latestLogTime(dates)
      if (!latest) {
        return { status: "none" }
      }
      const lastLogged = new Date(latest).toISOString().slice(0, 10)
      return Date.now() - latest > RECENT_LOGS_MS
        ? { status: "stale", lastLogged }
        : { status: "found", lastLogged }
    } catch {
      return { status: "unreachable" }
    }
  })()
  logCheckCache.set(key, request)
  void request.then((result) => {
    if (result.status === "unreachable") {
      logCheckCache.delete(key)
    }
  })
  return request
}

export type ParsedEndpointList = {
  urls: string[]
  invalid: string[]
}

function looksLikeHost(url: URL) {
  return (
    url.hostname.includes(".") ||
    url.hostname === "localhost" ||
    url.port !== ""
  )
}

/** Accepts URLs separated by new lines, spaces or commas. */
export function parseEndpointList(text: string): ParsedEndpointList {
  const urls: string[] = []
  const invalid: string[] = []
  for (const token of text.split(/[\s,]+/)) {
    if (!token) {
      continue
    }
    try {
      const url = normalizeEndpoint(token)
      if (!looksLikeHost(new URL(url))) {
        invalid.push(token)
        continue
      }
      if (!urls.includes(url)) {
        urls.push(url)
      }
    } catch {
      invalid.push(token)
    }
  }
  return { urls, invalid }
}

export function providerNameFromUrl(url: string) {
  const parsed = new URL(url)
  const host = parsed.hostname.replace(/^(www|logs)\./, "")
  const path = parsed.pathname.replace(/\/+$/, "")
  return path ? `${host}${path}` : host
}
