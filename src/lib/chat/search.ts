import { matchChatMentions } from "@/lib/chat/mentions"
import { findMessageUrls } from "@/lib/chat/urls"
import { parseLogChat, unescapeIrcTag } from "@/lib/chat/tags"
import type { ParsedLogChat } from "@/lib/chat/types"
import type { ThirdPartyEmoteCatalog } from "@/lib/chat/emotes"
import type { MergedMessage } from "@/lib/rustlog"

export const SEARCH_FILTER_KEYS = ["from", "role", "has"] as const

export type SearchFilterKey = (typeof SEARCH_FILTER_KEYS)[number]

export type SearchFilter = {
  key: SearchFilterKey
  value: string
  start: number
  end: number
}

export type ParsedSearchQuery = {
  filters: SearchFilter[]
  keywords: string[]
  raw: string
}

export type SearchToken = {
  start: number
  end: number
  text: string
}

export type SearchSuggestion = {
  id: string
  insert: string
  label: string
  description: string
}

export type SearchUsername = {
  userName: string
  displayName: string
}

const FILTER_KEYS = new Set<string>(SEARCH_FILTER_KEYS)

const FILTER_TYPE_SUGGESTIONS: SearchSuggestion[] = [
  {
    id: "filter:from",
    insert: "from:",
    label: "from:",
    description: "Messages from a sender",
  },
  {
    id: "filter:role",
    insert: "role:",
    label: "role:",
    description: "Filter by role",
  },
  {
    id: "filter:has",
    insert: "has:",
    label: "has:",
    description: "Messages containing something",
  },
]

export const ROLE_SUGGESTIONS: SearchSuggestion[] = [
  {
    id: "role:mod",
    insert: "role:mod",
    label: "role:mod",
    description: "Moderators",
  },
  {
    id: "role:vip",
    insert: "role:vip",
    label: "role:vip",
    description: "VIPs",
  },
  {
    id: "role:subscriber",
    insert: "role:subscriber",
    label: "role:subscriber",
    description: "Subscribers",
  },
  {
    id: "role:broadcaster",
    insert: "role:broadcaster",
    label: "role:broadcaster",
    description: "Broadcaster",
  },
]

export const HAS_SUGGESTIONS: SearchSuggestion[] = [
  {
    id: "has:link",
    insert: "has:link",
    label: "has:link",
    description: "Contains a link",
  },
  {
    id: "has:emote",
    insert: "has:emote",
    label: "has:emote",
    description: "Contains an emote",
  },
  {
    id: "has:gif",
    insert: "has:gif",
    label: "has:gif",
    description: "Contains a GIF",
  },
  {
    id: "has:mention",
    insert: "has:mention",
    label: "has:mention",
    description: "Contains an @mention",
  },
]

function isFilterKey(value: string): value is SearchFilterKey {
  return FILTER_KEYS.has(value)
}

function isWhitespace(char: string) {
  return char === " " || char === "\t" || char === "\n"
}

function stripFilterValueDecorators(value: string) {
  return value.replace(/^@/, "").replace(/^"/, "").replace(/"$/, "")
}

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const filters: SearchFilter[] = []
  const keywords: string[] = []
  const length = raw.length
  let index = 0

  const skipSpaces = () => {
    while (index < length && isWhitespace(raw[index]!)) {
      index += 1
    }
  }

  const readQuoted = () => {
    index += 1
    const start = index
    while (index < length && raw[index] !== '"') {
      index += 1
    }
    const value = raw.slice(start, index)
    if (index < length && raw[index] === '"') {
      index += 1
    }
    return value
  }

  const readUnquoted = () => {
    const start = index
    while (index < length && !isWhitespace(raw[index]!)) {
      index += 1
    }
    return raw.slice(start, index)
  }

  while (index < length) {
    skipSpaces()
    if (index >= length) {
      break
    }

    const tokenStart = index

    if (raw[index] === '"') {
      const phrase = readQuoted().trim()
      if (phrase) {
        keywords.push(phrase)
      }
      continue
    }

    let tokenEnd = index
    while (tokenEnd < length && !isWhitespace(raw[tokenEnd]!)) {
      tokenEnd += 1
    }

    const colon = raw.indexOf(":", index)
    if (colon > index && colon < tokenEnd) {
      const key = raw.slice(index, colon).toLowerCase()
      if (isFilterKey(key)) {
        index = colon + 1
        const value = raw[index] === '"' ? readQuoted() : readUnquoted()
        const trimmed = value.trim()
        if (trimmed) {
          filters.push({
            key,
            value: trimmed,
            start: tokenStart,
            end: index,
          })
        }
        continue
      }
    }

    const token = readUnquoted()
    if (token) {
      keywords.push(token)
    }
  }

  return { filters, keywords, raw }
}

