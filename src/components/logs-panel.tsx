import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  CalendarDaysIcon,
  FilterIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react"

import { LogCalendar } from "@/components/log-calendar"
import { LogUserCard } from "@/components/chat/user-card"
import { LogViewer } from "@/components/log-viewer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import type { ChatCatalog } from "@/hooks/use-chat-catalog"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import type { DayLogsState } from "@/hooks/use-day-logs"
import { formatDateKey } from "@/lib/dates"
import {
  collectSearchUsernames,
  getSearchSuggestions,
  getSearchTokenAtCursor,
  parseSearchQuery,
  isSearchQueryActive,
  removeSearchFilterRange,
  replaceSearchToken,
  searchLogMessages,
} from "@/lib/chat/search"
import { readJson, writeJson } from "@/lib/storage"

const ORDER_STORAGE_KEY = "chatlogs.newestAtBottom"

export function LogsPanel({
  channelLogin,
  date,
  dates,
  userFilter,
  filterQuery,
  logs,
  onRefreshLogs,
  refreshingLogs,
  catalog,
  onUserFilter,
  onFilterQuery,
  onDateChange,
}: {
  channelLogin: string
  date: string
  dates: string[]
  userFilter: string
  filterQuery: string
  logs: DayLogsState
  onRefreshLogs: () => void
  refreshingLogs: boolean
  catalog: ChatCatalog
  onUserFilter: (user: string) => void
  onFilterQuery: (q: string) => void
  onDateChange: (date: string) => void
}) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [newestAtBottom, setNewestAtBottom] = useState(() => {
    const stored = readJson<unknown>(ORDER_STORAGE_KEY, true)
    return typeof stored === "boolean" ? stored : true
  })
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0)

  useEffect(() => {
    writeJson(ORDER_STORAGE_KEY, newestAtBottom)
  }, [newestAtBottom])

  function toggleDirection() {
    const next = !newestAtBottom
    writeJson(ORDER_STORAGE_KEY, next)
    setNewestAtBottom(next)
  }

  const messages = logs.status === "ready" ? logs.messages : []
  const usernames = useMemo(
    () => collectSearchUsernames(messages),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs]
  )
  const parsed = useMemo(() => parseSearchQuery(filterQuery), [filterQuery])
  const queryActive = isSearchQueryActive(parsed) || Boolean(userFilter.trim())

  // The full-list scan is expensive for large channels, so wait until typing
  // settles before filtering. The raw query still drives the input,
  // suggestions, and filter chips immediately.
  const FILTER_SETTLE_MS = 200
  const settledFilterQuery = useDebouncedValue(filterQuery, FILTER_SETTLE_MS)
  const emotes = catalog.emotes
  const filtered = useMemo(
    () =>
      logs.status === "ready"
        ? searchLogMessages(
            logs.messages,
            settledFilterQuery,
            userFilter,
            emotes
          )
        : [],
    [logs, emotes, settledFilterQuery, userFilter]
  )
  const filterPending = settledFilterQuery !== filterQuery
  const [caret, setCaret] = useState(filterQuery.length)

  function updateCaret(next: number) {
    setCaret(next)
  }
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => {
    if (!filterOpen) {
      return []
    }
    const token = getSearchTokenAtCursor(filterQuery, caret)
    return getSearchSuggestions({ token, usernames })
  }, [filterOpen, filterQuery, usernames, caret])

  const token = getSearchTokenAtCursor(filterQuery, caret)
  const activeSuggestion =
    suggestions.length > 0
      ? suggestions[Math.min(highlightedSuggestion, suggestions.length - 1)]!
      : null

  function rememberCaret() {
    updateCaret(inputRef.current?.selectionStart ?? filterQuery.length)
  }

  function applySuggestion(insert: string) {
    const result = replaceSearchToken(filterQuery, token, insert)
    onFilterQuery(result.query)
    updateCaret(result.cursor)
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (input) {
        input.focus()
        input.setSelectionRange(result.cursor, result.cursor)
      }
    })
  }

  function removeFilterAt(start: number, end: number) {
    onFilterQuery(removeSearchFilterRange(filterQuery, start, end))
  }

  const visibleCount = filtered.length

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shrink-0 rounded-full bg-background text-muted-foreground hover:text-foreground"
          aria-label="Refresh messages"
          onClick={onRefreshLogs}
        >
          <RefreshCwIcon className={cn(refreshingLogs && "animate-spin")} />
        </Button>
        <p className="min-w-0 text-sm text-muted-foreground">
          {logs.status === "ready" ? (
            <>
              Showing{" "}
              <span className="font-medium text-foreground tabular-nums">
                {visibleCount.toLocaleString()}
              </span>
              {visibleCount !== logs.messages.length ? (
                <>
                  {" "}
                  of{" "}
                  <span className="tabular-nums">
                    {logs.messages.length.toLocaleString()}
                  </span>
                </>
              ) : null}{" "}
              {visibleCount === 1 ? "message" : "messages"}
              {filterPending ? (
                <span className="ml-2 text-xs opacity-70">Filtering…</span>
              ) : null}
            </>
          ) : (
            "Channel logs"
          )}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-full bg-background text-muted-foreground hover:text-foreground"
            aria-label={
              newestAtBottom
                ? "New messages start at the bottom. Switch to top."
                : "New messages start at the top. Switch to bottom."
            }
            onClick={toggleDirection}
          >
            {newestAtBottom ? (
              <ArrowDownWideNarrowIcon />
            ) : (
              <ArrowUpNarrowWideIcon />
            )}
          </Button>

          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="icon"
                  variant={queryActive ? "secondary" : "ghost"}
                  className={cn(
                    "rounded-full",
                    queryActive
                      ? "bg-purple-500/20 text-purple-600 hover:text-purple-600 dark:bg-purple-400/20 dark:text-purple-300 dark:hover:text-purple-300"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Filter messages"
                />
              }
            >
              <FilterIcon />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              {parsed.filters.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {parsed.filters.map((filter) => (
                    <button
                      key={`${filter.key}:${filter.value}:${filter.start}`}
                      type="button"
                      className="flex items-center gap-1 rounded-md bg-purple-500/15 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-500/25 dark:bg-purple-400/15 dark:text-purple-200 dark:hover:bg-purple-400/25"
                      aria-label={`Remove ${filter.key} filter`}
                      onClick={() => removeFilterAt(filter.start, filter.end)}
                    >
                      <span className="text-muted-foreground">
                        {filter.key}:
                      </span>
                      {filter.value}
                      <XIcon className="size-3 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : null}

              <Input
                ref={inputRef}
                value={filterQuery}
                onChange={(event) => {
                  onFilterQuery(event.target.value)
                  updateCaret(event.target.selectionStart ?? 0)
                  setHighlightedSuggestion(0)
                }}
                onKeyUp={rememberCaret}
                onClick={rememberCaret}
                onFocus={rememberCaret}
                onKeyDown={(event) => {
                  updateCaret(event.currentTarget.selectionStart ?? caret)

                  if (suggestions.length > 0) {
                    if (event.key === "ArrowDown") {
                      event.preventDefault()
                      setHighlightedSuggestion(
                        (current) => (current + 1) % suggestions.length
                      )
                      return
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault()
                      setHighlightedSuggestion(
                        (current) =>
                          (current - 1 + suggestions.length) %
                          suggestions.length
                      )
                      return
                    }
                    if (/^(?:Enter|Tab)$/.test(event.key) && activeSuggestion) {
                      event.preventDefault()
                      applySuggestion(activeSuggestion.insert)
                      return
                    }
                  }
                }}
                placeholder="Filter messages. Try from:, role: or has:"
                autoComplete="off"
                autoFocus
              />

              {userFilter && !filterQuery.includes("from:") ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md bg-purple-500/15 px-2 py-1 font-medium text-purple-700 hover:bg-purple-500/25 dark:bg-purple-400/15 dark:text-purple-200 dark:hover:bg-purple-400/25"
                    onClick={() => onUserFilter("")}
                  >
                    <span className="text-muted-foreground">from:</span>
                    {userFilter}
                    <XIcon className="size-3" />
                  </button>
                </div>
              ) : null}

              {activeSuggestion ? (
                <div className="flex flex-col gap-0.5">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      className={cn(
                        "flex items-baseline gap-2 rounded-md px-2 py-1 text-left text-xs",
                        index ===
                          Math.min(
                            highlightedSuggestion,
                            suggestions.length - 1
                          ) && "bg-purple-500/10 dark:bg-purple-400/10"
                      )}
                      onMouseEnter={() => setHighlightedSuggestion(index)}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        applySuggestion(suggestion.insert)
                      }}
                    >
                      <span className="font-medium">{suggestion.label}</span>
                      <span className="truncate text-muted-foreground">
                        {suggestion.description}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </PopoverContent>
          </Popover>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full bg-background px-2.5 text-muted-foreground hover:text-foreground"
                  disabled={dates.length === 0}
                  aria-label="Log calendar"
                />
              }
            >
              <CalendarDaysIcon />
              {date ? (
                <span className="text-xs font-medium">
                  {formatDateKey(date)}
                </span>
              ) : null}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <LogCalendar
                dates={dates}
                date={date}
                onChange={(next) => {
                  onDateChange(next)
                  setCalendarOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <LogWell>
        {logs.status === "loading" ? (
          <div className="flex flex-1 flex-col gap-2 px-4 py-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : null}

        {logs.status === "error" ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            {logs.message}
          </p>
        ) : null}

        {logs.status === "ready" ? (
          <LogViewer
            key={`${channelLogin}|${date}`}
            messages={queryActive ? filtered : messages}
            contextMessages={messages}
            isFiltered={visibleCount !== logs.messages.length}
            onClearFilters={() => {
              if (filterQuery.trim()) {
                onFilterQuery("")
              }
              if (userFilter) {
                onUserFilter("")
              }
            }}
            total={logs.messages.length}
            badges={catalog.badges}
            emotes={catalog.emotes}
            newestAtBottom={newestAtBottom}
          />
        ) : null}

        {logs.status === "idle" ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            Pick a day from the calendar to load chat.
          </p>
        ) : null}
      </LogWell>

      <LogUserCard
        channelLogin={channelLogin}
        messages={messages}
        emotes={catalog.emotes}
        onFilterUser={onUserFilter}
      />
    </div>
  )
}

function LogWell({ children }: { children: ReactNode }) {
  return (
    <div className="chat-panel mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      {children}
    </div>
  )
}
