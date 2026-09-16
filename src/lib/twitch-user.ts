export type TwitchUser = {
  id: string
  login: string
  displayName: string
  logo: string
  banner: string | null
  bio: string
  followers: number | null
  createdAt: string | null
  chatColor: string | null
  banned: boolean
  roles: {
    isAffiliate: boolean
    isPartner: boolean
    isStaff: boolean | null
  }
  lastBroadcast: {
    startedAt: string | null
    title: string | null
  } | null
  stream: { title?: string | null } | null
  chatSettings: { rules?: string[] } | null
}

type IvrUser = {
  id?: string
  login?: string
  displayName?: string
  logo?: string
  banner?: string | null
  bio?: string
  followers?: number | null
  createdAt?: string | null
  chatColor?: string | null
  banned?: boolean
  roles?: {
    isAffiliate?: boolean
    isPartner?: boolean
    isStaff?: boolean | null
  }
  lastBroadcast?: { startedAt?: string | null; title?: string | null } | null
  stream?: { title?: string | null } | null
  chatSettings?: { rules?: string[] } | null
}

const cache = new Map<string, TwitchUser | null>()
const inflight = new Map<string, Promise<TwitchUser | null>>()

function mapUser(raw: IvrUser): TwitchUser | null {
  if (!raw.login && !raw.id) {
    return null
  }
  return {
    id: raw.id ?? "",
    login: (raw.login ?? "").toLowerCase(),
    displayName: raw.displayName || raw.login || raw.id || "",
    logo: raw.logo ?? "",
    banner: raw.banner ?? null,
    bio: raw.bio ?? "",
    followers: raw.followers ?? null,
    createdAt: raw.createdAt ?? null,
    chatColor: raw.chatColor ?? null,
    banned: raw.banned ?? false,
    roles: {
      isAffiliate: raw.roles?.isAffiliate ?? false,
      isPartner: raw.roles?.isPartner ?? false,
      isStaff: raw.roles?.isStaff ?? null,
    },
    lastBroadcast: raw.lastBroadcast
      ? {
          startedAt: raw.lastBroadcast.startedAt ?? null,
          title: raw.lastBroadcast.title ?? null,
        }
      : null,
    stream: raw.stream ?? null,
    chatSettings: raw.chatSettings ?? null,
  }
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise
  }
  if (signal.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException("Aborted", "AbortError")
    )
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort)
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
    }
    signal.addEventListener("abort", onAbort)
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort)
        if (signal.aborted) {
          onAbort()
          return
        }
        resolve(value)
      },
      (error) => {
        signal.removeEventListener("abort", onAbort)
        reject(error)
      }
    )
  })
}

function requestTwitchUser(key: string): Promise<TwitchUser | null> {
  const pending = inflight.get(key)
  if (pending) {
    return pending
  }

  const request = (async () => {
    try {
      const url = new URL("https://api.ivr.fi/v2/twitch/user")
      if (/^\d+$/.test(key)) {
        url.searchParams.set("id", key)
      } else {
        url.searchParams.set("login", key)
      }
      const response = await fetch(url)
      if (response.status === 404) {
        cache.set(key, null)
        return null
      }
      if (!response.ok) {
        return null
      }
      const data = (await response.json()) as IvrUser | IvrUser[]
      const raw = Array.isArray(data) ? data[0] : data
      const user = raw ? mapUser(raw) : null
      cache.set(key, user)
      if (user?.login && user.login !== key) {
        cache.set(user.login, user)
      }
      return user
    } catch {
      return null
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, request)
  return request
}

export async function fetchTwitchUser(
  login: string,
  signal?: AbortSignal
): Promise<TwitchUser | null> {
  const key = login.trim().toLowerCase()
  if (!key) {
    return null
  }
  if (cache.has(key)) {
    return cache.get(key) ?? null
  }

  return withAbort(requestTwitchUser(key), signal)
}

export type TwitchSubage = {
  followedAt: string | null
  statusHidden: boolean
  months: number | null
}

export async function fetchTwitchSubage(
  userLogin: string,
  channelLogin: string,
  signal?: AbortSignal
): Promise<TwitchSubage | null> {
  const user = userLogin.trim().replace(/^#|@/g, "").toLowerCase()
  const channel = channelLogin.trim().replace(/^#|@/g, "").toLowerCase()
  if (!user || !channel) {
    return null
  }

  const response = await fetch(
    `https://api.ivr.fi/v2/twitch/subage/${encodeURIComponent(user)}/${encodeURIComponent(channel)}`,
    { signal }
  )
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error("Could not load subage from IVR.")
  }

  const data = (await response.json()) as {
    statusHidden?: boolean
    followedAt?: string | null
    cumulative?: { months?: number | null } | null
  }

  return {
    followedAt: data.followedAt ?? null,
    statusHidden: data.statusHidden ?? false,
    months: data.cumulative?.months ?? null,
  }
}
