import { useState } from "react"
import { MoonIcon, Settings2Icon, SunIcon, XIcon } from "lucide-react"

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

export function AppSidebar({
  channel,
  bookmarks,
  onOpenChannel,
  onRemoveBookmark,
  onOpenProviders,
}: {
  channel: string
  bookmarks: Bookmark[]
  onOpenChannel: (channel: string) => void
  onRemoveBookmark: (channel: string) => void
  onOpenProviders: () => void
}) {
  const [draft, setDraft] = useState("")
  const [switching, setSwitching] = useState(false)
  const current = parseTarget(channel)?.value ?? ""
  const { resolvedTheme, setTheme } = useTheme()
  const profile = useChannelIdentity(current)
  const bookmarkUsers = useChannelIdentities(
    bookmarks.map((item) => item.channel)
  )
  const isDark = resolvedTheme === "dark"
  const showInput = !current || switching
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
              autoComplete="off"
              autoFocus
              onBlur={() => {
                if (!draft.trim()) {
                  setSwitching(false)
                }
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
            >
              {bookmarks.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  Bookmark a channel to quickly access it in the future.
                </p>
              ) : (
                <SidebarMenu>
                  {bookmarks.map((bookmark) => {
                    const user = bookmarkUsers[bookmark.channel]
                    const name = user?.displayName || bookmark.channel
                    return (
                      <SidebarMenuItem key={bookmark.channel}>
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
          onClick={onOpenProviders}
          aria-label="Providers"
        >
          <Settings2Icon />
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
      className="flex w-full items-center gap-2.5 rounded-xl border border-dashed px-2.5 py-2 text-left hover:bg-sidebar-accent"
      onClick={onClick}
      aria-label={label}
    >
      {displayName ? (
        <ChannelAvatar name={displayName} src={logo} />
      ) : (
        <span className="size-8 shrink-0 rounded-full border border-dashed border-sidebar-border" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {displayName || "Open a channel"}
      </span>
    </button>
  )
}
