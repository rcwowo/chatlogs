import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  CalendarDaysIcon,
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FilterIcon,
  SparklesIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ChannelAvatar } from "@/components/channel-avatar"
import { ChatMessageBody } from "@/components/chat/message-body"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useUserCard } from "@/hooks/use-user-card"
import { useSettingsSelector } from "@/hooks/use-settings"
import {
  hydrateMessageEmotes,
  type ThirdPartyEmoteCatalog,
} from "@/lib/chat/emotes"
import { parseLogChat, formatLogTimestamp } from "@/lib/chat/tags"
import { twitchChannelUrl } from "@/lib/chat/types"
import type { MergedMessage } from "@/lib/rustlog"
import {
  fetchTwitchSubage,
  fetchTwitchUser,
  type TwitchSubage,
  type TwitchUser,
} from "@/lib/twitch-user"
import { cn } from "@/lib/utils"

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
})

const USER_CARD_WIDTH_PX = 352
const USER_CARD_VIEWPORT_MARGIN_PX = 8

function formatDate(value: string | null) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return dateFormatter.format(date)
}

function computeAnchorPosition(rect: DOMRect | null) {
  const margin = USER_CARD_VIEWPORT_MARGIN_PX
  if (!rect) {
    return {
      left: Math.max(margin, (window.innerWidth - USER_CARD_WIDTH_PX) / 2),
      top: margin,
    }
  }
  return {
    left: Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - USER_CARD_WIDTH_PX - margin)
    ),
    top: Math.max(
      margin,
      Math.min(rect.bottom + margin, window.innerHeight - margin - 24)
    ),
  }
}

function isUserCardOverlayTarget(target: Node): boolean {
  if (!(target instanceof Element)) {
    return false
  }
  return Boolean(
    target.closest(
      '[data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-trigger"]'
    )
  )
}

