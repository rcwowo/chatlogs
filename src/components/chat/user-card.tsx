import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  CalendarDaysIcon,
  ClockIcon,
  CopyIcon,
  FilterIcon,
  SparklesIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ChannelAvatar } from "@/components/channel-avatar"
import { ChatMessageBody } from "@/components/chat/message-body"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useUserCard } from "@/hooks/use-user-card"
import { hydrateMessageEmotes, type ThirdPartyEmoteCatalog } from "@/lib/chat/emotes"
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

function clampPosition(x: number, y: number, width: number, height: number) {
  const maxX = Math.max(8, window.innerWidth - width - 8)
  const maxY = Math.max(8, window.innerHeight - height - 8)
  return {
    x: Math.min(Math.max(8, x), maxX),
    y: Math.min(Math.max(8, y), maxY),
  }
}

async function copyText(label: string, value: string | undefined) {
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
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-2">
      <div className="mb-1 flex items-center gap-1 text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-medium">{value}</div>
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
  const { target, anchor, close } = useUserCard()
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    originX: number
    originY: number
    startX: number
    startY: number
  } | null>(null)
  const targetKey = target
    ? `${target.userId ?? ""}:${target.userName.toLowerCase()}`
    : ""
  const [drag, setDrag] = useState({
    key: "",
    x: 0,
    y: 0,
    active: false,
  })
  const [profile, setProfile] = useState<TwitchUser | null>(null)
  const [subage, setSubage] = useState<TwitchSubage | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  )

  const lookup = target?.userId || target?.userName || ""

  useEffect(() => {
    if (!target) {
      return
    }

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

  useEffect(() => {
    if (!target) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close()
      }
    }

    function onPointerDown(event: PointerEvent) {
      const panel = panelRef.current
      if (!panel) {
        return
      }
      if (event.target instanceof Node && panel.contains(event.target)) {
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
    if (!target) {
      return []
    }
    const login = target.userName.toLowerCase()
    const id = target.userId
    const result: MergedMessage[] = []
    for (let index = messages.length - 1; index >= 0 && result.length < 8; index -= 1) {
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

  if (!target) {
    return null
  }

  const basePosition = {
    x: Math.min(Math.max(8, anchor?.left ?? 24), window.innerWidth - 360),
    y: Math.min(
      Math.max(8, (anchor?.bottom ?? 24) + 8),
      window.innerHeight - 24
    ),
  }
  const dragX = drag.key === targetKey ? drag.x : 0
  const dragY = drag.key === targetKey ? drag.y : 0
  const dragging = drag.key === targetKey && drag.active
  const position = {
    x: basePosition.x + dragX,
    y: basePosition.y + dragY,
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return
    }
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, textarea")
    ) {
      return
    }
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      originX: dragX,
      originY: dragY,
      startX: event.clientX,
      startY: event.clientY,
    }
    setDrag((current) => ({ ...current, active: true }))
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const session = dragRef.current
    if (!session || event.pointerId !== session.pointerId) {
      return
    }
    const panel = panelRef.current
    const width = panel?.offsetWidth ?? 352
    const height = panel?.offsetHeight ?? 400
    const next = clampPosition(
      basePosition.x + session.originX + (event.clientX - session.startX),
      basePosition.y + session.originY + (event.clientY - session.startY),
      width,
      height
    )
    setDrag((current) => ({
      ...current,
      x: next.x - basePosition.x,
      y: next.y - basePosition.y,
    }))
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const session = dragRef.current
    if (!session || event.pointerId !== session.pointerId) {
      return
    }
    dragRef.current = null
    setDrag((current) => ({ ...current, active: false }))
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const displayName = profile?.displayName || target.displayName
  const login = profile?.login || target.userName
  const userId = profile?.id || target.userId
  const createdAt = profile ? formatDate(profile.createdAt) : null
  const followedAt = formatDate(subage?.followedAt ?? null)
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

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${displayName} user card`}
      className={cn(
        "pointer-events-auto fixed z-[80] w-[22rem] overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-md outline-hidden",
        dragging && "cursor-grabbing select-none"
      )}
      style={{ left: position.x, top: position.y }}
    >
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className="bg-popover/85 shadow-sm backdrop-blur-sm"
          aria-label="Filter logs to this user"
          onClick={() => {
            onFilterUser(login)
            close()
          }}
        >
          <FilterIcon className="size-3.5" />
        </Button>
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
            className={cn(
              "relative h-32 shrink-0 touch-none overflow-hidden bg-muted",
              dragging ? "cursor-grabbing" : "cursor-grab"
            )}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
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
                <p className="text-sm leading-snug">{profile.bio}</p>
              ) : null}

              <div className="grid grid-cols-2 gap-2 text-xs">
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
                <InfoTile
                  icon={<ClockIcon className="size-3" />}
                  label="Followage"
                  value={
                    status === "loading"
                      ? "…"
                      : followedAt
                        ? `Since ${followedAt}`
                        : "Not following"
                  }
                />
                {userType ? (
                  <InfoTile
                    icon={<UsersIcon className="size-3" />}
                    label="User type"
                    value={userType}
                  />
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => void copyText("Username", login)}
                >
                  <CopyIcon data-icon="inline-start" />
                  Copy name
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!userId}
                  onClick={() => void copyText("User ID", userId ?? undefined)}
                >
                  <CopyIcon data-icon="inline-start" />
                  Copy ID
                </Button>
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
                      const timestamp = formatLogTimestamp(message.timestamp)
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
                          <ChatMessageBody text={parsed.text} emotes={hydrated} />
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
        </div>
      )}
    </div>,
    document.body
  )
}
