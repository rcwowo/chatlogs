import { useEffect, useState } from "react"

import { rememberChannelIdentity } from "@/lib/channel-identity"
import { fromDateKey } from "@/lib/dates"
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

  useEffect(() => {
    if (!login) {
      return
    }
    if (providers.length === 0) {
      return
    }

    const controller = new AbortController()
    let cancelled = false

    async function run() {
      await Promise.resolve()
      if (cancelled) {
        return
      }

      setState({ key, status: "loading" })
      try {
        const [profile, discovery] = await Promise.all([
          fetchTwitchUser(login, controller.signal).then((user) => {
            if (user) {
              rememberChannelIdentity(user)
            }
            return user
          }),
          discoverAvailableLogs(providers, login, controller.signal),
        ])
        if (cancelled) {
          return
        }

        const dates = discovery.dates.filter((dateKey) => fromDateKey(dateKey)?.day)

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
    return IDLE
  }

  if (providers.length === 0) {
    return NO_PROVIDERS
  }

  if (state.status === "idle" || state.key !== key) {
    return LOADING
  }

  return state
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

  useEffect(() => {
    if (!enabled || !login || providers.length === 0) {
      return
    }

    const controller = new AbortController()
    let cancelled = false

    async function run() {
      await Promise.resolve()
      if (cancelled) {
        return
      }
      setState({ key, status: "loading" })
      try {
        const result = await fetchChannelStats(providers, login, controller.signal)
        if (cancelled) {
          return
        }
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
  }, [enabled, key, login, providers])

  if (!enabled || !login) {
    return STATS_IDLE
  }

  if (state.status === "idle" || state.key !== key) {
    return STATS_LOADING
  }

  return state
}
