import { useEffect, useRef } from "react"
import { toast } from "sonner"

import {
  onRepeatedProviderFailure,
  resetProviderFailures,
} from "@/lib/provider-health"
import type { Provider } from "@/lib/providers"

/**
 * Offers to disable a provider once it has failed to load several times in a
 * row. Each provider is asked about at most once per page load.
 */
export function useProviderFailureWarnings(
  providers: Provider[],
  setEnabled: (id: string, enabled: boolean) => void
) {
  const latest = useRef({ providers, setEnabled })
  useEffect(() => {
    latest.current = { providers, setEnabled }
  }, [providers, setEnabled])

  useEffect(
    () =>
      onRepeatedProviderFailure((providerId) => {
        const provider = latest.current.providers.find(
          (item) => item.id === providerId
        )
        if (!provider?.enabled) {
          return
        }
        toast.warning(
          `"${provider.name}" has failed to load several times. Would you like to disable it?`,
          {
            id: `provider-failing:${provider.id}`,
            duration: 15000,
            action: {
              label: "Disable",
              onClick: () => {
                latest.current.setEnabled(provider.id, false)
                resetProviderFailures(provider.id)
                toast.success(
                  `Disabled "${provider.name}". You can turn it back on in Settings.`
                )
              },
            },
          }
        )
      }),
    []
  )
}
