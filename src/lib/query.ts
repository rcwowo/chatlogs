export type AppTab = "logs" | "user"

export type LogsQuery = {
  channel: string
  tab: AppTab
  date: string
  user: string
  q: string
}

function parseTab(value: string | null): AppTab {
  if (value === "user") {
    return value
  }
  return "logs"
}

export function parseLogsQuery(search: string): LogsQuery {
  const params = new URLSearchParams(search)
  return {
    channel: (params.get("channel") ?? "").trim(),
    tab: parseTab(params.get("tab")),
    date: (params.get("date") ?? "").trim(),
    user: (params.get("user") ?? "").trim(),
    q: params.get("q") ?? "",
  }
}

export function serializeLogsQuery(query: LogsQuery) {
  const params = new URLSearchParams()
  if (query.channel) {
    params.set("channel", query.channel)
  }
  if (query.tab !== "logs") {
    params.set("tab", query.tab)
  }
  if (query.date) {
    params.set("date", query.date)
  }
  if (query.user) {
    params.set("user", query.user)
  }
  if (query.q) {
    params.set("q", query.q)
  }
  const value = params.toString()
  return value ? `?${value}` : ""
}