async function copyText(label: string, value: string | undefined | null) {
  const text = value?.trim()
  if (!text) {
    toast.error(`${label} is not available.`)
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`Copied ${label.toLowerCase()}.`)
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}.`)
  }
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon?: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-2 text-xs">
      <div className="mb-1 flex items-center gap-1 text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

type ActionToolbarItem = {
  key: string
  label: string
  icon?: ReactNode
  onClick: () => void
}

function ActionToolbar({ items }: { items: ActionToolbarItem[] }) {
  if (items.length === 0) {
    return null
  }
  return (
    <div
      className="grid overflow-hidden rounded-md border border-border/60 bg-background/40"
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          className={cn(
            "inline-flex h-6 min-w-0 cursor-pointer items-center justify-center gap-0.5 px-1 text-[10px] leading-none font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
            index % items.length !== 0 && "border-l border-border/60"
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function LogUserCard({
  channelLogin,
  messages,
  emotes,
  onFilterUser,
}: {
  channelLogin: string
  messages: MergedMessage[]
  emotes: ThirdPartyEmoteCatalog
  onFilterUser: (username: string) => void
}) {
  const { target, anchor } = useUserCard()
  if (!target) {
    return null
  }
  const targetKey = `${target.userId ?? ""}:${target.userName.toLowerCase()}`
  return (
    <UserCardDialog
      key={targetKey}
      target={target}
      anchor={anchor}
      channelLogin={channelLogin}
      messages={messages}
      emotes={emotes}
      onFilterUser={onFilterUser}
    />
  )
}

function UserCardDialog({
  target,
  anchor,
  channelLogin,
  messages,
  emotes,
  onFilterUser,
}: {
  target: NonNullable<ReturnType<typeof useUserCard>["target"]>
  anchor: ReturnType<typeof useUserCard>["anchor"]
  channelLogin: string
  messages: MergedMessage[]
  emotes: ThirdPartyEmoteCatalog
  onFilterUser: (username: string) => void
}) {
  const { close } = useUserCard()
  const panelRef = useRef<HTMLDivElement>(null)
  const actionsMenuOpenRef = useRef(false)
  const timestampFormat = useSettingsSelector(
    (settings) => settings.appearance.messageTimestampFormat
  )
  const anchorPosition = useMemo(
    () => computeAnchorPosition(anchor ?? null),
    [anchor]
  )
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [profile, setProfile] = useState<TwitchUser | null>(null)
  const [subage, setSubage] = useState<TwitchSubage | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  )

  const lookup = target.userId || target.userName || ""

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    const userName = target.userName

    async function run() {
      await Promise.resolve()
      if (cancelled) {
        return
      }
      setStatus("loading")
      setProfile(null)
      setSubage(null)
      try {
        const user = await fetchTwitchUser(lookup, controller.signal)
        if (cancelled) {
          return
        }
        const nextSubage = await fetchTwitchSubage(
          user?.login || userName,
          channelLogin,
          controller.signal
        ).catch(() => null)
        if (cancelled) {
          return
        }
        setProfile(user)
        setSubage(nextSubage)
        setStatus(user ? "ready" : "error")
      } catch {
        if (!cancelled) {
          setStatus("error")
        }
      }
    }

    void run()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [channelLogin, lookup, target])

  function handleDragStart(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startOffset = dragOffset

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setDragOffset({
        x: startOffset.x + moveEvent.clientX - startX,
        y: startOffset.y + moveEvent.clientY - startY,
      })
    }

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp, { once: true })
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (actionsMenuOpenRef.current) {
          return
        }
        close()
      }
    }

    function onPointerDown(event: PointerEvent) {
      const panel = panelRef.current
      if (!panel) {
        return
      }
      if (isUserCardOverlayTarget(event.target as Node)) {
        return
      }
      if (panel.contains(event.target as Node)) {
        return
      }
      if (
        event.target instanceof Element &&
        event.target.closest('[aria-haspopup="dialog"]')
      ) {
        return
      }
      close()
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("pointerdown", onPointerDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("pointerdown", onPointerDown)
    }
  }, [close, target])

  const recent = useMemo(() => {
    const login = target.userName.toLowerCase()
    const id = target.userId
    const result: MergedMessage[] = []
    for (
      let index = messages.length - 1;
      index >= 0 && result.length < 8;
      index -= 1
    ) {
      const message = messages[index]!
      if (id && message.tags["user-id"] === id) {
        result.push(message)
        continue
      }
      if (message.username.toLowerCase() === login) {
        result.push(message)
      }
    }
    return result
  }, [messages, target])

  const actionItems: ActionToolbarItem[] = useMemo(() => {
    const login = profile?.login || target.userName
    return [
      {
        key: "filter",
        label: "Filter Messages",
        icon: <FilterIcon className="size-2.5 shrink-0" />,
        onClick: () => {
          onFilterUser(login)
          close()
        },
      },
      {
        key: "channel",
        label: "View Channel",
        icon: <ExternalLinkIcon className="size-2.5 shrink-0" />,
        onClick: () => {
          window.open(twitchChannelUrl(login), "_blank", "noopener,noreferrer")
        },
      },
    ]
  }, [close, onFilterUser, profile?.login, target])

  const displayName = profile?.displayName || target.displayName
  const login = profile?.login || target.userName
  const userId = profile?.id || target.userId
  const createdAt = profile ? formatDate(profile.createdAt) : null
  const userType = profile?.roles.isPartner
    ? "Partner"
    : profile?.roles.isAffiliate
      ? "Affiliate"
      : profile?.roles.isStaff
        ? "Staff"
        : ""
  const subscriptionLabel = subage?.statusHidden
    ? "Hidden"
    : subage?.months
      ? `${subage.months} month${subage.months === 1 ? "" : "s"}`
      : "Not subscribed"
  const showCardContent = status === "loading" || status === "ready"

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      data-slot="user-card-panel"
      aria-label={`${displayName} user card`}
      className="pointer-events-auto fixed z-[80] w-[22rem] overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-md outline-hidden"
      style={{
        left: anchorPosition.left,
        top: anchorPosition.top,
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
      }}
    >
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        {showCardContent ? (
          <DropdownMenu
            modal={false}
            onOpenChange={(open) => {
              actionsMenuOpenRef.current = open
            }}
          >
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className="bg-popover/85 shadow-sm backdrop-blur-sm"
                  aria-label="User card actions"
                />
              }
            >
              <EllipsisIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Metadata</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => void copyText("Username", login)}
                >
                  Copy username
                  <CopyIcon className="ml-auto size-3.5 text-muted-foreground" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!userId}
                  onClick={() => void copyText("User ID", userId ?? undefined)}
                >
                  Copy user&apos;s ID
                  <CopyIcon className="ml-auto size-3.5 text-muted-foreground" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!profile?.logo}
                  onClick={() =>
                    void copyText("Profile picture URL", profile?.logo)
                  }
                >
                  Copy profile picture URL
                  <CopyIcon className="ml-auto size-3.5 text-muted-foreground" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!profile?.banner}
                  onClick={() => void copyText("Banner URL", profile?.banner)}
                >
                  Copy banner URL
                  <CopyIcon className="ml-auto size-3.5 text-muted-foreground" />
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className="bg-popover/85 shadow-sm backdrop-blur-sm"
          aria-label="Close user card"
          onClick={close}
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>

      {status === "error" && !profile ? (
        <div className="space-y-3 p-4">
          <div className="text-sm font-medium">Could not load user card</div>
          <p className="text-xs text-muted-foreground">
            IVR did not return a profile for {target.userName}.
          </p>
        </div>
      ) : (
        <div className="flex max-h-[min(34rem,calc(100vh-2rem))] flex-col">
          <div
            className="relative h-32 shrink-0 cursor-grab touch-none overflow-hidden bg-muted active:cursor-grabbing"
            onPointerDown={handleDragStart}
          >
            {profile?.banner ? (
              <img
                src={profile.banner}
                alt=""
                draggable={false}
                className="pointer-events-none size-full object-cover brightness-[0.55] saturate-95"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="size-full bg-linear-to-br from-primary/40 via-primary/15 to-background" />
            )}
            <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/20 to-popover" />
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-3">
              <ChannelAvatar
                name={displayName}
                src={profile?.logo}
                size="lg"
                className="size-16 border-2 border-popover/90 shadow-md"
              />
              <div className="min-w-0 flex-1 pb-1">
                <button
                  type="button"
                  className="block max-w-full cursor-pointer truncate text-left text-lg leading-tight font-semibold hover:underline"
                  onClick={() =>
                    window.open(
                      twitchChannelUrl(login),
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  {displayName}
                </button>
                {userId ? (
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    ID {userId}
                  </div>
                ) : status === "loading" ? (
                  <Skeleton className="mt-1 h-3 w-24" />
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-4 p-4">
              {profile?.bio ? (
                <InfoTile label="Bio" value={profile.bio} />
              ) : null}

              <div
                className={cn(
                  "grid gap-2",
                  userType ? "grid-cols-3" : "grid-cols-2"
                )}
              >
                {status === "loading" && !createdAt ? (
                  <Skeleton className="h-14 rounded-lg" />
                ) : createdAt ? (
                  <InfoTile
                    icon={<CalendarDaysIcon className="size-3" />}
                    label="Created"
                    value={createdAt}
                  />
                ) : null}
                <InfoTile
                  icon={<SparklesIcon className="size-3" />}
                  label="Subscription"
                  value={status === "loading" ? "…" : subscriptionLabel}
                />
                {userType ? (
                  <InfoTile
                    icon={<UsersIcon className="size-3" />}
                    label="User type"
                    value={userType}
                  />
                ) : null}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Recent messages
                </h3>
                {recent.length > 0 ? (
                  <div className="space-y-1.5">
                    {recent.map((message) => {
                      const parsed = parseLogChat(message)
                      const hydrated = hydrateMessageEmotes(
                        parsed.text,
                        parsed.emotes,
                        emotes
                      )
                      const timestamp = formatLogTimestamp(
                        message.timestamp,
                        timestampFormat
                      )
                      return (
                        <div
                          key={message.key}
                          className="rounded-lg bg-muted/50 px-2.5 py-2 text-xs leading-snug"
                        >
                          {timestamp ? (
                            <time className="mr-1.5 text-[11px] text-muted-foreground">
                              {timestamp}
                            </time>
                          ) : null}
                          <ChatMessageBody
                            text={parsed.text}
                            emotes={hydrated}
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No messages from this user in the loaded day.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 space-y-1 border-t bg-muted/35 px-3 py-2">
            <ActionToolbar items={actionItems} />
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
