import { readJson, writeJson } from "@/lib/storage"
import { BUILTIN_PROVIDERS, normalizeEndpoint } from "@/lib/providers"

export const SETTINGS_STORAGE_KEY = "chatlogs::config"
export const SETTINGS_SCHEMA_VERSION = 1

const LEGACY_PROVIDERS_KEY = "chatlogs:providers"
const LEGACY_NEWEST_AT_BOTTOM_KEY = "chatlogs.newestAtBottom"

export const CHAT_FONT_SIZE_MIN = 10
export const CHAT_FONT_SIZE_MAX = 24
export const CHAT_FONT_SIZE_DEFAULT = 13
export const CHAT_EMOTE_SCALE_MIN = 10
export const CHAT_EMOTE_SCALE_MAX = 24
export const CHAT_EMOTE_SCALE_DEFAULT = 13

export type MessageTimestampFormat =
  "24-hour" | "12-hour" | "12-hour-meridiem" | "none"

export type AppearanceConfig = {
  messageTimestampFormat: MessageTimestampFormat
  fontFamily: string
  fontSizePx: number
  emoteScale: number
  linkEmoteScaleToFontSize: boolean
  alternatingRowBackgrounds: boolean
  messageSeparators: boolean
}

export type EmotesConfig = {
  bttvEnabled: boolean
  ffzEnabled: boolean
  seventvEnabled: boolean
  zeroWidthEmotesEnabled: boolean
}

export type LogsConfig = {
  newestAtBottom: boolean
}

export type CustomProvider = {
  id: string
  name: string
  url: string
  enabled: boolean
}

export type ProvidersConfig = {
  disabledBuiltin: string[]
  custom: CustomProvider[]
}

export type Settings = {
  schemaVersion: number
  updatedAt: string
  appearance: AppearanceConfig
  emotes: EmotesConfig
  logs: LogsConfig
  providers: ProvidersConfig
}

export const MESSAGE_TIMESTAMP_FORMATS: MessageTimestampFormat[] = [
  "24-hour",
  "12-hour",
  "12-hour-meridiem",
  "none",
]

export function createDefaultSettings(): Settings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    appearance: {
      messageTimestampFormat: "24-hour",
      fontFamily: "",
      fontSizePx: CHAT_FONT_SIZE_DEFAULT,
      emoteScale: CHAT_EMOTE_SCALE_DEFAULT,
      linkEmoteScaleToFontSize: true,
      alternatingRowBackgrounds: false,
      messageSeparators: false,
    },
    emotes: {
      bttvEnabled: true,
      ffzEnabled: true,
      seventvEnabled: true,
      zeroWidthEmotesEnabled: true,
    },
    logs: {
      newestAtBottom: true,
    },
    providers: {
      disabledBuiltin: [],
      custom: [],
    },
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? Math.round(value) : Number.NaN
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(max, Math.max(min, parsed))
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function normalizeAppearance(raw: unknown): AppearanceConfig {
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >
  const defaults = createDefaultSettings().appearance
  const fontSizePx = clampInt(
    source.fontSizePx,
    CHAT_FONT_SIZE_MIN,
    CHAT_FONT_SIZE_MAX,
    CHAT_FONT_SIZE_DEFAULT
  )
  const linkEmoteScaleToFontSize = asBoolean(
    source.linkEmoteScaleToFontSize,
    defaults.linkEmoteScaleToFontSize
  )

  return {
    messageTimestampFormat: oneOf(
      source.messageTimestampFormat,
      MESSAGE_TIMESTAMP_FORMATS,
      defaults.messageTimestampFormat
    ),
    fontFamily: asString(source.fontFamily).slice(0, 200),
    fontSizePx,
    emoteScale: clampInt(
      source.emoteScale,
      CHAT_EMOTE_SCALE_MIN,
      CHAT_EMOTE_SCALE_MAX,
      CHAT_EMOTE_SCALE_DEFAULT
    ),
    linkEmoteScaleToFontSize,
    alternatingRowBackgrounds: asBoolean(
      source.alternatingRowBackgrounds,
      defaults.alternatingRowBackgrounds
    ),
    messageSeparators: asBoolean(
      source.messageSeparators,
      defaults.messageSeparators
    ),
  }
}

function normalizeEmotes(raw: unknown): EmotesConfig {
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >
  const defaults = createDefaultSettings().emotes

  return {
    bttvEnabled: asBoolean(source.bttvEnabled, defaults.bttvEnabled),
    ffzEnabled: asBoolean(source.ffzEnabled, defaults.ffzEnabled),
    seventvEnabled: asBoolean(source.seventvEnabled, defaults.seventvEnabled),
    zeroWidthEmotesEnabled: asBoolean(
      source.zeroWidthEmotesEnabled,
      defaults.zeroWidthEmotesEnabled
    ),
  }
}

function normalizeLogs(raw: unknown): LogsConfig {
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >
  const defaults = createDefaultSettings().logs

  return {
    newestAtBottom: asBoolean(source.newestAtBottom, defaults.newestAtBottom),
  }
}

function normalizeCustomProvider(raw: unknown): CustomProvider | null {
  if (typeof raw !== "object" || raw === null) {
    return null
  }
  const source = raw as Record<string, unknown>
  const id = asString(source.id)
  const name = asString(source.name)
  let url: string
  try {
    url = normalizeEndpoint(asString(source.url))
  } catch {
    return null
  }
  if (!id || !name) {
    return null
  }
  return {
    id,
    name,
    url,
    enabled: asBoolean(source.enabled, true),
  }
}

