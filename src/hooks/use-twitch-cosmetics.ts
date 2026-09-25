import { useEffect, useState } from "react"

import {
  fetchTwitchCosmetics,
  type TwitchCosmetics,
} from "@/lib/twitch-cosmetics"

export type TwitchCosmeticsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; cosmetics: TwitchCosmetics }
  | { status: "error"; message: string }

const IDLE = { status: "idle" } as const

export function useTwitchCosmetics(login: string, enabled: boolean) {
  const key = login.trim().toLowerCase()
  const [state, setState] = useState<TwitchCosmeticsState & { key?: string }>({
    status: "idle",
  })

  useEffect(() => {
    if (!enabled || !key) {
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
        const cosmetics = await fetchTwitchCosmetics(key, controller.signal)
        if (cancelled) {
          return
        }
        setState({ key, status: "ready", cosmetics })
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return
        }
        setState({
          key,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to load data.",
        })
      }
    }

    void run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, key])

  if (!enabled || !key) {
    return IDLE
  }

  if (state.status === "idle" || state.key !== key) {
    return { status: "loading" } as TwitchCosmeticsState
  }

  return state
}
