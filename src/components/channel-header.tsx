import { useState } from "react"
import { BookmarkIcon, SquareArrowOutUpRightIcon } from "lucide-react"

import { ChannelAvatar } from "@/components/channel-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SidebarTrigger, SIDEBAR_TRANSITION, useSidebar } from "@/components/ui/sidebar"
import { useChannelIdentity } from "@/hooks/use-channel-identity"
import { cn } from "@/lib/utils"
import { twitchChannelUrl } from "@/lib/chat/types"
import { parseTarget } from "@/lib/twitch"
import type { AppTab } from "@/lib/query"

const headerChip =
  "rounded-full bg-muted text-muted-foreground hover:text-foreground"

export function ChannelHeader({
  tab,
  channel,
  bookmarked,
  canBookmark,
  onTabChange,
  onToggleBookmark,
  onOpenChannel,
}: {
  tab: AppTab
  channel: string
  bookmarked: boolean
  canBookmark: boolean
  onTabChange: (tab: AppTab) => void
  onToggleBookmark: () => void
  onOpenChannel: (channel: string) => void
}) {
  const { state, isMobile } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile

  return (
    <header className="flex shrink-0 items-center gap-2">
      <SidebarTrigger
        size="icon"
        className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
      />

      <div
        className={cn(
          "grid overflow-hidden",
          `transition-[grid-template-columns,opacity,margin] ${SIDEBAR_TRANSITION}`,
          collapsed
            ? "grid-cols-[1fr] opacity-100"
            : "pointer-events-none grid-cols-[0fr] opacity-0"
        )}
        aria-hidden={!collapsed}
      >
        <div className="min-w-0 overflow-hidden">
          <HeaderChannelSwitcher
            channel={channel}
            onOpenChannel={onOpenChannel}
            disabled={!collapsed}
          />
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as AppTab)}
        className="min-w-0"
      >
        <TabsList
          className={cn(
            "rounded-full px-1",
            `transition-[height] ${SIDEBAR_TRANSITION}`,
            collapsed ? "h-9!" : "h-8"
          )}
        >
          <TabsTrigger
            className={cn(
              "rounded-full px-3.5",
              `transition-[background-color] ${SIDEBAR_TRANSITION}`,
              collapsed && "data-active:bg-background/80"
            )}
            value="logs"
          >
            Logs
          </TabsTrigger>
          <TabsTrigger
            className={cn(
              "rounded-full px-3.5",
              `transition-[background-color] ${SIDEBAR_TRANSITION}`,
              collapsed && "data-active:bg-background/80"
            )}
            value="user"
          >
            User
          </TabsTrigger>
          <TabsTrigger
            className={cn(
              "rounded-full px-3.5",
              `transition-[background-color] ${SIDEBAR_TRANSITION}`,
              collapsed && "data-active:bg-background/80"
            )}
            value="stats"
          >
            Stats
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={headerChip}
          disabled={!channel}
          aria-label="Open channel on Twitch"
          onClick={() => {
            if (!channel) {
              return
            }
            window.open(
              twitchChannelUrl(channel),
              "_blank",
              "noopener,noreferrer"
            )
          }}
        >
          <SquareArrowOutUpRightIcon />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(headerChip, bookmarked && "text-foreground")}
          disabled={!canBookmark}
          onClick={onToggleBookmark}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark channel"}
        >
          <BookmarkIcon className={bookmarked ? "fill-current" : undefined} />
        </Button>
      </div>
    </header>
  )
}

function HeaderChannelSwitcher({
  channel,
  onOpenChannel,
  disabled,
}: {
  channel: string
  onOpenChannel: (channel: string) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState("")
  const [switching, setSwitching] = useState(false)
  const profile = useChannelIdentity(channel)
  const displayName = profile?.displayName || channel
  const showInput = switching

  function handleOpen(event: React.FormEvent) {
    event.preventDefault()
    const target = parseTarget(draft)
    if (!target) {
      return
    }
    onOpenChannel(target.value)
    setDraft("")
    setSwitching(false)
  }

  if (showInput) {
    return (
      <form
        onSubmit={handleOpen}
        className={cn("min-w-0 max-w-56", disabled && "pointer-events-none")}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={channel ? "Switch channel" : "Open a channel"}
          autoComplete="off"
          autoFocus={!disabled}
          className="h-9 rounded-full bg-muted"
          onBlur={() => {
            setDraft("")
            setSwitching(false)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft("")
              setSwitching(false)
            }
          }}
        />
      </form>
    )
  }

  if (!displayName) {
    return (
      <button
        type="button"
        disabled={disabled}
        className="flex h-9 min-w-0 max-w-56 items-center gap-2 rounded-full border border-dashed px-2.5 text-left hover:text-foreground disabled:pointer-events-none"
        onClick={() => setSwitching(true)}
        aria-label="Open a channel"
      >
        <span className="size-6 shrink-0 rounded-full border border-dashed border-border" />
        <span className="truncate text-sm font-medium text-muted-foreground">
          No channel selected
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className="flex h-9 min-w-0 max-w-56 items-center gap-2 rounded-full bg-muted px-2.5 text-left hover:text-foreground disabled:pointer-events-none"
      onClick={() => setSwitching(true)}
      aria-label="Switch channel"
    >
      <ChannelAvatar
        name={displayName}
        src={profile?.logo}
        size="sm"
        className="size-6"
      />
      <span className="truncate text-sm font-semibold">{displayName}</span>
    </button>
  )
}
