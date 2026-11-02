import { useCallback, useEffect, useRef, useState } from "react"

import {
  recordProviderResult,
  startProgress,
  type LoadProgress,
} from "@/lib/load-progress"
import type { Provider } from "@/lib/providers"
import {
  fetchChannelLogs,
  type MergedMessage,
  type ProviderStatus,
} from "@/lib/rustlog"

export type DayLogsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; messages: MergedMessage[] }
  | { status: "error"; message: string; statuses?: ProviderStatus[] }

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
  const cache = useRef(new Map<string, MergedMessage[]>())
  const [refreshTick, setRefreshTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [progress, setProgress] = useState<LoadProgress | null>(null)
  const skipRef = useRef<{ key: string; controller: AbortController } | null>(
    null
  )

  /** Stop waiting on slow providers and show what has loaded so far. */
  const skip = useCallback(() => {
    if (skipRef.current?.key === key) {
      skipRef.current.controller.abort()
    }
  }, [key])

  const refresh = useCallback(() => {
    if (!enabled || !channel || !date) {
      return
    }
    cache.current.delete(key)
    setRefreshing(true)
    setRefreshTick((tick) => tick + 1)
  }, [channel, date, enabled, key])

  useEffect(() => {
    if (!enabled || !channel || !date || providers.length === 0) {
      return
    }

    const cached = cache.current.get(key)
    if (cached) {
      setRefreshing(false)
      setState((current) =>
        current.key === key
          ? current
          : { key, status: "ready", messages: cached }
      )
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
      // When refetching an already-shown day, keep the stale messages
      // visible until the fresh response arrives.
      setState((current) =>
        current.key === key ? current : { key, status: "loading" }
      )
      setProgress(
        startProgress(
          key,
          providers.map((provider) => provider.id)
        )
      )
      try {
        const result = await fetchChannelLogs(
          providers,
          channel,
          date,
          controller.signal,
          {
            onProvider: (item) => {
              if (!cancelled) {
                setProgress(
                  (current) =>
                    current && recordProviderResult(current, key, item)
                )
              }
            },
            skip: skipController.signal,
            onMerge: (total) => {
              if (!cancelled) {
                setProgress((current) =>
                  current?.key === key
                    ? { ...current, merging: { total } }
                    : current
                )
              }
            },
          }
        )
        if (cancelled) {
          return
        }
        const anyOk = result.statuses.some((item) => item.status === "ok")
        const anyError = result.statuses.some((item) => item.status === "error")
        if (!anyOk && anyError) {
          setRefreshing(false)
          const firstError = result.statuses.find((item) => item.error)?.error
          setState({
            key,
            status: "error",
            message: firstError || "Failed to load messages.",
            statuses: result.statuses,
          })
          return
        }
        // Partial results aren't cached, so coming back refetches everything.
        if (!result.statuses.some((item) => item.skipped)) {
          cache.current.set(key, result.messages)
        }
        setRefreshing(false)
        setState({ key, status: "ready", messages: result.messages })
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return
        }
        setRefreshing(false)
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
  }, [channel, date, enabled, key, providers, refreshTick])

  if (!enabled || !channel || !date) {
    return { state: IDLE, refreshing: false, refresh, skip, progress: null }
  }

  return {
    state: state.status === "idle" || state.key !== key ? LOADING : state,
    refreshing,
    refresh,
    skip,
    progress: progress?.key === key ? progress : null,
  }
}
