import { useCallback, useSyncExternalStore } from "react"

import {
  getSettingsSnapshot,
  subscribeToSettings,
  updateSettings,
  type Settings,
} from "@/lib/settings/config"

export function useSettings() {
  const settings = useSyncExternalStore(
    subscribeToSettings,
    getSettingsSnapshot,
    getSettingsSnapshot
  )

  const update = useCallback(
    (updater: Settings | ((current: Settings) => Settings)) => {
      updateSettings(updater)
    },
    []
  )

  return { settings, updateSettings: update }
}

/**
 * Subscribe to a single slice of the settings. The selector must return a
 * stable value (primitive or object identity from the store) — pick fields,
 * don't derive new objects.
 */
export function useSettingsSelector<T>(selector: (settings: Settings) => T): T {
  return useSyncExternalStore(
    subscribeToSettings,
    () => selector(getSettingsSnapshot()),
    () => selector(getSettingsSnapshot())
  )
}
