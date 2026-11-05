import { readJson, writeJson } from "@/lib/storage"
import {
  BUILTIN_PROVIDERS,
  getProvidersFromSettings,
  normalizeEndpoint,
} from "@/lib/providers"

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
  /** Built-ins that are on by default but turned off. */
  disabledBuiltin: string[]
  /** Built-ins that are off by default but turned on. */
  enabledBuiltin: string[]
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
      enabledBuiltin: [],
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

function asIdList(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    : []
}

function normalizeProviders(raw: unknown): ProvidersConfig {
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >
  const custom: CustomProvider[] = []
  const disabledBuiltin = new Set(asIdList(source.disabledBuiltin))
  const enabledBuiltin = new Set(asIdList(source.enabledBuiltin))
  const rawCustom = Array.isArray(source.custom) ? source.custom : []
  for (const provider of rawCustom.map(normalizeCustomProvider)) {
    if (!provider) {
      continue
    }
    // Endpoints added by hand before they became built-in fold into the
    // built-in entry, keeping whether they were switched on.
    const builtin = BUILTIN_PROVIDERS.find((item) => item.url === provider.url)
    if (!builtin) {
      custom.push(provider)
    } else if (provider.enabled) {
      disabledBuiltin.delete(builtin.id)
      enabledBuiltin.add(builtin.id)
    }
  }

  return {
    disabledBuiltin: [...disabledBuiltin],
    enabledBuiltin: [...enabledBuiltin],
    custom,
  }
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
  const enabledBuiltin = new Set(settings.providers.enabledBuiltin)
  if (enabled) {
    disabledBuiltin.delete(id)
    enabledBuiltin.add(id)
  } else {
    disabledBuiltin.add(id)
    enabledBuiltin.delete(id)
  }
  return {
    ...settings,
    updatedAt: new Date().toISOString(),
    providers: {
      ...settings.providers,
      disabledBuiltin: [...disabledBuiltin],
      enabledBuiltin: [...enabledBuiltin],
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

  if (hasProviderUrl(settings, provider.url)) {
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

function hasProviderUrl(settings: Settings, url: string) {
  const matches = (item: { url: string }) =>
    item.url.replace(/\/+$/, "") === url
  return (
    BUILTIN_PROVIDERS.some(matches) || settings.providers.custom.some(matches)
  )
}

/**
 * Adds every new URL, switches on listed ones that are off, and reports the
 * ones already in use.
 */
export function addCustomProvidersToSettings(
  settings: Settings,
  entries: Array<{ name: string; url: string }>
): {
  settings: Settings
  added: CustomProvider[]
  enabled: string[]
  existing: string[]
} {
  const added: CustomProvider[] = []
  const enabled: string[] = []
  const existing: string[] = []
  let next = settings

  for (const entry of entries) {
    const url = normalizeEndpoint(entry.url)
    const listed = getProvidersFromSettings(next).find(
      (provider) => provider.url.replace(/\/+$/, "") === url
    )
    if (listed?.enabled) {
      existing.push(url)
      continue
    }
    if (listed) {
      next = setProviderEnabledInSettings(next, listed.id, true)
      enabled.push(url)
      continue
    }
    const result = addCustomProviderToSettings(next, entry.name, url)
    next = result.settings
    added.push(result.provider)
  }

  return { settings: next, added, enabled, existing }
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