function normalizeProviders(raw: unknown): ProvidersConfig {
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >
  const custom = Array.isArray(source.custom)
    ? source.custom
        .map(normalizeCustomProvider)
        .filter((provider): provider is CustomProvider => provider !== null)
    : []
  const disabledBuiltin = Array.isArray(source.disabledBuiltin)
    ? source.disabledBuiltin.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    : []

  return { disabledBuiltin, custom }
}

export function normalizeSettings(raw: unknown): Settings {
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    appearance: normalizeAppearance(source.appearance),
    emotes: normalizeEmotes(source.emotes),
    logs: normalizeLogs(source.logs),
    providers: normalizeProviders(source.providers),
  }
}

type LegacyProviderStore = {
  disabled: string[]
  custom: Array<{
    id: string
    name: string
    url: string
    enabled: boolean
  }>
}

/**
 * Carry over settings written by older builds so nothing is lost when the
 * unified config key takes over.
 */
function migrateLegacySettings(): Partial<Settings> | null {
  const migrated: Partial<Settings> = {}

  const legacyProviders = readJson<LegacyProviderStore | null>(
    LEGACY_PROVIDERS_KEY,
    null
  )
  if (legacyProviders && Array.isArray(legacyProviders.custom)) {
    migrated.providers = normalizeProviders({
      disabledBuiltin: Array.isArray(legacyProviders.disabled)
        ? legacyProviders.disabled
        : [],
      custom: legacyProviders.custom,
    })
  }

  const legacyNewestAtBottom = readJson<unknown>(
    LEGACY_NEWEST_AT_BOTTOM_KEY,
    null
  )
  if (typeof legacyNewestAtBottom === "boolean") {
    migrated.logs = { newestAtBottom: legacyNewestAtBottom }
  }

  return Object.keys(migrated).length > 0 ? migrated : null
}

export function loadSettings(): Settings {
  const raw = readJson<unknown>(SETTINGS_STORAGE_KEY, null)
  if (raw) {
    try {
      return normalizeSettings(raw)
    } catch {
      // fall through to legacy migration and defaults
    }
  }

  const migrated = migrateLegacySettings()
  const base = createDefaultSettings()
  if (!migrated) {
    return base
  }
  return normalizeSettings({ ...base, ...migrated })
}

export function saveSettings(settings: Settings) {
  writeJson(SETTINGS_STORAGE_KEY, settings)
}

// ---------------------------------------------------------------------------
// Module-level store with cross-tab sync
// ---------------------------------------------------------------------------

let currentSettings: Settings = loadSettings()
const listeners = new Set<() => void>()

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

export function getSettingsSnapshot(): Settings {
  return currentSettings
}

export function subscribeToSettings(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function updateSettings(
  updater: Settings | ((current: Settings) => Settings)
) {
  const next =
    typeof updater === "function" ? updater(currentSettings) : updater
  if (next === currentSettings) {
    return
  }
  currentSettings = normalizeSettings(next)
  saveSettings(currentSettings)
  emitChange()
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (
      event.key !== SETTINGS_STORAGE_KEY ||
      event.storageArea !== localStorage
    ) {
      return
    }
    if (!event.newValue) {
      return
    }
    try {
      currentSettings = normalizeSettings(JSON.parse(event.newValue))
      emitChange()
    } catch {
      // ignore malformed writes from other tabs
    }
  })
}

// ---------------------------------------------------------------------------
// Provider mutations on top of the config
// ---------------------------------------------------------------------------

export function setProviderEnabledInSettings(
  settings: Settings,
  id: string,
  enabled: boolean
): Settings {
  const customIndex = settings.providers.custom.findIndex(
    (provider) => provider.id === id
  )
  if (customIndex >= 0) {
    const custom = settings.providers.custom.slice()
    custom[customIndex] = { ...custom[customIndex]!, enabled }
    return {
      ...settings,
      updatedAt: new Date().toISOString(),
      providers: { ...settings.providers, custom },
    }
  }

  const disabledBuiltin = new Set(settings.providers.disabledBuiltin)
  if (enabled) {
    disabledBuiltin.delete(id)
  } else {
    disabledBuiltin.add(id)
  }
  return {
    ...settings,
    updatedAt: new Date().toISOString(),
    providers: {
      ...settings.providers,
      disabledBuiltin: [...disabledBuiltin],
    },
  }
}

export function addCustomProviderToSettings(
  settings: Settings,
  name: string,
  url: string
): { settings: Settings; provider: CustomProvider } {
  const provider: CustomProvider = {
    id: `custom-${crypto.randomUUID()}`,
    name: name.trim(),
    url: normalizeEndpoint(url),
    enabled: true,
  }

  if (!provider.name) {
    throw new Error("Give the endpoint a name.")
  }

  const duplicateUrl = (item: { url: string }) =>
    item.url.replace(/\/+$/, "") === provider.url
  const exists =
    BUILTIN_PROVIDERS.some(duplicateUrl) ||
    settings.providers.custom.some(duplicateUrl)
  if (exists) {
    throw new Error("That endpoint is already in the list.")
  }

  return {
    settings: {
      ...settings,
      updatedAt: new Date().toISOString(),
      providers: {
        ...settings.providers,
        custom: [...settings.providers.custom, provider],
      },
    },
    provider,
  }
}

export function removeCustomProviderFromSettings(
  settings: Settings,
  id: string
): Settings {
  return {
    ...settings,
    updatedAt: new Date().toISOString(),
    providers: {
      ...settings.providers,
      custom: settings.providers.custom.filter(
        (provider) => provider.id !== id
      ),
    },
  }
}
