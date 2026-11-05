import type { Settings } from "@/lib/settings/config"

export type Provider = {
  id: string
  name: string
  url: string
  builtin: boolean
  enabled: boolean
}

export type BuiltinProvider = Omit<Provider, "enabled" | "builtin"> & {
  defaultEnabled: boolean
}

const on = (id: string, name: string, url: string): BuiltinProvider => ({
  id,
  name,
  url,
  defaultEnabled: true,
})

const off = (id: string, name: string, url: string): BuiltinProvider => ({
  id,
  name,
  url,
  defaultEnabled: false,
})

/** The public instances listed on https://bestlogs.lurkology.com/status. */
export const BUILTIN_PROVIDERS: BuiltinProvider[] = [
  on("ivr", "IVR", "https://logs.ivr.fi"),
  on("logxx", "Logxx", "https://logxx.dev"),
  off("cyex", "Cyex", "https://logs.cyex.app"),
  off("folhinhabot", "FolhinhaBot", "https://logs.folhinhabot.com"),
  off("harambelogs", "Harambelogs", "https://harambelogs.pl"),
  off("jimmyboy", "Jimmyboy", "https://logs.jimmyboy.dev"),
  off("lotuslabs", "Lotus Labs", "https://logs.lotuslabs.dev"),
  off("mrchuw", "mrchuw", "https://logs.mrchuw.com.br"),
  off("nadeko", "Nadeko", "https://logs.nadeko.net"),
  off("potat", "Potat", "https://logs.potat.app"),
  off("spanix", "Spanix", "https://logs.spanix.team"),
  off("supa", "Supa", "https://logs.supa.codes"),
  off("susgee", "Susgee", "https://logs.susgee.dev"),
  off("twitchmetrics", "TwitchMetrics", "https://logs.twitchmetrics.xyz"),
  off("vtlogs", "VTLogs", "https://vtlogs.moe"),
]

export function isBuiltinEnabled(
  provider: BuiltinProvider,
  config: Pick<Settings["providers"], "disabledBuiltin" | "enabledBuiltin">
) {
  return provider.defaultEnabled
    ? !config.disabledBuiltin.includes(provider.id)
    : config.enabledBuiltin.includes(provider.id)
}

export function getProvidersFromSettings(
  settings: Pick<Settings, "providers">
): Provider[] {
  const builtins: Provider[] = BUILTIN_PROVIDERS.map((provider) => ({
    id: provider.id,
    name: provider.name,
    url: provider.url,
    builtin: true,
    enabled: isBuiltinEnabled(provider, settings.providers),
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
