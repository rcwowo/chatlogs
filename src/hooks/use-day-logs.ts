import { useEffect, useState } from "react"

import type { Provider } from "@/lib/providers"
import {
  fetchChannelLogs,
  type MergedMessage,
} from "@/lib/rustlog"

export type DayLogsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; messages: MergedMessage[] }
  | { status: "error"; message: string }

const IDLE = { status: "idle" } as const
const LOADING = { status: "loading" } as const

export function useDayLogs(
  channel: string,
  date: string,
  providers: Provider[],
  enabled: boolean
) {
  const key = `${channel}|${date}|${providers.map((provider) => provider.id).join(",")}`
  const [state, setState] = useState<DayLogsState & { key?: string }>({
    status: "idle",
  })

  useEffect(() => {
    if (!enabled || !channel || !date || providers.length === 0) {
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
        const result = await fetchChannelLogs(
          providers,
          channel,
          date,
          controller.signal
        )
        if (cancelled) {
          return
        }
        const anyOk = result.statuses.some((item) => item.status === "ok")
        const anyError = result.statuses.some((item) => item.status === "error")
        if (!anyOk && anyError) {
          const firstError = result.statuses.find((item) => item.error)?.error
          setState({
            key,
            status: "error",
            message: firstError || "Failed to load messages.",
          })
          return
        }
        setState({ key, status: "ready", messages: result.messages })
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return
        }
        setState({
          key,
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to load messages.",
        })
      }
    }

    void run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [channel, date, enabled, key, providers])

  if (!enabled || !channel || !date) {
    return IDLE
  }

  if (state.status === "idle" || state.key !== key) {
    return LOADING
  }

  return state
}