export function isSearchQueryActive(parsed: ParsedSearchQuery) {
  return parsed.filters.length > 0 || parsed.keywords.length > 0
}

export function getSearchTokenAtCursor(
  query: string,
  cursor: number
): SearchToken {
  const clamped = Math.max(0, Math.min(cursor, query.length))
  let quoted = false
  for (let index = 0; index < clamped; index += 1) {
    if (query[index] === '"') {
      quoted = !quoted
    }
  }

  let start = clamped
  if (quoted) {
    while (start > 0 && query[start - 1] !== '"') {
      start -= 1
    }
    if (start > 0 && query[start - 1] === '"') {
      start -= 1
    }
    while (start > 0 && !isWhitespace(query[start - 1]!)) {
      start -= 1
    }
  } else {
    while (start > 0 && !isWhitespace(query[start - 1]!)) {
      start -= 1
    }
  }

  let end = start
  quoted = false
  while (end < query.length) {
    const char = query[end]!
    if (char === '"') {
      quoted = !quoted
      end += 1
      continue
    }
    if (!quoted && isWhitespace(char)) {
      break
    }
    end += 1
  }

  return {
    start,
    end,
    text: query.slice(start, end),
  }
}

export function replaceSearchToken(
  query: string,
  token: SearchToken,
  insert: string
): { query: string; cursor: number } {
  const addSpace = !insert.endsWith(":")
  const trailing = query.slice(token.end).replace(/^\s*/, "")
  const spacer = addSpace ? " " : ""
  const next = `${query.slice(0, token.start)}${insert}${spacer}${trailing}`
  return {
    query: next,
    cursor: token.start + insert.length + spacer.length,
  }
}

export function removeSearchFilterRange(
  raw: string,
  start: number,
  end: number
) {
  return `${raw.slice(0, start)}${raw.slice(end)}`
    .replace(/\s{2,}/g, " ")
    .trim()
}

function normalizeUserFilter(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase()
}

function extractGifUrls(text: string) {
  const pattern = /https?:\/\/[^\s]+?\.(?:gif|gifv)(?:\?\S*)?/gi
  return text.match(pattern) ?? []
}

type RoleKind = "mod" | "vip" | "sub" | "broadcaster"

function roleFilterKind(value: string): RoleKind | null {
  switch (value.trim().toLowerCase()) {
    case "mod":
    case "moderator":
      return "mod"
    case "vip":
      return "vip"
    case "sub":
    case "subscriber":
      return "sub"
    case "broadcaster":
    case "streamer":
    case "streamers":
      return "broadcaster"
    default:
      return null
  }
}

type HasKind = "link" | "emote" | "gif" | "mention"

function hasFilterKind(value: string): HasKind | null {
  switch (value.trim().toLowerCase()) {
    case "link":
    case "links":
    case "url":
      return "link"
    case "emote":
    case "emotes":
      return "emote"
    case "gif":
    case "gifs":
      return "gif"
    case "mention":
    case "mentions":
      return "mention"
    default:
      return null
  }
}

function hasThirdPartyEmoteCode(
  text: string,
  emotes: ThirdPartyEmoteCatalog | null
) {
  if (!emotes || emotes.size === 0 || !text) {
    return false
  }
  for (const match of text.matchAll(/\S+/g)) {
    if (emotes.has(match[0])) {
      return true
    }
  }
  return false
}

function messageHasKind(
  parsed: ParsedLogChat,
  message: MergedMessage,
  kind: HasKind,
  emotes: ThirdPartyEmoteCatalog | null
) {
  switch (kind) {
    case "link":
      return (
        findMessageUrls(parsed.text).length > 0 ||
        findMessageUrls(parsed.systemText).length > 0
      )
    case "emote":
      return (
        parsed.emotes.length > 0 || hasThirdPartyEmoteCode(parsed.text, emotes)
      )
    case "gif":
      return (
        Boolean(unescapeIrcTag(message.tags.gifs ?? "")) ||
        extractGifUrls(parsed.text).length > 0
      )
    case "mention": {
      for (const _match of matchChatMentions(parsed.text)) {
        return true
      }
      return false
    }
  }
}

