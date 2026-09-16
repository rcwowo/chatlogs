import { useMemo, type ReactNode } from "react"

import { ChatEmote } from "@/components/chat/emote"
import { ChatMention } from "@/components/chat/mention"
import { tokenizeMessageBody } from "@/lib/chat/tokenize"
import type { ChatEmote as ChatEmoteType } from "@/lib/chat/types"

export function ChatMessageBody({
  text,
  emotes,
}: {
  text: string
  emotes: ChatEmoteType[]
}) {
  const tokens = useMemo(
    () => tokenizeMessageBody(text, emotes),
    [emotes, text]
  )
  const parts: ReactNode[] = []

  for (const token of tokens) {
    if (token.kind === "emote") {
      const emote = token.emote
      parts.push(
        <ChatEmote
          key={`e-${emote.provider}-${emote.id}-${emote.start}`}
          emote={emote}
          label={text.slice(emote.start, emote.end + 1) || emote.code}
        />
      )
      continue
    }

    const slice = text.slice(token.start, token.end)
    if (token.kind === "mention") {
      parts.push(
        <ChatMention key={`mention-${token.start}`} mention={slice}>
          {slice}
        </ChatMention>
      )
      continue
    }

    if (token.kind === "url") {
      parts.push(
        <a
          key={`l-${token.start}-${token.url}`}
          href={token.url}
          target="_blank"
          rel="noreferrer noopener"
          className="chat-link break-all"
        >
          {token.url}
        </a>
      )
      continue
    }

    parts.push(
      <span key={`t-${token.start}`} className="chat-message-text">
        {slice}
      </span>
    )
  }

  return <>{parts}</>
}
