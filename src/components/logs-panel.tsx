import { useMemo, useState, type ReactNode } from "react"
import { CalendarDaysIcon, FilterIcon, SearchIcon, XIcon } from "lucide-react"

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
import type { DayLogsState } from "@/hooks/use-day-logs"
import { filterLogMessages } from "@/lib/chat/filter"
import { formatDateKey } from "@/lib/dates"

export function LogsPanel({
  channelLogin,
  date,
  dates,
  userFilter,
  textFilter,
  logs,
  catalog,
  onUserFilter,
  onTextFilter,
  onDateChange,
}: {
  channelLogin: string
  date: string
  dates: string[]
  userFilter: string
  textFilter: string
  logs: DayLogsState
  catalog: ChatCatalog
  onUserFilter: (user: string) => void
  onTextFilter: (q: string) => void
  onDateChange: (date: string) => void
}) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const messages = logs.status === "ready" ? logs.messages : []
  const filtered = useMemo(
    () =>
      logs.status === "ready"
        ? filterLogMessages(logs.messages, userFilter, textFilter)
        : [],
    [logs, textFilter, userFilter]
  )
  const visibleCount = filtered.length

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5">
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
            </>
          ) : (
            "Channel logs"
          )}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="icon"
                  variant={textFilter ? "secondary" : "ghost"}
                  className={cn(
                    "rounded-full text-muted-foreground hover:text-foreground",
                    !textFilter && "bg-background"
                  )}
                  aria-label="Search this day"
                />
              }
            >
              <SearchIcon />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="flex items-center gap-2">
                <Input
                  value={textFilter}
                  onChange={(event) => onTextFilter(event.target.value)}
                  placeholder="Search this day"
                  autoComplete="off"
                  autoFocus
                />
                {textFilter ? (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Clear search"
                    onClick={() => onTextFilter("")}
                  >
                    <XIcon />
                  </Button>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="icon"
                  variant={userFilter ? "secondary" : "ghost"}
                  className={cn(
                    "rounded-full text-muted-foreground hover:text-foreground",
                    !userFilter && "bg-background"
                  )}
                  aria-label="Filter by chatter"
                />
              }
            >
              <FilterIcon />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="flex items-center gap-2">
                <Input
                  value={userFilter}
                  onChange={(event) => onUserFilter(event.target.value)}
                  placeholder="Filter by chatter"
                  autoComplete="off"
                  autoFocus
                />
                {userFilter ? (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Clear chatter filter"
                    onClick={() => onUserFilter("")}
                  >
                    <XIcon />
                  </Button>
                ) : null}
              </div>
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
            messages={filtered}
            total={logs.messages.length}
            badges={catalog.badges}
            emotes={catalog.emotes}
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
