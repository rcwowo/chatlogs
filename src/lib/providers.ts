import { readJson, writeJson } from "@/lib/storage"

export type Provider = {
  id: string
  name: string
  url: string
  builtin: boolean
  enabled: boolean
}

type StoredProviders = {
  disabled: string[]
  custom: Array<{
    id: string
    name: string
    url: string
    enabled: boolean
  }>
}

const STORAGE_KEY = "chatlogs:providers"

export const BUILTIN_PROVIDERS: Array<Omit<Provider, "enabled" | "builtin">> = [
  { id: "ivr", name: "IVR", url: "https://logs.ivr.fi" },
  { id: "logxx", name: "Logxx", url: "https://logxx.dev" },
  { id: "spanix", name: "Spanix", url: "https://logs.spanix.team" },
  { id: "rcw-lab", name: "RCW Lab", url: "https://logs.lab.rcw.lol" },
]

const DEFAULT_ENABLED = new Set(BUILTIN_PROVIDERS.map((provider) => provider.id))

function defaultDisabledIds() {
  return BUILTIN_PROVIDERS.filter((provider) => !DEFAULT_ENABLED.has(provider.id)).map(
    (provider) => provider.id
  )
}

function emptyStore(): StoredProviders {
  return { disabled: [], custom: [] }
}

function readStore(): StoredProviders {
  const stored = readJson<StoredProviders>(STORAGE_KEY, emptyStore())
  if (!Array.isArray(stored.disabled) || !Array.isArray(stored.custom)) {
    return emptyStore()
  }
  return stored
}

function hasSavedStore() {
  return localStorage.getItem(STORAGE_KEY) !== null
}

function mutateStore(update: (store: StoredProviders) => StoredProviders) {
  const current = hasSavedStore()
    ? readStore()
    : { disabled: defaultDisabledIds(), custom: [] }
  writeJson(STORAGE_KEY, update(current))
}

export function listProviders(): Provider[] {
  const store = readStore()
  const disabled = new Set(store.disabled)
  const saved = hasSavedStore()

  const builtins: Provider[] = BUILTIN_PROVIDERS.map((provider) => ({
    ...provider,
    builtin: true,
    enabled: saved ? !disabled.has(provider.id) : DEFAULT_ENABLED.has(provider.id),
  }))

  const custom: Provider[] = store.custom.map((provider) => ({
    ...provider,
    builtin: false,
  }))

  return [...builtins, ...custom]
}

export function setProviderEnabled(id: string, enabled: boolean) {
  mutateStore((store) => {
    const customIndex = store.custom.findIndex((provider) => provider.id === id)
    if (customIndex >= 0) {
      const custom = store.custom.slice()
      custom[customIndex] = { ...custom[customIndex], enabled }
      return { ...store, custom }
    }

    const disabled = new Set(store.disabled)
    if (enabled) {
      disabled.delete(id)
    } else {
      disabled.add(id)
    }
    return { ...store, disabled: [...disabled] }
  })
}

export function addCustomProvider(name: string, url: string) {
  const provider = {
    id: `custom-${crypto.randomUUID()}`,
    name: name.trim(),
    url: normalizeEndpoint(url),
    enabled: true,
  }

  if (!provider.name) {
    throw new Error("Give the endpoint a name.")
  }

  const exists = listProviders().some(
    (item) => item.url.replace(/\/+$/, "") === provider.url
  )
  if (exists) {
    throw new Error("That endpoint is already in the list.")
  }

  mutateStore((store) => ({
    ...store,
    custom: [...store.custom, provider],
  }))

  return provider
}

export function removeCustomProvider(id: string) {
  mutateStore((store) => ({
    ...store,
    custom: store.custom.filter((provider) => provider.id !== id),
  }))
}

export function normalizeEndpoint(input: string) {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error("Enter a rustlog URL.")
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  const url = new URL(withProtocol)

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must be http or https.")
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`
}
