import type { ChatEmote, ChatEmoteProvider } from "@/lib/chat/types"
import { fetchTimeout } from "@/lib/http"

const SEVENTV_EMOTE_FLAG_ZERO_WIDTH = 1 << 8
const FETCH_TIMEOUT_MS = 10_000

export type EmoteCatalogEntry = {
  id: string
  code: string
  provider: Exclude<ChatEmoteProvider, "twitch">
  imageUrl: string
  seventvFlags?: number
  listed?: boolean
}

export type ThirdPartyEmoteCatalog = Map<string, EmoteCatalogEntry>

type TextRange = {
  start: number
  end: number
}

type BetterTtvEmote = {
  id: string
  code: string
  imageType?: string
}

type BetterTtvUserResponse = {
  channelEmotes?: BetterTtvEmote[]
  sharedEmotes?: BetterTtvEmote[]
}

type FrankerFaceZEmote = {
  id: number
  name: string
  urls?: Record<string, string>
  animated?: Record<string, string>
}

type FrankerFaceZSet = {
  emoticons?: FrankerFaceZEmote[]
}

type FrankerFaceZGlobalResponse = {
  default_sets?: number[]
  sets?: Record<string, FrankerFaceZSet>
}

type FrankerFaceZRoomResponse = {
  sets?: Record<string, FrankerFaceZSet>
}

type SevenTvFile = {
  name: string
}

type SevenTvHost = {
  url: string
  files?: SevenTvFile[]
}

type SevenTvEmote = {
  id: string
  name: string
  data?: {
    host?: SevenTvHost
    flags?: number
    listed?: boolean
  }
}

type SevenTvEmoteSet = {
  emotes?: SevenTvEmote[]
}

type SevenTvUserResponse = {
  emote_set?: SevenTvEmoteSet
}

const PROVIDER_PRIORITY: Array<Exclude<ChatEmoteProvider, "twitch">> = [
  "7tv",
  "bttv",
  "ffz",
]

export type EmoteServiceOptions = {
  bttvEnabled: boolean
  ffzEnabled: boolean
  seventvEnabled: boolean
  zeroWidthEmotesEnabled: boolean
}

let serviceOptions: EmoteServiceOptions = {
  bttvEnabled: true,
  ffzEnabled: true,
  seventvEnabled: true,
  zeroWidthEmotesEnabled: true,
}

export function getEmoteServiceOptions(): EmoteServiceOptions {
  return serviceOptions
}

export function setEmoteServiceOptions(options: EmoteServiceOptions) {
  serviceOptions = { ...options }
}

/** Drop all cached catalogs so the next load honors the current options. */
export function resetThirdPartyEmoteCache() {
  globalCatalog = null
  globalInflight = null
  roomCache.clear()
  roomInflight.clear()
}

let globalCatalog: ThirdPartyEmoteCatalog | null = null
let globalInflight: Promise<EmoteCatalogEntry[]> | null = null
const roomCache = new Map<string, ThirdPartyEmoteCatalog>()
const roomInflight = new Map<string, Promise<EmoteCatalogEntry[]>>()

export function createEmptyEmoteCatalog(): ThirdPartyEmoteCatalog {
  return new Map()
}

export function isSevenTvZeroWidthEmote(
  emote: Pick<EmoteCatalogEntry, "provider" | "seventvFlags">
) {
  return (
    emote.provider === "7tv" &&
    ((emote.seventvFlags ?? 0) & SEVENTV_EMOTE_FLAG_ZERO_WIDTH) !== 0
  )
}

export async function loadThirdPartyEmoteCatalog(
  roomId: string,
  signal?: AbortSignal
): Promise<ThirdPartyEmoteCatalog> {
  const [globalEmotes, roomEmotes] = await Promise.all([
    loadGlobalEmotes(),
    loadRoomEmotes(roomId, signal),
  ])

  const catalog = createEmptyEmoteCatalog()
  for (const entry of [...roomEmotes, ...globalEmotes]) {
    if (!catalog.has(entry.code)) {
      catalog.set(entry.code, entry)
    }
  }
  return catalog
}

