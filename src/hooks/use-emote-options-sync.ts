import { useEffect, useRef } from "react"

import {
  resetThirdPartyEmoteCache,
  setEmoteServiceOptions,
  type EmoteServiceOptions,
} from "@/lib/chat/emotes"
import { useSettingsSelector } from "@/hooks/use-settings"
import type { EmotesConfig } from "@/lib/settings/config"

/**
 * Keeps the emote module's service options in sync with settings. Returns a
 * token that changes whenever the emote catalog must be reloaded (a provider
 * or zero-width flag changed), suitable as `refreshToken` for useChatCatalog.
 */
export function useEmoteOptionsSync(): string {
  const emotes = useSettingsSelector((settings) => settings.emotes)
  const appliedRef = useRef<EmotesConfig>(emotes)

  useEffect(() => {
    const previous = appliedRef.current
    const options: EmoteServiceOptions = {
      bttvEnabled: emotes.bttvEnabled,
      ffzEnabled: emotes.ffzEnabled,
      seventvEnabled: emotes.seventvEnabled,
      zeroWidthEmotesEnabled: emotes.zeroWidthEmotesEnabled,
    }
    setEmoteServiceOptions(options)

    const catalogInvalidating =
      previous.bttvEnabled !== options.bttvEnabled ||
      previous.ffzEnabled !== options.ffzEnabled ||
      previous.seventvEnabled !== options.seventvEnabled ||
      previous.zeroWidthEmotesEnabled !== options.zeroWidthEmotesEnabled

    if (catalogInvalidating) {
      resetThirdPartyEmoteCache()
    }

    appliedRef.current = emotes
  }, [emotes])

  return [
    emotes.bttvEnabled,
    emotes.ffzEnabled,
    emotes.seventvEnabled,
    emotes.zeroWidthEmotesEnabled,
  ].join(":")
}
