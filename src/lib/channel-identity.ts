import { readJson, writeJson } from "@/lib/storage"

export const CHANNEL_IDENTITY_STORAGE_KEY = "chatlogs:channel-identities"

export type ChannelIdentity = {
  login: string
  displayName: string
  logo: string
  id: string
}

type Store = Record<string, ChannelIdentity>

const listeners = new Set<() => void>()
let store: Store | null = null

function emptyStore(): Store {
  return {}
}

function isIdentity(value: unknown): value is ChannelIdentity {
  if (!value || typeof value !== "object") {
    return false
  }
  const item = value as ChannelIdentity
  return (
    typeof item.login === "string" &&
    typeof item.displayName === "string" &&
    typeof item.logo === "string"
  )
}

function readStore(): Store {
  const stored = readJson<Store>(CHANNEL_IDENTITY_STORAGE_KEY, emptyStore())
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return emptyStore()
  }

  const next: Store = {}
  for (const [key, value] of Object.entries(stored)) {
    if (!isIdentity(value)) {
      continue
    }
    next[key.toLowerCase()] = {
      login: value.login.toLowerCase(),
      displayName: value.displayName,
      logo: value.logo,
      id: typeof value.id === "string" ? value.id : "",
    }
  }
  return next
}

function getStore(): Store {
  if (!store) {
    store = readStore()
  }
  return store
}

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeChannelIdentities(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getChannelIdentitySnapshot() {
  return getStore()
}

export function getChannelIdentity(login: string): ChannelIdentity | null {
  const key = login.trim().toLowerCase()
  if (!key) {
    return null
  }
  return getStore()[key] ?? null
}

export function rememberChannelIdentity(input: {
  login?: string | null
  displayName?: string | null
  logo?: string | null
  id?: string | null
}) {
  const login = (input.login ?? "").trim().toLowerCase()
  if (!login) {
    return
  }

  const current = getStore()
  const existing = current[login]
  const identity: ChannelIdentity = {
    login,
    displayName: input.displayName?.trim() || existing?.displayName || login,
    logo: input.logo?.trim() || existing?.logo || "",
    id: input.id?.trim() || existing?.id || "",
  }

  if (
    existing &&
    existing.displayName === identity.displayName &&
    existing.logo === identity.logo &&
    existing.id === identity.id
  ) {
    return
  }

  const next: Store = { ...current, [login]: identity }
  if (identity.id && identity.id !== login) {
    next[identity.id] = identity
  }

  store = next
  try {
    writeJson(CHANNEL_IDENTITY_STORAGE_KEY, next)
  } catch {}
  emit()
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === CHANNEL_IDENTITY_STORAGE_KEY) {
      store = null
      emit()
    }
  })
}
