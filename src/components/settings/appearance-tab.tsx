import { useCallback, useState } from "react"
import { Link2Icon, Unlink2Icon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import {
  CHAT_EMOTE_SCALE_DEFAULT,
  CHAT_EMOTE_SCALE_MAX,
  CHAT_EMOTE_SCALE_MIN,
  CHAT_FONT_SIZE_MAX,
  CHAT_FONT_SIZE_MIN,
  type AppearanceConfig,
  type MessageTimestampFormat,
} from "@/lib/settings/config"
import { useSettings } from "@/hooks/use-settings"
import {
  SettingsGroup,
  SettingsInputRow,
  SettingsPanel,
  SettingsSection,
  SettingsSegmented,
  SettingsSliderRow,
  SettingsSwitchRow,
} from "@/components/settings/settings-primitives"
import { cn } from "@/lib/utils"

const MESSAGE_TIMESTAMP_FORMAT_OPTIONS: {
  value: MessageTimestampFormat
  preview: string
}[] = [
  { value: "24-hour", preview: "17:38" },
  { value: "12-hour", preview: "5:38" },
  { value: "12-hour-meridiem", preview: "5:38 PM" },
  { value: "none", preview: "None" },
]

function formatEmoteScale(value: number) {
  return `${Math.round((value / CHAT_EMOTE_SCALE_DEFAULT) * 100)}%`
}

function ScaleLinkDivider({
  linked,
  onToggle,
}: {
  linked: boolean
  onToggle: () => void
}) {
  const Icon = linked ? Link2Icon : Unlink2Icon

  return (
    <div
      className={cn(
        "relative h-0 border-t",
        linked ? "border-primary/60" : "border-dashed border-border"
      )}
    >
      <button
        type="button"
        aria-pressed={linked}
        title={
          linked
            ? "Disconnect font size and emote scale"
            : "Connect font size and emote scale"
        }
        aria-label={
          linked
            ? "Disconnect font size and emote scale"
            : "Connect font size and emote scale"
        }
        onClick={onToggle}
        className={cn(
          "absolute top-0 left-1/2 z-10 flex size-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border bg-background shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
          linked
            ? "border-primary/45 text-primary"
            : "border-border text-muted-foreground"
        )}
      >
        <Icon className="size-3" />
      </button>
    </div>
  )
}

function FontFamilySettingRow({
  fontFamily,
  onCommit,
}: {
  fontFamily: string
  onCommit: (fontFamily: string) => void
}) {
  const [draft, setDraft] = useState(fontFamily)

  const commit = useCallback(() => {
    const next = draft.trim()
    if (next === fontFamily) return
    onCommit(next)
  }, [draft, fontFamily, onCommit])

  return (
    <SettingsInputRow
      label="Font family"
      description="Google or system font name. Leave empty for the app default."
      value={draft}
      placeholder="Inter, sans-serif, monospace, etc."
      onChange={setDraft}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur()
        }
      }}
    />
  )
}

export function AppearanceTab() {
  const { settings, updateSettings } = useSettings()
  const { theme, setTheme } = useTheme()
  const appearance = settings.appearance

  const updateAppearance = useCallback(
    (patch: Partial<AppearanceConfig>) => {
      updateSettings((current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        appearance: { ...current.appearance, ...patch },
      }))
    },
    [updateSettings]
  )

  const updateFontSize = useCallback(
    (fontSizePx: number) => {
      updateAppearance({
        fontSizePx,
        emoteScale: appearance.linkEmoteScaleToFontSize
          ? fontSizePx
          : appearance.emoteScale,
      })
    },
    [
      appearance.emoteScale,
      appearance.linkEmoteScaleToFontSize,
      updateAppearance,
    ]
  )

  const updateEmoteScale = useCallback(
    (emoteScale: number) => {
      updateAppearance({
        emoteScale,
        fontSizePx: appearance.linkEmoteScaleToFontSize
          ? emoteScale
          : appearance.fontSizePx,
      })
    },
    [
      appearance.fontSizePx,
      appearance.linkEmoteScaleToFontSize,
      updateAppearance,
    ]
  )

  const toggleLinkedScales = useCallback(() => {
    const nextLinked = !appearance.linkEmoteScaleToFontSize
    updateAppearance({
      linkEmoteScaleToFontSize: nextLinked,
      emoteScale: nextLinked ? appearance.fontSizePx : appearance.emoteScale,
    })
  }, [
    appearance.emoteScale,
    appearance.fontSizePx,
    appearance.linkEmoteScaleToFontSize,
    updateAppearance,
  ])

  return (
    <SettingsPanel>
      <SettingsSection
        title="Theme"
        description="Use light, dark, or your system's appearance."
      >
        <SettingsSegmented
          value={theme}
          onChange={setTheme}
          size="lg"
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </SettingsSection>

      <SettingsSection
        title="Timestamps"
        description="How timestamps appear next to each message."
      >
        <SettingsSegmented
          value={appearance.messageTimestampFormat}
          size="lg"
          onChange={(messageTimestampFormat) =>
            updateAppearance({ messageTimestampFormat })
          }
          options={MESSAGE_TIMESTAMP_FORMAT_OPTIONS}
        />
      </SettingsSection>

      <SettingsSection
        title="Message list"
        description="How rows are laid out in the log timeline."
      >
        <SettingsGroup>
          <SettingsSwitchRow
            title="Alternating row backgrounds"
            description="Use a subtle stripe on every other message for easier scanning."
            checked={appearance.alternatingRowBackgrounds}
            onCheckedChange={(checked) =>
              updateAppearance({ alternatingRowBackgrounds: checked })
            }
          />
          <SettingsSwitchRow
            title="Separators between messages"
            description="Draw a light border under each message row."
            checked={appearance.messageSeparators}
            onCheckedChange={(checked) =>
              updateAppearance({ messageSeparators: checked })
            }
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        title="Typography"
        description="How log messages are displayed."
      >
        <SettingsGroup>
          <FontFamilySettingRow
            key={appearance.fontFamily}
            fontFamily={appearance.fontFamily}
            onCommit={(fontFamily) => updateAppearance({ fontFamily })}
          />
          <div>
            <SettingsSliderRow
              title="Font size"
              value={appearance.fontSizePx}
              min={CHAT_FONT_SIZE_MIN}
              max={CHAT_FONT_SIZE_MAX}
              onChange={updateFontSize}
            />
            <ScaleLinkDivider
              linked={appearance.linkEmoteScaleToFontSize}
              onToggle={toggleLinkedScales}
            />
            <SettingsSliderRow
              title="Emote scale"
              value={appearance.emoteScale}
              valueLabel={formatEmoteScale(appearance.emoteScale)}
              min={CHAT_EMOTE_SCALE_MIN}
              max={CHAT_EMOTE_SCALE_MAX}
              onChange={updateEmoteScale}
            />
          </div>
        </SettingsGroup>
      </SettingsSection>
    </SettingsPanel>
  )
}
