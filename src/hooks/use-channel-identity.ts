import { useMemo, useSyncExternalStore } from "react"

import {
  getChannelIdentitySnapshot,
  subscribeChannelIdentities,
  type ChannelIdentity,
} from "@/lib/channel-identity"

export function useChannelIdentity(login: string) {
  const identities = useSyncExternalStore(
    subscribeChannelIdentities,
    getChannelIdentitySnapshot,
    getChannelIdentitySnapshot
  )
  const key = login.trim().toLowerCase()
  if (!key) {
    return null
  }
  return identities[key] ?? null
}

export function useChannelIdentities(logins: string[]) {
  const identities = useSyncExternalStore(
    subscribeChannelIdentities,
    getChannelIdentitySnapshot,
    getChannelIdentitySnapshot
  )
  const key = logins
    .map((login) => login.trim().toLowerCase())
    .filter(Boolean)
    .join(",")

  return useMemo(() => {
    const result: Record<string, ChannelIdentity | null> = {}
    for (const login of key.split(",").filter(Boolean)) {
      result[login] = identities[login] ?? null
    }
    return result
  }, [identities, key])
}
