import { useCallback, useEffect, useMemo, useState } from "react"

import {
  addCustomProvider,
  listProviders,
  removeCustomProvider,
  setProviderEnabled,
  type Provider,
} from "@/lib/providers"

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>(() => listProviders())

  const refresh = useCallback(() => {
    setProviders(listProviders())
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "chatlogs:providers") {
        refresh()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [refresh])

  const enabled = useMemo(
    () => providers.filter((provider) => provider.enabled),
    [providers]
  )

  const setEnabled = useCallback((id: string, enabled: boolean) => {
    setProviderEnabled(id, enabled)
    refresh()
  }, [refresh])

  const add = useCallback(
    (name: string, url: string) => {
      const provider = addCustomProvider(name, url)
      refresh()
      return provider
    },
    [refresh]
  )

  const remove = useCallback(
    (id: string) => {
      removeCustomProvider(id)
      refresh()
    },
    [refresh]
  )

  return { providers, enabled, setEnabled, add, remove }
}