export function searchLogMessages(
  messages: MergedMessage[],
  query: string,
  senderFilter = "",
  emotes: ThirdPartyEmoteCatalog | null = null
): MergedMessage[] {
  const parsed = parseSearchQuery(query)
  const sender = senderFilter.trim()
  if (!isSearchQueryActive(parsed) && !sender) {
    return messages
  }

  const fromNeedles = new Set<string>()
  if (sender) {
    const needle = normalizeUserFilter(sender)
    if (needle) {
      fromNeedles.add(needle)
    }
  }
  for (const filter of parsed.filters) {
    if (filter.key !== "from") {
      continue
    }
    const needle = normalizeUserFilter(filter.value)
    if (needle) {
      fromNeedles.add(needle)
    }
  }

  const roleKinds: RoleKind[] = []
  const hasKinds: HasKind[] = []
  for (const filter of parsed.filters) {
    if (filter.key === "role") {
      const kind = roleFilterKind(filter.value)
      if (kind) {
        roleKinds.push(kind)
      }
    } else if (filter.key === "has") {
      const kind = hasFilterKind(filter.value)
      if (kind) {
        hasKinds.push(kind)
      }
    }
  }

  const fromActive = Boolean(sender) || fromNeedles.size > 0
  const roleActive = parsed.filters.some((filter) => filter.key === "role")
  const hasActive = parsed.filters.some((filter) => filter.key === "has")

  // An active filter group with nothing valid to match against can never
  // pass, so short-circuit instead of scanning every message.
  if (
    (fromActive && fromNeedles.size === 0) ||
    (roleActive && roleKinds.length === 0) ||
    (hasActive && hasKinds.length === 0)
  ) {
    return []
  }

  const lowerKeywords = parsed.keywords.map((keyword) => keyword.toLowerCase())

  return messages.filter((message) => {
    if (fromActive) {
      const username = message.username.toLowerCase()
      const displayName = message.displayName.toLowerCase()
      let matched = false
      for (const needle of fromNeedles) {
        if (username === needle || displayName === needle) {
          matched = true
          break
        }
      }
      if (!matched) {
        return false
      }
    }

    if (roleActive) {
      const flags = parseLogChat(message).flags
      let matched = false
      for (const kind of roleKinds) {
        if (
          (kind === "mod" && flags.isModerator) ||
          (kind === "vip" && flags.isVip) ||
          (kind === "sub" && flags.isSubscriber) ||
          (kind === "broadcaster" && flags.isBroadcaster)
        ) {
          matched = true
          break
        }
      }
      if (!matched) {
        return false
      }
    }

    if (hasActive) {
      const parsedMessage = parseLogChat(message)
      for (const kind of hasKinds) {
        if (!messageHasKind(parsedMessage, message, kind, emotes)) {
          return false
        }
      }
    }

    if (lowerKeywords.length > 0) {
      const haystack = [
        message.text,
        message.systemText,
        message.username,
        message.displayName,
      ]
        .join(" ")
        .toLowerCase()
      for (const keyword of lowerKeywords) {
        if (!haystack.includes(keyword)) {
          return false
        }
      }
    }

    return true
  })
}

export function collectSearchUsernames(
  messages: MergedMessage[]
): SearchUsername[] {
  const seen = new Set<string>()
  const users: SearchUsername[] = []

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message.username) {
      continue
    }

    const key = message.username.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    users.push({
      userName: message.username,
      displayName: message.displayName || message.username,
    })
  }

  return users
}

function filterSuggestions(suggestions: SearchSuggestion[], query: string) {
  if (!query) {
    return suggestions
  }

  const needle = query.toLowerCase()
  return suggestions.filter(
    (suggestion) =>
      suggestion.insert.toLowerCase().startsWith(needle) ||
      suggestion.label.toLowerCase().startsWith(needle)
  )
}

export function getSearchSuggestions({
  token,
  usernames,
}: {
  token: SearchToken
  usernames: SearchUsername[]
}): SearchSuggestion[] {
  const tokenText = token.text
  const colon = tokenText.indexOf(":")

  if (colon >= 0) {
    const key = tokenText.slice(0, colon).toLowerCase()
    const value = stripFilterValueDecorators(tokenText.slice(colon + 1))
    const needle = value.toLowerCase()

    if (key === "from") {
      return usernames
        .filter((user) => {
          if (!needle) {
            return true
          }
          return (
            user.userName.toLowerCase().startsWith(needle) ||
            user.displayName.toLowerCase().startsWith(needle)
          )
        })
        .slice(0, 8)
        .map((user) => ({
          id: `from:${user.userName.toLowerCase()}`,
          insert: `from:${user.userName}`,
          label: `from:${user.userName}`,
          description: user.displayName,
        }))
    }

    if (key === "role") {
      return filterSuggestions(ROLE_SUGGESTIONS, tokenText).slice(0, 8)
    }

    if (key === "has") {
      return filterSuggestions(HAS_SUGGESTIONS, tokenText).slice(0, 8)
    }

    return []
  }

  return filterSuggestions(FILTER_TYPE_SUGGESTIONS, tokenText)
}
