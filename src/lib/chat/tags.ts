import { createCodePointIndex } from "@/lib/chat/positions"
import {
  EMPTY_CHAT_FLAGS,
  PRIVMSG,
  twitchEmoteCdnUrl,
  type ChatBadgeRef,
  type ChatEmote,
  type ChatReply,
  type ParsedLogChat,
} from "@/lib/chat/types"
import type { MergedMessage } from "@/lib/rustlog"

export function unescapeIrcTag(value: string) {
  return value
    .replace(/\\:/g, ";")
    .replace(/\\s/g, " ")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\")
}

function tag(tags: Record<string, string>, key: string) {
  const value = tags[key]
  return value ? unescapeIrcTag(value) : ""
}

function parseBadgesTag(raw: string): ChatBadgeRef[] {
  if (!raw) {
    return []
  }
  return raw
    .split(",")
    .map((entry) => {
      const [set, version] = entry.split("/")
      return { set, version: version ?? "1" }
    })
    .filter((badge): badge is ChatBadgeRef => Boolean(badge.set))
}

function parseEmotesTag(raw: string, text: string): ChatEmote[] {
  if (!raw) {
    return []
  }

  const index = createCodePointIndex(text)
  const emotes: ChatEmote[] = []
  for (const group of raw.split("/")) {
    const [id, positions] = group.split(":")
    if (!id || !positions) {
      continue
    }
    for (const pos of positions.split(",")) {
      const [start, end] = pos.split("-")
      const parsedStart = Number.parseInt(start, 10)
      const parsedEnd = Number.parseInt(end, 10)
      if (!Number.isFinite(parsedStart) || !Number.isFinite(parsedEnd)) {
        continue
      }

      const range = index.range(parsedStart, parsedEnd)
      if (!range) {
        continue
      }

      emotes.push({
        id,
        code: text.slice(range.start, range.end + 1),
        provider: "twitch",
        imageUrl: twitchEmoteCdnUrl(id),
        start: range.start,
        end: range.end,
      })
    }
  }

  return emotes.sort((a, b) => a.start - b.start)
}

function stripAction(text: string) {
  if (text.startsWith("\x01ACTION ") && text.endsWith("\x01")) {
    return { text: text.slice(8, -1), isAction: true }
  }
  return { text, isAction: false }
}

function parseReply(tags: Record<string, string>): ChatReply | null {
  const displayName = tag(tags, "reply-parent-display-name")
  const userName = tag(tags, "reply-parent-user-login")
  const body = tag(tags, "reply-parent-msg-body")
  if (!displayName && !userName && !body) {
    return null
  }
  return {
    displayName: displayName || userName,
    userName,
    body,
  }
}

const parseCache = new WeakMap<MergedMessage, ParsedLogChat>()

export function parseLogChat(message: MergedMessage): ParsedLogChat {
  const cached = parseCache.get(message)
  if (cached) {
    return cached
  }

  const parsed = parseLogChatUncached(message)
  parseCache.set(message, parsed)
  return parsed
}

function parseLogChatUncached(message: MergedMessage): ParsedLogChat {
  const tags = message.tags
  const isChat = message.type === PRIVMSG || message.type === undefined
  const action = stripAction(message.text)
  const text = action.text
  const badges = parseBadgesTag(tag(tags, "badges") || tags.badges || "")
  const systemText =
    message.systemText ||
    tag(tags, "system-msg") ||
    (!isChat ? message.text : "")

  return {
    kind: isChat ? "chat" : "system",
    text,
    systemText,
    userId: tag(tags, "user-id") || null,
    color: tag(tags, "color") || message.tags.color || null,
    badges,
    emotes: parseEmotesTag(tag(tags, "emotes") || tags.emotes || "", text),
    flags: {
      ...EMPTY_CHAT_FLAGS,
      isAction: action.isAction,
      isFirst: tag(tags, "first-msg") === "1",
      isBroadcaster: badges.some((badge) => badge.set === "broadcaster"),
      isModerator:
        tag(tags, "mod") === "1" ||
        badges.some((badge) => badge.set === "moderator"),
      isSubscriber:
        tag(tags, "subscriber") === "1" ||
        badges.some(
          (badge) => badge.set === "subscriber" || badge.set === "founder"
        ),
      isVip: Boolean(tags.vip) || badges.some((badge) => badge.set === "vip"),
    },
    reply: parseReply(tags),
  }
}

export function formatLogTimestamp(timestamp: string) {
  if (!timestamp) {
    return ""
  }
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return timestamp
  }
  return timeFormatter.format(date)
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
