import { memo, useMemo, useRef } from "react"

import { ChatBadgeList } from "@/components/chat/badge"
import { ChatMessageBody } from "@/components/chat/message-body"
import { useUserCardOptional } from "@/hooks/use-user-card"
import { resolveMessageBadges, type ChatBadgeCatalog } from "@/lib/chat/badges"
import {
  hydrateMessageEmotes,
  type ThirdPartyEmoteCatalog,
} from "@/lib/chat/emotes"
import { formatLogTimestamp, parseLogChat } from "@/lib/chat/tags"
import type { UserCardTarget } from "@/lib/chat/types"
import {
  defaultUsernameColor,
  getReadableUsernameColor,
} from "@/lib/chat/username"
import type { MergedMessage } from "@/lib/rustlog"

export const LogMessage = memo(function LogMessage({
  message,
  badges,
  emotes,
}: {
  message: MergedMessage
  badges: ChatBadgeCatalog
  emotes: ThirdPartyEmoteCatalog
}) {
  const parsed = useMemo(() => parseLogChat(message), [message])
  const hydrated = useMemo(
    () => hydrateMessageEmotes(parsed.text, parsed.emotes, emotes),
    [emotes, parsed.emotes, parsed.text]
  )
  const resolvedBadges = useMemo(
    () => resolveMessageBadges(parsed.badges, badges),
    [badges, parsed.badges]
  )
  const userCard = useUserCardOptional()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const timestamp = formatLogTimestamp(message.timestamp)
  const username = message.displayName || message.username
  const color = getReadableUsernameColor(
    parsed.color || defaultUsernameColor(message.username || username)
  )

  const target: UserCardTarget | null = message.username
    ? {
        userId: parsed.userId,
        userName: message.username,
        displayName: username,
        color: parsed.color,
        flags: parsed.flags,
      }
    : null

  const messageContent = (
    <div className="chat-message-size min-w-0">
      {timestamp ? (
        <time
          className="chat-timestamp mr-1.5 inline text-xs whitespace-nowrap tabular-nums select-none"
          dateTime={message.timestamp}
          title={message.timestamp}
        >
          {timestamp}
        </time>
      ) : null}
      {parsed.kind === "chat" ? (
        <>
          <ChatBadgeList badges={resolvedBadges} unresolved={parsed.badges} />
          {target ? (
            <button
              ref={triggerRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={userCard?.isOpenFor(target) ?? false}
              className="chat-username cursor-pointer rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
              style={color ? { color } : undefined}
              onClick={() => userCard?.toggle(target, triggerRef.current)}
            >
              {username}
            </button>
          ) : null}
          {parsed.flags.isAction ? null : (
            <span className="chat-colon text-muted-foreground">: </span>
          )}
          <span
            className={parsed.flags.isAction ? "chat-action italic" : "inline"}
            style={parsed.flags.isAction && color ? { color } : undefined}
          >
            <ChatMessageBody text={parsed.text} emotes={hydrated} />
          </span>
        </>
      ) : (
        <span className="chat-system-text">
          {parsed.systemText}
          {parsed.text && parsed.text !== parsed.systemText ? (
            <>
              {" "}
              <ChatMessageBody text={parsed.text} emotes={hydrated} />
            </>
          ) : null}
        </span>
      )}
    </div>
  )

  return (
    <div className="chat-message group relative px-3 leading-5">
      {parsed.reply ? (
        <div className="mb-0.5 text-xs text-muted-foreground">
          Replying to {parsed.reply.displayName}
          {parsed.reply.body ? `: ${parsed.reply.body}` : ""}
        </div>
      ) : null}
      {parsed.flags.isFirst ? (
        <div className="chat-first-message -mx-3 border-l-4 border-[var(--chat-first-message-border)]">
          <span className="chat-announcement-header flex items-center px-3 py-1 text-xs font-medium">
            First message
          </span>
          <div className="chat-announcement-body px-3 py-1.5">
            {messageContent}
          </div>
        </div>
      ) : (
        messageContent
      )}
    </div>
  )
})
