import type { ProviderResult } from "@/lib/rustlog"

export type ProviderProgress =
  | { status: "pending" }
  | (Omit<ProviderResult, "providerId"> & { elapsedMs: number })

export type LoadProgress = {
  key: string
  startedAt: number
  /** Provider ids being queried, in display order. */
  providerIds: string[]
  providers: Record<string, ProviderProgress>
  /** Set once every provider has answered and messages are being merged. */
  merging?: { total: number }
  /** Twitch profile lookup, only tracked while discovering a channel. */
  profile?: "pending" | "done"
}

export function startProgress(
  key: string,
  providerIds: string[],
  extra: Partial<LoadProgress> = {}
): LoadProgress {
  return {
    key,
    startedAt: Date.now(),
    providerIds,
    providers: Object.fromEntries(
      providerIds.map((id) => [id, { status: "pending" } as const])
    ),
    ...extra,
  }
}

export function recordProviderResult(
  progress: LoadProgress,
  key: string,
  result: ProviderResult
): LoadProgress {
  if (progress.key !== key) {
    return progress
  }
  const { providerId, ...rest } = result
  return {
    ...progress,
    providers: {
      ...progress.providers,
      [providerId]: { ...rest, elapsedMs: Date.now() - progress.startedAt },
    },
  }
}