export function hydrateMessageEmotes(
  text: string,
  existing: ChatEmote[],
  catalog: ThirdPartyEmoteCatalog | null
): ChatEmote[] {
  if (!catalog || catalog.size === 0 || !text) {
    return existing
  }

  let result = existing
  let copied = false
  const ensureCopy = () => {
    if (copied) {
      return
    }
    result = existing.map((emote) => ({
      ...emote,
      overlays: emote.overlays ? [...emote.overlays] : undefined,
    }))
    copied = true
  }

  const existingByRange = new Map<string, number>()
  for (let index = 0; index < existing.length; index += 1) {
    const emote = existing[index]!
    existingByRange.set(`${emote.start}:${emote.end}`, index)
  }

  let occupied = normalizeRanges(
    existing.map((emote) => ({ start: emote.start, end: emote.end }))
  )
  let lastEmoteIndex: number | null = null
  let changed = false

  for (const match of text.matchAll(/\S+/g)) {
    const code = match[0]
    const start = match.index ?? -1
    if (start < 0) {
      continue
    }

    const end = start + code.length - 1
    const existingEmoteIndex = existingByRange.get(`${start}:${end}`)
    if (existingEmoteIndex !== undefined) {
      lastEmoteIndex = existingEmoteIndex
      continue
    }

    if (hasOverlap(occupied, start, end)) {
      lastEmoteIndex = null
      continue
    }

    const entry = catalog.get(code)
    if (!entry) {
      lastEmoteIndex = null
      continue
    }

    if (
      isSevenTvZeroWidthEmote(entry) &&
      serviceOptions.zeroWidthEmotesEnabled &&
      lastEmoteIndex !== null
    ) {
      ensureCopy()
      const target = result[lastEmoteIndex]!
      target.overlays = [
        ...(target.overlays ?? []),
        catalogEntryToEmote(entry, start, end),
      ]
      occupied = normalizeRanges([...occupied, { start, end }])
      changed = true
      continue
    }

    ensureCopy()
    result.push(catalogEntryToEmote(entry, start, end))
    existingByRange.set(`${start}:${end}`, result.length - 1)
    occupied = normalizeRanges([...occupied, { start, end }])
    lastEmoteIndex = result.length - 1
    changed = true
  }

  if (!changed) {
    return existing
  }

  return result.sort((left, right) => left.start - right.start)
}

function catalogEntryToEmote(
  entry: EmoteCatalogEntry,
  start: number,
  end: number
): ChatEmote {
  return {
    id: entry.id,
    code: entry.code,
    provider: entry.provider,
    imageUrl: entry.imageUrl,
    start,
    end,
  }
}

function hasOverlap(ranges: TextRange[], start: number, end: number) {
  return ranges.some((range) => start <= range.end && end >= range.start)
}

function normalizeRanges(ranges: TextRange[]): TextRange[] {
  const sorted = ranges
    .filter((range) => range.start >= 0 && range.end >= range.start)
    .sort((left, right) => left.start - right.start)

  if (sorted.length === 0) {
    return []
  }

  const merged = [sorted[0]!]
  for (const range of sorted.slice(1)) {
    const current = merged[merged.length - 1]!
    if (range.start <= current.end + 1) {
      current.end = Math.max(current.end, range.end)
      continue
    }
    merged.push({ ...range })
  }
  return merged
}

async function loadGlobalEmotes() {
  if (globalCatalog) {
    return [...globalCatalog.values()]
  }
  if (!globalInflight) {
    globalInflight = fetchGlobalEmotes().finally(() => {
      globalInflight = null
    })
  }
  const emotes = await globalInflight
  globalCatalog = catalogFromEntries(emotes)
  return emotes
}

async function loadRoomEmotes(roomId: string, signal?: AbortSignal) {
  const id = roomId.trim()
  if (!id) {
    return [] as EmoteCatalogEntry[]
  }
  const cached = roomCache.get(id)
  if (cached) {
    return [...cached.values()]
  }
  let pending = roomInflight.get(id)
  if (!pending) {
    pending = fetchRoomEmotes(id, signal).finally(() => {
      roomInflight.delete(id)
    })
    roomInflight.set(id, pending)
  }
  const emotes = await pending
  roomCache.set(id, catalogFromEntries(emotes))
  return emotes
}

function catalogFromEntries(entries: EmoteCatalogEntry[]) {
  const catalog = createEmptyEmoteCatalog()
  for (const provider of PROVIDER_PRIORITY) {
    for (const entry of entries) {
      if (entry.provider === provider && !catalog.has(entry.code)) {
        catalog.set(entry.code, entry)
      }
    }
  }
  return catalog
}

async function fetchGlobalEmotes() {
  const options = serviceOptions
  const [bttv, ffz, seventv] = await Promise.all([
    options.bttvEnabled
      ? fetchJson<BetterTtvEmote[]>(
          "https://api.betterttv.net/3/cached/emotes/global"
        )
          .then((emotes) => emotes.map(mapBetterTtvEmote))
          .catch(() => [] as EmoteCatalogEntry[])
      : Promise.resolve([] as EmoteCatalogEntry[]),
    options.ffzEnabled
      ? fetchJson<FrankerFaceZGlobalResponse>(
          "https://api.frankerfacez.com/v1/set/global"
        )
          .then((response) =>
            compactFrankerFaceZ(
              extractFrankerFaceZGlobal(response).map(mapFrankerFaceZEmote)
            )
          )
          .catch(() => [] as EmoteCatalogEntry[])
      : Promise.resolve([] as EmoteCatalogEntry[]),
    options.seventvEnabled
      ? fetchJson<SevenTvEmoteSet>("https://7tv.io/v3/emote-sets/global")
          .then((response) =>
            compactSevenTv((response.emotes ?? []).map(mapSevenTvEmote))
          )
          .catch(() => [] as EmoteCatalogEntry[])
      : Promise.resolve([] as EmoteCatalogEntry[]),
  ])

  return [...seventv, ...bttv, ...ffz]
}

