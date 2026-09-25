import { useCallback, useEffect, useState } from "react"

import { parseLogsQuery, serializeLogsQuery, type LogsQuery } from "@/lib/query"

export function useLogsQuery() {
  const [query, setQueryState] = useState<LogsQuery>(() =>
    parseLogsQuery(window.location.search)
  )

  const setQuery = useCallback((patch: Partial<LogsQuery>) => {
    setQueryState((current) => {
      const next = { ...current, ...patch }
      const search = serializeLogsQuery(next)
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${search}`
      )
      return next
    })
  }, [])

  const replaceQuery = useCallback((next: LogsQuery) => {
    setQueryState(next)
    const search = serializeLogsQuery(next)
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search}`
    )
  }, [])

  useEffect(() => {
    const onPopState = () => {
      setQueryState(parseLogsQuery(window.location.search))
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  return { query, setQuery, replaceQuery }
}
