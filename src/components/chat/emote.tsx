import { ChatHoverTooltipTarget } from "@/components/chat/hover-tooltip"
import {
  CHAT_BASE_EMOTE_SIZE_PX,
  twitchEmoteCdnUrl,
  type ChatEmote,
} from "@/lib/chat/types"

function getEmoteSrcSet(emote: ChatEmote) {
  if (emote.provider !== "twitch") {
    return undefined
  }
  const base = `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(emote.id)}/default/dark`
  return `${base}/1.0 1x, ${base}/2.0 2x, ${base}/3.0 3x`
}

function getEmoteSrc(emote: ChatEmote) {
  if (emote.provider !== "twitch") {
    return emote.imageUrl
  }
  return twitchEmoteCdnUrl(emote.id)
}

function twitchStaticFallbackUrl(url: string) {
  if (!url.includes("/animated/")) {
    return null
  }
  return url.replace("/animated/", "/static/")
}

const PROVIDER_LABEL: Record<ChatEmote["provider"], string> = {
  twitch: "Twitch",
  bttv: "BetterTTV",
  ffz: "FrankerFaceZ",
  "7tv": "7TV",
}

export function ChatEmote({
  emote,
  label,
}: {
  emote: ChatEmote
  label: string
}) {
  const overlayNames = emote.overlays?.map((overlay) => overlay.code) ?? []
  const tooltip = overlayNames.length
    ? `${label} + ${overlayNames.join(" + ")}`
    : `${label} · ${PROVIDER_LABEL[emote.provider]}`

  return (
    <ChatHoverTooltipTarget content={tooltip}>
      <span className="chat-emote">
        <img
          src={getEmoteSrc(emote)}
          srcSet={getEmoteSrcSet(emote)}
          alt={label}
          width={CHAT_BASE_EMOTE_SIZE_PX}
          height={CHAT_BASE_EMOTE_SIZE_PX}
          loading="eager"
          decoding="async"
          onError={(event) => {
            if (emote.provider !== "twitch") {
              return
            }
            const img = event.currentTarget
            const next = twitchStaticFallbackUrl(img.currentSrc || img.src)
            if (!next || img.src === next) {
              return
            }
            img.src = next
            img.srcset = ""
          }}
        />
        {emote.overlays?.map((overlay) => (
          <img
            key={`${overlay.provider}-${overlay.id}-${overlay.start}`}
            className="chat-emote-overlay"
            src={overlay.imageUrl}
            alt=""
            width={CHAT_BASE_EMOTE_SIZE_PX}
            height={CHAT_BASE_EMOTE_SIZE_PX}
            loading="eager"
            decoding="async"
          />
        ))}
      </span>
    </ChatHoverTooltipTarget>
  )
}
