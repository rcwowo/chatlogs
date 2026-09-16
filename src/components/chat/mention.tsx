import { useRef, type ReactNode } from "react"

import { useUserCardOptional } from "@/hooks/use-user-card"
import { EMPTY_CHAT_FLAGS, type UserCardTarget } from "@/lib/chat/types"
import { getReadableUsernameColor } from "@/lib/chat/username"

const MENTION_LOGIN_PATTERN = /^@([A-Za-z0-9_]+)$/

export function ChatMention({
  mention,
  color,
  children,
}: {
  mention: string
  color?: string | null
  children?: ReactNode
}) {
  const userCard = useUserCardOptional()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const login = MENTION_LOGIN_PATTERN.exec(mention)?.[1]?.toLowerCase()
  const readableColor = getReadableUsernameColor(color)

  if (!login || !userCard) {
    return (
      <span
        className="chat-mention font-semibold"
        style={readableColor ? { color: readableColor } : undefined}
      >
        {children ?? mention}
      </span>
    )
  }

  const target: UserCardTarget = {
    userId: null,
    userName: login,
    displayName: mention.slice(1),
    color: color ?? null,
    flags: EMPTY_CHAT_FLAGS,
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={userCard.isOpenFor(target)}
      className="chat-mention cursor-pointer rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
      style={readableColor ? { color: readableColor } : undefined}
      onClick={(event) => {
        event.stopPropagation()
        userCard.toggle(target, triggerRef.current)
      }}
    >
      {children ?? mention}
    </button>
  )
}
