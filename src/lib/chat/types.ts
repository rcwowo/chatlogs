export type ChatBadgeRef = {
  set: string
  version: string
}

export type ChatEmoteProvider = "twitch" | "bttv" | "ffz" | "7tv"

export type ChatEmote = {
  id: string
  code: string
  provider: ChatEmoteProvider
  imageUrl: string
  start: number
  end: number
  overlays?: ChatEmote[]
}

export type ChatReply = {
  displayName: string
  userName: string
  body: string
}

export type ChatFlags = {
  isAction: boolean
  isFirst: boolean
  isBroadcaster: boolean
  isModerator: boolean
  isSubscriber: boolean
  isVip: boolean
}

export type ParsedLogChat = {
  kind: "chat" | "system"
  text: string
  systemText: string
  userId: string | null
  color: string | null
  badges: ChatBadgeRef[]
  emotes: ChatEmote[]
  flags: ChatFlags
  reply: ChatReply | null
}

export type UserCardTarget = {
  userId: string | null
  userName: string
  displayName: string
  color: string | null
  flags: ChatFlags
}

export const EMPTY_CHAT_FLAGS: ChatFlags = {
  isAction: false,
  isFirst: false,
  isBroadcaster: false,
  isModerator: false,
  isSubscriber: false,
  isVip: false,
}

export const PRIVMSG = 1

export const CHAT_BASE_EMOTE_SIZE_PX = 28

export function twitchEmoteCdnUrl(emoteId: string, scale = "1.0") {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(emoteId)}/default/dark/${scale}`
}

export function twitchChannelUrl(login: string) {
  return `https://www.twitch.tv/${encodeURIComponent(login)}`
}

export function getEmoteConsumedEnd(emote: ChatEmote) {
  let end = emote.end
  for (const overlay of emote.overlays ?? []) {
    end = Math.max(end, overlay.end)
  }
  return end + 1
}
