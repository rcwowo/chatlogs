export type TwitchEmote = {
  id: string
  code: string
}

export type TwitchEmoteGroup = {
  title: string
  emotes: TwitchEmote[]
}

export type TwitchBadge = {
  title: string
  description: string
  imageUrl: string
}

export type TwitchCosmetics = {
  emoteGroups: TwitchEmoteGroup[]
  badges: TwitchBadge[]
}

type IvrEmote = {
  id?: string
  code?: string
}

type IvrSubProduct = {
  displayName?: string
  tier?: string
  emotes?: IvrEmote[]
}

type IvrEmoteSet = {
  emotes?: IvrEmote[]
}

type IvrChannelEmotes = {
  subProducts?: IvrSubProduct[]
  localEmotes?: IvrEmoteSet[]
  bitEmotes?: IvrEmote[]
}

type IvrBadgeVersion = {
  id?: string
  title?: string
  description?: string
  image_url_1x?: string
  image_url_2x?: string
}

type IvrBadgeSet = {
  set_id?: string
  versions?: IvrBadgeVersion[]
}

export function twitchEmoteImageUrl(id: string) {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/default/dark/3.0`
}

function tierLabel(tier: string | undefined, fallback: string) {
  if (tier === "1000") {
    return "Tier 1"
  }
  if (tier === "2000") {
    return "Tier 2"
  }
  if (tier === "3000") {
    return "Tier 3"
  }
  return fallback
}

function mapEmoteGroups(data: IvrChannelEmotes | null): TwitchEmoteGroup[] {
  if (!data) {
    return []
  }
  const groups: TwitchEmoteGroup[] = []
  const seen = new Set<string>()

  const push = (title: string, emotes: IvrEmote[]) => {
    const unique = emotes.filter(
      (emote): emote is { id: string; code: string } =>
        Boolean(emote.id && emote.code) && !seen.has(emote.id ?? "")
    )
    for (const emote of unique) {
      seen.add(emote.id)
    }
    if (unique.length > 0) {
      groups.push({ title, emotes: unique })
    }
  }

  for (const sub of data.subProducts ?? []) {
    push(
      sub.displayName || tierLabel(sub.tier, "Subscriber emotes"),
      sub.emotes ?? []
    )
  }
  for (const set of data.localEmotes ?? []) {
    push("Follower emotes", set.emotes ?? [])
  }
  push("Bit emotes", data.bitEmotes ?? [])
  return groups
}

function mapBadges(raw: IvrBadgeSet[] | null): TwitchBadge[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const badges: TwitchBadge[] = []
  const seen = new Set<string>()
  for (const set of raw) {
    for (const version of set.versions ?? []) {
      const imageUrl = version.image_url_2x || version.image_url_1x
      if (!imageUrl) {
        continue
      }
      const title = version.title || version.description || set.set_id || ""
      if (seen.has(title)) {
        continue
      }
      seen.add(title)
      badges.push({
        title,
        description: version.description ?? "",
        imageUrl,
      })
    }
  }
  return badges
}

async function requestBin(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error("Could not load Twitch data from IVR.")
  }
  return response.json()
}

export async function fetchTwitchCosmetics(
  login: string,
  signal?: AbortSignal
): Promise<TwitchCosmetics> {
  const name = login.trim().toLowerCase()
  if (!name) {
    return { emoteGroups: [], badges: [] }
  }

  const [emotesRaw, badgesRaw] = await Promise.all([
    requestBin(
      `https://api.ivr.fi/v2/twitch/emotes/channel/${encodeURIComponent(name)}`,
      signal
    ).catch(() => null),
    requestBin(
      `https://api.ivr.fi/v2/twitch/badges/channel?login=${encodeURIComponent(name)}`,
      signal
    ).catch(() => null),
  ])

  return {
    emoteGroups: mapEmoteGroups(emotesRaw as IvrChannelEmotes | null),
    badges: mapBadges(badgesRaw as IvrBadgeSet[] | null),
  }
}
