import { useRef, useState } from "react"
import { CogIcon, MoonIcon, SunIcon, XIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { ChannelAvatar } from "@/components/channel-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  useChannelIdentities,
  useChannelIdentity,
} from "@/hooks/use-channel-identity"
import type { Bookmark } from "@/lib/bookmarks"
import { parseTarget } from "@/lib/twitch"
import { cn } from "@/lib/utils"

type BookmarkDropTarget = {
  index: number
  top: number
  left: number
  width: number
}

export function AppSidebar({
  channel,
  bookmarks,
  onOpenChannel,
  onRemoveBookmark,
  onMoveBookmark,
  onOpenSettings,
}: {
  channel: string
  bookmarks: Bookmark[]
  onOpenChannel: (channel: string) => void
  onRemoveBookmark: (channel: string) => void
  onMoveBookmark: (channel: string, toIndex: number) => void
  onOpenSettings: () => void
}) {
  const [draft, setDraft] = useState("")
  const [switching, setSwitching] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<BookmarkDropTarget | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const current = parseTarget(channel)?.value ?? ""
  const { resolvedTheme, setTheme } = useTheme()
  const profile = useChannelIdentity(current)
  const bookmarkUsers = useChannelIdentities(
    bookmarks.map((item) => item.channel)
  )
  const isDark = resolvedTheme === "dark"
  const showInput = switching
  const displayName = profile?.displayName || current

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

  function startSwitching() {
    setSwitching(true)
  }

  function computeDropTarget(
    event: React.DragEvent
  ): BookmarkDropTarget | null {
    const list = listRef.current
    if (!list || !dragging) {
      return null
    }
    const from = bookmarks.findIndex((item) => item.channel === dragging)
    if (from === -1) {
      return null
    }
    const targets = Array.from(
      list.querySelectorAll<HTMLLIElement>("li[data-bookmark]")
    )
    if (targets.length === 0) {
      return null
    }
    let position = targets.length
    for (const [index, target] of targets.entries()) {
      const rect = target.getBoundingClientRect()
      if (event.clientY < rect.top + rect.height / 2) {
        position = index
        break
      }
    }
    if (position === from || position === from + 1) {
      return null
    }
    const anchor =
      targets[position < targets.length ? position : targets.length - 1]
    const rect = anchor.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()
    return {
      index: position,
      top: (position < targets.length ? rect.top : rect.bottom) - listRect.top,
      left: rect.left - listRect.left,
      width: rect.width,
    }
  }

  function handleListDragOver(event: React.DragEvent) {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move"
    }
    setDropTarget(computeDropTarget(event))
  }

  function handleListDrop(event: React.DragEvent) {
    event.preventDefault()
    const channel = event.dataTransfer?.getData("text/plain") || dragging
    if (channel && dropTarget) {
      onMoveBookmark(channel, dropTarget.index)
    }
    setDropTarget(null)
  }

  function handleListDragLeave(event: React.DragEvent) {
    if (!listRef.current?.contains(event.relatedTarget as Node | null)) {
      setDropTarget(null)
    }
  }

  function handleBookmarkDragStart(event: React.DragEvent, value: string) {
    setDragging(value)
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move"
      event.dataTransfer.setData("text/plain", value)
    }
  }

  function handleBookmarkDragEnd() {
    setDragging(null)
    setDropTarget(null)
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="p-4">
        {showInput ? (
          <form onSubmit={handleOpen}>
            <Input
              id="channel-switcher"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={current ? "Switch channel" : "Open a channel"}
              className="rounded-xl bg-muted focus-visible:ring-0 dark:bg-muted/50"
              autoComplete="off"
              autoFocus
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
        ) : (
          <ChannelSwitcherButton
            displayName={displayName}
            logo={profile?.logo}
            onClick={startSwitching}
          />
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="flex min-h-0 flex-1 flex-col px-4">
          <SidebarGroupLabel>Bookmarks</SidebarGroupLabel>
          <SidebarGroupContent className="flex min-h-0 flex-1 flex-col">
            <div
              className={cn(
                "min-h-0 flex-1 rounded-xl border border-dashed",
                bookmarks.length === 0
                  ? "flex items-center justify-center px-4 py-6"
                  : "overflow-auto p-1.5"
              )}
              onDragOver={handleListDragOver}
              onDrop={handleListDrop}
              onDragLeave={handleListDragLeave}
            >
              {bookmarks.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  Bookmark a channel to quickly access it in the future.
                </p>
              ) : (
                <SidebarMenu ref={listRef} className="relative">
                  {bookmarks.map((bookmark) => {
                    const user = bookmarkUsers[bookmark.channel]
                    const name = user?.displayName || bookmark.channel
                    return (
                      <SidebarMenuItem
                        key={bookmark.channel}
                        data-bookmark
                        draggable
                        onDragStart={(event) =>
                          handleBookmarkDragStart(event, bookmark.channel)
                        }
                        onDragEnd={handleBookmarkDragEnd}
                        className={
                          dragging === bookmark.channel
                            ? "opacity-50"
                            : undefined
                        }
                      >
                        <SidebarMenuButton
                          isActive={current === bookmark.channel}
                          onClick={() => onOpenChannel(bookmark.channel)}
                          tooltip={name}
                        >
                          <ChannelAvatar
                            name={name}
                            src={user?.logo}
                            size="sm"
                            className="size-5"
                          />
                          <span>{name}</span>
                        </SidebarMenuButton>
                        <SidebarMenuAction
                          showOnHover
                          onClick={() => onRemoveBookmark(bookmark.channel)}
                          aria-label={`Remove ${bookmark.channel}`}
                        >
                          <XIcon />
                        </SidebarMenuAction>
                      </SidebarMenuItem>
                    )
                  })}
                  {dropTarget ? (
                    <li
                      aria-hidden
                      className="pointer-events-none absolute z-10 h-0.5 -translate-y-1/2 rounded-full bg-primary"
                      style={{
                        top: dropTarget.top,
                        left: dropTarget.left,
                        width: dropTarget.width,
                      }}
                    />
                  ) : null}
                </SidebarMenu>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="flex-row items-center justify-between p-4">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="rounded-full bg-muted text-muted-foreground hover:text-foreground"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="rounded-full bg-muted text-muted-foreground hover:text-foreground"
          onClick={() => onOpenSettings()}
          aria-label="Settings"
          title="Settings"
        >
          <CogIcon />
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}

function ChannelSwitcherButton({
  displayName,
  logo,
  onClick,
}: {
  displayName: string
  logo?: string | null
  onClick: () => void
}) {
  const label = displayName ? "Switch channel" : "Open a channel"

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2.5 rounded-xl border border-dashed px-2 py-2 text-left hover:bg-sidebar-accent"
      onClick={onClick}
      aria-label={label}
    >
      {displayName ? (
        <>
          <ChannelAvatar name={displayName} src={logo} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {displayName}
          </span>
        </>
      ) : (
        <>
          <span className="size-8 shrink-0 rounded-full border border-dashed border-sidebar-border" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              No channel selected.
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              Click here to set a channel.
            </span>
          </span>
        </>
      )}
    </button>
  )
}
