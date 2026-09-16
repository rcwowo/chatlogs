import type { ComponentType } from "react"
import {
  BadgeCheck,
  Crown,
  Gem,
  Palette,
  Star,
  Swords,
  Video,
  Wrench,
} from "lucide-react"

import { ChatHoverTooltipTarget } from "@/components/chat/hover-tooltip"
import type { ResolvedChatBadge } from "@/lib/chat/badges"
import type { ChatBadgeRef } from "@/lib/chat/types"

const ROLE_BADGE_FALLBACK: Record<
  string,
  {
    label: string
    bg: string
    icon: ComponentType<{ className?: string }>
  }
> = {
  staff: { label: "Staff", bg: "#000000", icon: Wrench },
  partner: { label: "Partner", bg: "#a96dff", icon: BadgeCheck },
  premium: { label: "Prime", bg: "#0096d6", icon: Crown },
  broadcaster: { label: "Broadcaster", bg: "#E91916", icon: Video },
  moderator: { label: "Moderator", bg: "#00AD03", icon: Swords },
  vip: { label: "VIP", bg: "#A10886", icon: Gem },
  founder: { label: "Founder", bg: "#b638ef", icon: Crown },
  "artist-badge": { label: "Artist", bg: "#1e69ff", icon: Palette },
  subscriber: { label: "Subscriber", bg: "#8204B5", icon: Star },
}

function ChatBadgeImage({
  imageUrl,
  imageUrl2x,
  title,
  description,
}: {
  imageUrl: string
  imageUrl2x?: string
  title: string
  description: string
}) {
  return (
    <ChatHoverTooltipTarget content={title}>
      <img
        className="chat-badge inline-block align-middle"
        src={imageUrl}
        srcSet={imageUrl2x ? `${imageUrl} 1x, ${imageUrl2x} 2x` : undefined}
        alt={description}
        loading="eager"
        decoding="async"
      />
    </ChatHoverTooltipTarget>
  )
}

function ChatBadgeFallback({ badge }: { badge: ChatBadgeRef }) {
  const role = ROLE_BADGE_FALLBACK[badge.set]
  if (!role) {
    return null
  }

  const Icon = role.icon

  return (
    <ChatHoverTooltipTarget content={role.label}>
      <span
        className="chat-badge-fallback inline-flex items-center justify-center rounded-xs align-middle"
        style={{ backgroundColor: role.bg }}
      >
        <Icon className="chat-badge-fallback-icon text-white" />
      </span>
    </ChatHoverTooltipTarget>
  )
}

const EMPTY_UNRESOLVED: ChatBadgeRef[] = []

export function ChatBadgeList({
  badges,
  unresolved = EMPTY_UNRESOLVED,
}: {
  badges: ResolvedChatBadge[]
  unresolved?: ChatBadgeRef[]
}) {
  const fallbackBadges =
    badges.length === 0
      ? unresolved.filter((badge) => ROLE_BADGE_FALLBACK[badge.set])
      : []

  if (badges.length === 0 && fallbackBadges.length === 0) {
    return null
  }

  return (
    <span className="mr-1 inline-flex items-center gap-0.5 align-middle">
      {badges.map((badge) => (
        <ChatBadgeImage
          key={badge.id}
          imageUrl={badge.imageUrl}
          imageUrl2x={badge.imageUrl2x}
          title={badge.title}
          description={badge.description}
        />
      ))}
      {fallbackBadges.map((badge, index) => (
        <ChatBadgeFallback key={`${badge.set}-${index}`} badge={badge} />
      ))}
    </span>
  )
}
