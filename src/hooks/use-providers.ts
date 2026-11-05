import { useCallback, useMemo } from "react"

import {
  addCustomProviderToSettings,
  addCustomProvidersToSettings,
  setProviderEnabledInSettings,
  removeCustomProviderFromSettings,
  type CustomProvider,
} from "@/lib/settings/config"
import { getProvidersFromSettings, type Provider } from "@/lib/providers"
import { useSettings } from "@/hooks/use-settings"

export function useProviders() {
  const { settings, updateSettings } = useSettings()

  // Settings are rebuilt on every change, so key the list by its contents.
  // Otherwise unrelated changes (like appearance) would restart log loading.
  const providersJson = JSON.stringify(settings.providers)
  const providers = useMemo(
    () => getProvidersFromSettings({ providers: JSON.parse(providersJson) }),
    [providersJson]
  )
  const enabled = useMemo(
    () => providers.filter((provider) => provider.enabled),
    [providers]
  )

  const setEnabled = useCallback(
    (id: string, nextEnabled: boolean) => {
      updateSettings((current) =>
        setProviderEnabledInSettings(current, id, nextEnabled)
      )
    },
    [updateSettings]
  )

  const add = useCallback(
    (name: string, url: string): CustomProvider => {
      let added: CustomProvider | null = null
      updateSettings((current) => {
        const result = addCustomProviderToSettings(current, name, url)
        added = result.provider
        return result.settings
      })
      return added!
    },
    [updateSettings]
  )

  const addMany = useCallback(
    (entries: Array<{ name: string; url: string }>) => {
      let counts = { added: 0, enabled: 0, existing: 0 }
      updateSettings((current) => {
        const result = addCustomProvidersToSettings(current, entries)
        counts = {
          added: result.added.length,
          enabled: result.enabled.length,
          existing: result.existing.length,
        }
        return counts.added + counts.enabled > 0 ? result.settings : current
      })
      return counts
    },
    [updateSettings]
  )

  const remove = useCallback(
    (id: string) => {
      updateSettings((current) => removeCustomProviderFromSettings(current, id))
    },
    [updateSettings]
  )

  return { providers, enabled, setEnabled, add, addMany, remove }
}

export type { Provider }