async function fetchRoomEmotes(roomId: string, signal?: AbortSignal) {
  const options = serviceOptions
  const [bttv, ffz, seventv] = await Promise.all([
    options.bttvEnabled
      ? fetchJson<BetterTtvUserResponse>(
          `https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(roomId)}`,
          signal
        )
          .then((response) =>
            [
              ...(response.channelEmotes ?? []),
              ...(response.sharedEmotes ?? []),
            ].map(mapBetterTtvEmote)
          )
          .catch(() => [] as EmoteCatalogEntry[])
      : Promise.resolve([] as EmoteCatalogEntry[]),
    options.ffzEnabled
      ? fetchJson<FrankerFaceZRoomResponse>(
          `https://api.frankerfacez.com/v1/room/id/${encodeURIComponent(roomId)}`,
          signal
        )
          .then((response) =>
            compactFrankerFaceZ(
              extractFrankerFaceZ(response.sets).map(mapFrankerFaceZEmote)
            )
          )
          .catch(() => [] as EmoteCatalogEntry[])
      : Promise.resolve([] as EmoteCatalogEntry[]),
    options.seventvEnabled
      ? fetchJson<SevenTvUserResponse>(
          `https://7tv.io/v3/users/twitch/${encodeURIComponent(roomId)}`,
          signal
        )
          .then((response) =>
            compactSevenTv(
              (response.emote_set?.emotes ?? []).map(mapSevenTvEmote)
            )
          )
          .catch(() => [] as EmoteCatalogEntry[])
      : Promise.resolve([] as EmoteCatalogEntry[]),
  ])

  return [...seventv, ...bttv, ...ffz]
}

function mapBetterTtvEmote(emote: BetterTtvEmote): EmoteCatalogEntry {
  return {
    id: emote.id,
    code: emote.code,
    provider: "bttv",
    imageUrl: `https://cdn.betterttv.net/emote/${encodeURIComponent(emote.id)}/1x.${emote.imageType ?? "webp"}`,
  }
}

function mapFrankerFaceZEmote(
  emote: FrankerFaceZEmote
): EmoteCatalogEntry | null {
  const imageUrl = withHttps(emote.animated?.["1"] ?? emote.urls?.["1"] ?? "")
  if (!imageUrl) {
    return null
  }
  return {
    id: String(emote.id),
    code: emote.name,
    provider: "ffz",
    imageUrl,
  }
}

function compactFrankerFaceZ(entries: Array<EmoteCatalogEntry | null>) {
  return entries.filter((emote): emote is EmoteCatalogEntry => emote !== null)
}

function extractFrankerFaceZGlobal(response: FrankerFaceZGlobalResponse) {
  const defaultSets = new Set((response.default_sets ?? []).map(String))
  return Object.entries(response.sets ?? {}).flatMap(([setId, set]) =>
    defaultSets.size === 0 || defaultSets.has(setId)
      ? (set.emoticons ?? [])
      : []
  )
}

function extractFrankerFaceZ(
  sets: Record<string, FrankerFaceZSet> | undefined
) {
  return Object.values(sets ?? {}).flatMap((set) => set.emoticons ?? [])
}

function mapSevenTvEmote(emote: SevenTvEmote): EmoteCatalogEntry | null {
  const imageUrl = buildSevenTvImageUrl(emote.data?.host)
  if (!imageUrl) {
    return null
  }
  return {
    id: emote.id,
    code: emote.name,
    provider: "7tv",
    imageUrl,
    seventvFlags: emote.data?.flags,
    listed: emote.data?.listed ?? true,
  }
}

function compactSevenTv(entries: Array<EmoteCatalogEntry | null>) {
  return entries.filter((emote): emote is EmoteCatalogEntry => emote !== null)
}

function buildSevenTvImageUrl(host: SevenTvHost | undefined) {
  if (!host?.url) {
    return ""
  }
  const file =
    host.files?.find((candidate) => candidate.name.startsWith("1x.")) ??
    host.files?.[0]
  if (!file?.name) {
    return ""
  }
  return withHttps(`${host.url}/${file.name}`)
}

function withHttps(url: string) {
  if (!url) {
    return ""
  }
  if (url.startsWith("//")) {
    return `https:${url}`
  }
  return url
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetchTimeout(url, {
    signal,
    timeoutMs: FETCH_TIMEOUT_MS,
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  return (await response.json()) as T
}
