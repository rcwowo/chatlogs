import { useCallback, useMemo } from "react"

import {
  addCustomProviderToSettings,
  setProviderEnabledInSettings,
  removeCustomProviderFromSettings,
  type CustomProvider,
} from "@/lib/settings/config"
import { getProvidersFromSettings, type Provider } from "@/lib/providers"
import { useSettings } from "@/hooks/use-settings"

export function useProviders() {
  const { settings, updateSettings } = useSettings()

  const providers = useMemo(
    () => getProvidersFromSettings(settings),
    [settings]
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

  const remove = useCallback(
    (id: string) => {
      updateSettings((current) => removeCustomProviderFromSettings(current, id))
    },
    [updateSettings]
  )

  return { providers, enabled, setEnabled, add, remove }
}

export type { Provider }
