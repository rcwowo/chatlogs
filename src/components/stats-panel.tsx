import type { ChannelStats, ProviderStatus } from "@/lib/rustlog"
import { formatDateKey } from "@/lib/dates"
import type { Provider } from "@/lib/providers"
import { ProviderStatusList } from "@/components/provider-status"

export function StatsPanel({
  stats,
  loading = false,
  dates,
  providers,
  statuses,
  onChatterClick,
}: {
  stats: (ChannelStats & { providerId: string }) | null
  loading?: boolean
  dates: string[]
  providers: Provider[]
  statuses: ProviderStatus[]
  onChatterClick: (login: string) => void
}) {
  const latest = dates[0]
  const oldest = dates[dates.length - 1]
  const chatterList = stats?.topChatters ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border bg-card p-6">
      <div className="grid max-w-3xl gap-6 sm:grid-cols-3">
        <Stat
          label="Messages logged"
          value={
            loading
              ? "Loading…"
              : stats
                ? stats.messageCount.toLocaleString()
                : "Unavailable"
          }
        />
        <Stat
          label="Days on record"
          value={dates.length.toLocaleString()}
        />
        <Stat
          label="Coverage"
          value={
            oldest && latest
              ? `${formatDateKey(oldest)} to ${formatDateKey(latest)}`
              : "Unknown"
          }
        />
      </div>

      <div className="mt-8 max-w-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Top chatters</p>
          <ProviderStatusList providers={providers} statuses={statuses} />
        </div>
        {chatterList.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading chatter stats…"
              : "No chatter stats from the enabled endpoints."}
          </p>
        ) : (
          <ol className="divide-y rounded-xl border">
            {chatterList.map((chatter, index) => {
              const login = chatter.userLogin || chatter.userId
              return (
                <li key={chatter.userId}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
                    onClick={() => onChatterClick(login)}
                  >
                    <span className="w-6 text-xs text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {login}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {chatter.messageCount.toLocaleString()}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Click a name to filter that day of logs. Counts come from the
          endpoint with the largest archive.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-medium tracking-tight">{value}</p>
    </div>
  )
}
