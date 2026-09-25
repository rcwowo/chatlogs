import type { ChatBadgeRef } from "@/lib/chat/types"

const IVR_BASE = "https://api.ivr.fi/v2/twitch"
const GLOBAL_CACHE_KEY = "chatlogs:badges:global"
const CHANNEL_CACHE_PREFIX = "chatlogs:badges:channel:"
const GLOBAL_TTL_MS = 3 * 24 * 60 * 60 * 1000
const CHANNEL_TTL_MS = 24 * 60 * 60 * 1000

export type ResolvedChatBadge = {
  id: string
  setId: string
  version: string
  title: string
  description: string
  imageUrl: string
  imageUrl2x: string
}

export type ChatBadgeCatalog = Map<string, ResolvedChatBadge>

type IvrBadgeVersion = {
  id?: string
  image_url_1x?: string
  image_url_2x?: string
  imageUrl1x?: string
  imageUrl2x?: string
  title?: string
  description?: string
}

type IvrBadgeSet = {
  set_id?: string
  setId?: string
  versions?: IvrBadgeVersion[]
}

type CachedBadgeSets = {
  cachedAt: string
  sets: IvrBadgeSet[]
}

export function createEmptyBadgeCatalog(): ChatBadgeCatalog {
  return new Map()
}

export function badgeCatalogKey(setId: string, version: string) {
  return `${setId}:${version}`
}

export function buildBadgeCatalog(sets: IvrBadgeSet[]): ChatBadgeCatalog {
  const catalog = createEmptyBadgeCatalog()

  for (const set of sets) {
    const setId = set.set_id ?? set.setId ?? ""
    if (!setId) {
      continue
    }
    for (const version of set.versions ?? []) {
      const id = version.id ?? ""
      const imageUrl = version.image_url_1x ?? version.imageUrl1x ?? ""
      if (!id || !imageUrl) {
        continue
      }
      catalog.set(badgeCatalogKey(setId, id), {
        id: badgeCatalogKey(setId, id),
        setId,
        version: id,
        title: version.title || setId,
        description: version.description || version.title || setId,
        imageUrl,
        imageUrl2x: version.image_url_2x ?? version.imageUrl2x ?? imageUrl,
      })
    }
  }

  return catalog
}

export function mergeBadgeCatalogs(
  globalCatalog: ChatBadgeCatalog,
  channelCatalog: ChatBadgeCatalog
): ChatBadgeCatalog {
  return new Map([...globalCatalog, ...channelCatalog])
}

export function resolveMessageBadges(
  badges: ChatBadgeRef[],
  catalog: ChatBadgeCatalog
): ResolvedChatBadge[] {
  const resolved: ResolvedChatBadge[] = []
  for (const badge of badges) {
    const entry = catalog.get(badgeCatalogKey(badge.set, badge.version))
    if (entry) {
      resolved.push(entry)
    }
  }
  return resolved
}

export async function loadGlobalBadgeCatalog(): Promise<ChatBadgeCatalog> {
  const cached = readCachedSets(GLOBAL_CACHE_KEY, GLOBAL_TTL_MS)
  if (cached) {
    return buildBadgeCatalog(cached)
  }

  const sets = await fetchBadgeSets(`${IVR_BASE}/badges/global`)
  writeCachedSets(GLOBAL_CACHE_KEY, sets)
  return buildBadgeCatalog(sets)
}

export async function loadChannelBadgeCatalog(
  broadcasterId: string,
  signal?: AbortSignal
): Promise<ChatBadgeCatalog> {
  const id = broadcasterId.trim()
  if (!id) {
    return createEmptyBadgeCatalog()
  }

  const cacheKey = `${CHANNEL_CACHE_PREFIX}${id}`
  const cached = readCachedSets(cacheKey, CHANNEL_TTL_MS)
  if (cached) {
    return buildBadgeCatalog(cached)
  }

  const url = new URL(`${IVR_BASE}/badges/channel`)
  url.searchParams.set("id", id)
  const sets = await fetchBadgeSets(url.toString(), signal)
  writeCachedSets(cacheKey, sets)
  return buildBadgeCatalog(sets)
}

async function fetchBadgeSets(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Failed to load badges (${response.status})`)
  }
  const data = (await response.json()) as
    IvrBadgeSet[] | { data?: IvrBadgeSet[] }
  return Array.isArray(data) ? data : (data.data ?? [])
}

function readCachedSets(key: string, ttlMs: number): IvrBadgeSet[] | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as CachedBadgeSets
    const cachedAt = Date.parse(parsed.cachedAt)
    if (Number.isNaN(cachedAt) || Date.now() - cachedAt > ttlMs) {
      window.localStorage.removeItem(key)
      return null
    }
    return parsed.sets
  } catch {
    return null
  }
}

function writeCachedSets(key: string, sets: IvrBadgeSet[]) {
  if (typeof window === "undefined") {
    return
  }
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        cachedAt: new Date().toISOString(),
        sets,
      } satisfies CachedBadgeSets)
    )
  } catch {}
}
