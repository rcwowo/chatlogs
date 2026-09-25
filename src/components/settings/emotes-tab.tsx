import { useCallback } from "react"

import type { EmotesConfig } from "@/lib/settings/config"
import { useSettings } from "@/hooks/use-settings"
import {
  SettingsGroup,
  SettingsPanel,
  SettingsSection,
  SettingsSwitchRow,
} from "@/components/settings/settings-primitives"

export function EmotesTab() {
  const { settings, updateSettings } = useSettings()
  const emotes = settings.emotes

  const updateEmotes = useCallback(
    (patch: Partial<EmotesConfig>) => {
      updateSettings((current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        emotes: { ...current.emotes, ...patch },
      }))
    },
    [updateSettings]
  )

  return (
    <SettingsPanel>
      <SettingsSection
        title="Emote services"
        description="Messages are matched against the enabled services. Twitch emotes are always available."
      >
        <SettingsGroup>
          <SettingsSwitchRow
            title="BetterTTV"
            description="Global and channel emotes from BetterTTV."
            checked={emotes.bttvEnabled}
            onCheckedChange={(checked) =>
              updateEmotes({ bttvEnabled: checked })
            }
          />
          <SettingsSwitchRow
            title="FrankerFaceZ"
            description="Global and channel emotes from FrankerFaceZ."
            checked={emotes.ffzEnabled}
            onCheckedChange={(checked) => updateEmotes({ ffzEnabled: checked })}
          />
          <SettingsSwitchRow
            title="7TV"
            description="Global and channel emote sets from 7TV."
            checked={emotes.seventvEnabled}
            onCheckedChange={(checked) =>
              updateEmotes({ seventvEnabled: checked })
            }
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        title="Rendering"
        description="Fine-tune how third-party emotes are drawn."
      >
        <SettingsGroup>
          <SettingsSwitchRow
            title="Zero-width overlays"
            description="Stack 7TV zero-width emotes on top of the previous emote."
            checked={emotes.zeroWidthEmotesEnabled}
            disabled={!emotes.seventvEnabled}
            onCheckedChange={(checked) =>
              updateEmotes({ zeroWidthEmotesEnabled: checked })
            }
          />
        </SettingsGroup>
      </SettingsSection>
    </SettingsPanel>
  )
}
