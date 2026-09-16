import { useMemo, useState } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { ChannelHeader } from "@/components/channel-header"
import { LogsPanel } from "@/components/logs-panel"
import { ProviderSettings } from "@/components/provider-settings"
import { StatsPanel } from "@/components/stats-panel"
import { UserPanel } from "@/components/user-panel"
import { UserCardProvider } from "@/hooks/use-user-card"
import { useChatCatalog } from "@/hooks/use-chat-catalog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useBookmarks } from "@/hooks/use-bookmarks"
import { useChannel, useChannelStats } from "@/hooks/use-channel"
import { useDayLogs } from "@/hooks/use-day-logs"
import { useLogsQuery } from "@/hooks/use-logs-query"
import { useProviders } from "@/hooks/use-providers"
import type { AppTab } from "@/lib/query"
import { parseTarget } from "@/lib/twitch"

export function App() {
  const { query, setQuery, replaceQuery } = useLogsQuery()
  const { providers, enabled, setEnabled, add, remove } = useProviders()
  const { bookmarks, add: addBookmark, remove: removeBookmark, has } = useBookmarks()
  const [providersOpen, setProvidersOpen] = useState(false)

  const channel = parseTarget(query.channel)?.value ?? ""
  const meta = useChannel(channel, enabled)
  const dates = meta.status === "ready" ? meta.dates : []
  const effectiveDate =
    query.date && dates.includes(query.date) ? query.date : (dates[0] ?? "")

  const datedProviders = useMemo(() => {
    if (meta.status !== "ready" || !effectiveDate) {
      return enabled
    }
    const ids = new Set(
      meta.discovery.providersForDate.get(effectiveDate) ?? []
    )
    const subset = enabled.filter((provider) => ids.has(provider.id))
    return subset.length > 0 ? subset : enabled
  }, [effectiveDate, enabled, meta])

  const logs = useDayLogs(
    channel,
    effectiveDate,
    datedProviders,
    query.tab === "logs" && meta.status === "ready" && Boolean(effectiveDate)
  )
  const roomId = meta.status === "ready" ? (meta.profile?.id ?? "") : ""
  const catalog = useChatCatalog(
    roomId,
    query.tab === "logs" && meta.status === "ready"
  )
  const stats = useChannelStats(
    channel,
    enabled,
    query.tab === "stats" && meta.status === "ready"
  )

  function openChannel(next: string) {
    const target = parseTarget(next)
    if (!target) {
      return
    }
    replaceQuery({
      channel: target.value,
      tab: query.tab,
      date: "",
      user: "",
      q: "",
    })
  }

  function toggleBookmark() {
    if (!channel) {
      return
    }
    if (has(channel)) {
      removeBookmark(channel)
      return
    }
    addBookmark(channel)
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          channel={channel}
          bookmarks={bookmarks}
          onOpenChannel={openChannel}
          onRemoveBookmark={removeBookmark}
          onOpenProviders={() => setProvidersOpen(true)}
        />
        <SidebarInset className="h-svh overflow-hidden">
          <div className="flex h-full min-h-0 flex-1 flex-col gap-4 p-6">
            <ChannelHeader
              tab={query.tab}
              channel={channel}
              bookmarked={has(channel)}
              canBookmark={Boolean(channel)}
              onTabChange={(tab: AppTab) => setQuery({ tab })}
              onToggleBookmark={toggleBookmark}
              onOpenChannel={openChannel}
            />

            {!channel ? (
              <EmptyCard text="Open a channel from the sidebar to start reading logs." />
            ) : null}

            {channel && meta.status === "loading" ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card p-6">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="mt-4 h-full w-full flex-1" />
              </div>
            ) : null}

            {channel && meta.status === "error" ? (
              <EmptyCard text={meta.message} />
            ) : null}

            {meta.status === "ready" && query.tab === "logs" ? (
              <UserCardProvider>
                <LogsPanel
                  channelLogin={channel}
                  date={effectiveDate}
                  dates={dates}
                  userFilter={query.user}
                  textFilter={query.q}
                  logs={logs}
                  catalog={catalog}
                  onUserFilter={(user) => setQuery({ user })}
                  onTextFilter={(q) => setQuery({ q })}
                  onDateChange={(date) => setQuery({ date, tab: "logs" })}
                />
              </UserCardProvider>
            ) : null}

            {meta.status === "ready" && query.tab === "user" ? (
              <UserPanel login={channel} profile={meta.profile} />
            ) : null}

            {meta.status === "ready" && query.tab === "stats" ? (
              <StatsPanel
                stats={stats.status === "ready" ? stats.stats : null}
                loading={stats.status === "loading"}
                dates={meta.dates}
                providers={enabled}
                statuses={stats.status === "ready" ? stats.statuses : []}
                onChatterClick={(login) =>
                  setQuery({ tab: "logs", user: login })
                }
              />
            ) : null}
          </div>
        </SidebarInset>

        <Sheet open={providersOpen} onOpenChange={setProvidersOpen}>
          <SheetContent className="flex flex-col sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Providers</SheetTitle>
              <SheetDescription>
                Built-in rustlog endpoints can be turned off. Anything you add
                is stored in this browser.
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
              <ProviderSettings
                providers={providers}
                onEnabledChange={setEnabled}
                onAdd={add}
                onRemove={remove}
              />
            </div>
          </SheetContent>
        </Sheet>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-start rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

export default App
