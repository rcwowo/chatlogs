import { useEffect, useState } from "react"

import {
  createEmptyBadgeCatalog,
  loadChannelBadgeCatalog,
  loadGlobalBadgeCatalog,
  mergeBadgeCatalogs,
  type ChatBadgeCatalog,
} from "@/lib/chat/badges"
import {
  createEmptyEmoteCatalog,
  loadThirdPartyEmoteCatalog,
  type ThirdPartyEmoteCatalog,
} from "@/lib/chat/emotes"

export type ChatCatalog = {
  badges: ChatBadgeCatalog
  emotes: ThirdPartyEmoteCatalog
}

const emptyCatalog: ChatCatalog = {
  badges: createEmptyBadgeCatalog(),
  emotes: createEmptyEmoteCatalog(),
}

export function useChatCatalog(
  roomId: string,
  enabled = true,
  refreshToken = ""
) {
  const id = roomId.trim()
  const [catalog, setCatalog] = useState<{ key: string; value: ChatCatalog }>({
    key: "",
    value: emptyCatalog,
  })

  useEffect(() => {
    if (!enabled) {
      return
    }
    const controller = new AbortController()
    let cancelled = false

    async function run() {
      const [globalBadges, channelBadges, emotes] = await Promise.all([
        loadGlobalBadgeCatalog().catch(() => createEmptyBadgeCatalog()),
        loadChannelBadgeCatalog(id, controller.signal).catch(() =>
          createEmptyBadgeCatalog()
        ),
        loadThirdPartyEmoteCatalog(id, controller.signal).catch(() =>
          createEmptyEmoteCatalog()
        ),
      ])
      if (cancelled) {
        return
      }
      setCatalog({
        key: id,
        value: {
          badges: mergeBadgeCatalogs(globalBadges, channelBadges),
          emotes,
        },
      })
    }

    void run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, id, refreshToken])

  if (!enabled || catalog.key !== id) {
    return emptyCatalog
  }

  return catalog.value
}
