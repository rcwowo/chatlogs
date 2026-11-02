import { useCallback, useEffect, useRef, useState } from "react"

import { rememberChannelIdentity } from "@/lib/channel-identity"
import { fromDateKey } from "@/lib/dates"
import {
  recordProviderResult,
  startProgress,
  type LoadProgress,
} from "@/lib/load-progress"
import type { Provider } from "@/lib/providers"
import {
  discoverAvailableLogs,
  fetchChannelStats,
  type ChannelStats,
  type DateDiscovery,
  type ProviderStatus,
} from "@/lib/rustlog"
import { fetchTwitchUser, type TwitchUser } from "@/lib/twitch-user"

export type ChannelMeta =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready"
      profile: TwitchUser | null
      dates: string[]
      discovery: DateDiscovery
      statuses: ProviderStatus[]
    }
  | { status: "error"; message: string; statuses?: ProviderStatus[] }

const IDLE = { status: "idle" } as const
const LOADING = { status: "loading" } as const
const NO_PROVIDERS = {
  status: "error" as const,
  message: "Enable at least one rustlog endpoint in Providers.",
}

export type ChannelStatsState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready"
      stats: (ChannelStats & { providerId: string }) | null
      statuses: ProviderStatus[]
    }
  | { status: "error"; message: string }

const STATS_IDLE = { status: "idle" } as const
const STATS_LOADING = { status: "loading" } as const

export function useChannel(channel: string, providers: Provider[]) {
  const login = channel.trim()
  const [state, setState] = useState<ChannelMeta & { key?: string }>({
    status: "idle",
  })
  const key = `${login}|${providers.map((provider) => provider.id).join(",")}`
  const [progress, setProgress] = useState<LoadProgress | null>(null)
  const skipRef = useRef<{ key: string; controller: AbortController } | null>(
    null
  )

  /** Stop waiting on slow providers and use the days found so far. */
  const skip = useCallback(() => {
    if (skipRef.current?.key === key) {
      skipRef.current.controller.abort()
    }
  }, [key])

  useEffect(() => {
    if (!login) {
      return
    }
    if (providers.length === 0) {
      return
    }

    const controller = new AbortController()
    const skipController = new AbortController()
    skipRef.current = { key, controller: skipController }
    let cancelled = false

    async function run() {
      await Promise.resolve()
      if (cancelled) {
        return
      }

      setState({ key, status: "loading" })
      setProgress(
        startProgress(
          key,
          providers.map((provider) => provider.id),
          { profile: "pending" }
        )
      )
      try {
        const [profile, discovery] = await Promise.all([
          whenNotSkipped(
            fetchTwitchUser(login, controller.signal),
            skipController.signal,
            null
          ).then((user) => {
            if (user) {
              rememberChannelIdentity(user)
            }
            if (!cancelled) {
              setProgress((current) =>
                current?.key === key ? { ...current, profile: "done" } : current
              )
            }
            return user
          }),
          discoverAvailableLogs(
            providers,
            login,
            controller.signal,
            (item) => {
              if (!cancelled) {
                setProgress(
                  (current) =>
                    current && recordProviderResult(current, key, item)
                )
              }
            },
            skipController.signal
          ),
        ])
        if (cancelled) {
          return
        }

        const dates = discovery.dates.filter(
          (dateKey) => fromDateKey(dateKey)?.day
        )

        if (dates.length === 0) {
          const hadError = discovery.statuses.some(
            (item) => item.status === "error"
          )
          setState({
            key,
            status: "error",
            message: hadError
              ? "No logs found, and some endpoints failed. Check Providers."
              : "None of the enabled endpoints have logs for that channel.",
            statuses: discovery.statuses,
          })
          return
        }

        setState({
          key,
          status: "ready",
          profile,
          dates,
          discovery,
          statuses: discovery.statuses,
        })
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return
        }
        setState({
          key,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to load channel.",
        })
      }
    }

    void run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [key, login, providers])

  if (!login) {
    return { meta: IDLE, progress: null, skip }
  }

  if (providers.length === 0) {
    return { meta: NO_PROVIDERS, progress: null, skip }
  }

  return {
    skip,
    meta: state.status === "idle" || state.key !== key ? LOADING : state,
    progress: progress?.key === key ? progress : null,
  }
}

/** Resolves to `fallback` once `skip` aborts, if `promise` is still pending. */
function whenNotSkipped<T>(
  promise: Promise<T>,
  skip: AbortSignal,
  fallback: T
): Promise<T> {
  return new Promise((resolve, reject) => {
    const onSkip = () => resolve(fallback)
    skip.addEventListener("abort", onSkip, { once: true })
    promise.then(resolve, reject).finally(() => {
      skip.removeEventListener("abort", onSkip)
    })
  })
}

export function useChannelStats(
  channel: string,
  providers: Provider[],
  enabled: boolean
) {
  const login = channel.trim()
  const key = `${login}|${providers.map((provider) => provider.id).join(",")}`
  const [state, setState] = useState<ChannelStatsState & { key?: string }>({
    status: "idle",
  })
  const cache = useRef(
    new Map<
      string,
      {
        stats: (ChannelStats & { providerId: string }) | null
        statuses: ProviderStatus[]
      }
    >()
  )
  const [refreshTick, setRefreshTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(() => {
    if (!enabled || !channel) {
      return
    }
    cache.current.delete(key)
    setRefreshing(true)
    setRefreshTick((tick) => tick + 1)
  }, [channel, enabled, key])

  useEffect(() => {
    if (!enabled || !login || providers.length === 0) {
      return
    }

    const cached = cache.current.get(key)
    if (cached) {
      setRefreshing(false)
      setState((current) =>
        current.key === key
          ? current
          : {
              key,
              status: "ready",
              stats: cached.stats,
              statuses: cached.statuses,
            }
      )
      return
    }

    const controller = new AbortController()
    let cancelled = false

    async function run() {
      await Promise.resolve()
      if (cancelled) {
        return
      }
      // When refreshing already-shown stats, keep them visible while refetching.
      setState((current) =>
        current.key === key ? current : { key, status: "loading" }
      )
      try {
        const result = await fetchChannelStats(
          providers,
          login,
          controller.signal
        )
        if (cancelled) {
          return
        }
        cache.current.set(key, {
          stats: result.stats,
          statuses: result.statuses,
        })
        setRefreshing(false)
        setState({
          key,
          status: "ready",
          stats: result.stats,
          statuses: result.statuses,
        })
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return
        }
        setRefreshing(false)
        setState({
          key,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to load stats.",
        })
      }
    }

    void run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, key, login, providers, refreshTick])

  if (!enabled || !login) {
    return { state: STATS_IDLE, refreshing: false, refresh }
  }

  return {
    state: state.status === "idle" || state.key !== key ? STATS_LOADING : state,
    refreshing,
    refresh,
  }
}
