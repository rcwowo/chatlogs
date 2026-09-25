import type { Settings } from "@/lib/settings/config"

export type Provider = {
  id: string
  name: string
  url: string
  builtin: boolean
  enabled: boolean
}

export const BUILTIN_PROVIDERS: Array<Omit<Provider, "enabled" | "builtin">> = [
  { id: "ivr", name: "IVR", url: "https://logs.ivr.fi" },
  { id: "logxx", name: "Logxx", url: "https://logxx.dev" },
  { id: "spanix", name: "Spanix", url: "https://logs.spanix.team" },
  { id: "rcw-lab", name: "RCW Lab", url: "https://logs.lab.rcw.lol" },
]

export function getProvidersFromSettings(settings: Settings): Provider[] {
  const disabled = new Set(settings.providers.disabledBuiltin)

  const builtins: Provider[] = BUILTIN_PROVIDERS.map((provider) => ({
    ...provider,
    builtin: true,
    enabled: !disabled.has(provider.id),
  }))

  const custom: Provider[] = settings.providers.custom.map((provider) => ({
    ...provider,
    builtin: false,
  }))

  return [...builtins, ...custom]
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
