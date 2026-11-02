import { useEffect, useState, type ComponentType } from "react"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleMinusIcon,
  FastForwardIcon,
  LoaderCircleIcon,
  SkipForwardIcon,
  TimerOffIcon,
  UserRoundIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import type { LoadProgress, ProviderProgress } from "@/lib/load-progress"
import { PROVIDER_SLOW_MS } from "@/lib/provider-health"
import type { Provider } from "@/lib/providers"
import { REQUEST_TIMEOUT_MS, type ProviderStatus } from "@/lib/rustlog"
import { cn } from "@/lib/utils"

type CountUnit = "day" | "message"

type Row = {
  id: string
  name: string
  progress: ProviderProgress | { status: "pending" }
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) {
      return
    }
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [active])
  return now
}

function formatSeconds(ms: number) {
  const seconds = ms / 1000
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

function plural(count: number, unit: CountUnit) {
  return `${count.toLocaleString()} ${unit}${count === 1 ? "" : "s"}`
}

function providerName(providers: Provider[], id: string) {
  return providers.find((provider) => provider.id === id)?.name ?? id
}

/**
 * Live view of a multi-provider request: which providers have answered, what
 * they returned, and which are still being waited on.
 */
export function LoadProgressView({
  icon,
  title,
  providers,
  progress,
  fallbackIds,
  unit,
  skippedIds = [],
  onContinue,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  /** Every known provider, used to look up display names. */
  providers: Provider[]
  progress: LoadProgress | null
  /** Provider ids to list as pending before the request starts. */
  fallbackIds: string[]
  unit: CountUnit
  /** Enabled providers left out because they don't list this day. */
  skippedIds?: string[]
  /** Stop waiting on slow providers and use what has loaded so far. */
  onContinue?: () => void
}) {
  const now = useNow(true)
  const ids = progress?.providerIds ?? fallbackIds
  const startedAt = progress?.startedAt ?? now
  const elapsed = Math.max(0, now - startedAt)

  const rows: Row[] = ids.map((id) => ({
    id,
    name: providerName(providers, id),
    progress: progress?.providers[id] ?? { status: "pending" },
  }))
  const answered = rows.filter((row) => row.progress.status !== "pending")
  const found = answered.filter(
    (row) => row.progress.status === "ok" && row.progress.count > 0
  ).length

  const waiting =
    rows.length - answered.length + (progress?.profile === "pending" ? 1 : 0)
  const canContinue =
    Boolean(onContinue) && !progress?.merging && found > 0 && waiting > 0

  let heading = title
  let description: string
  if (progress?.merging) {
    heading = `Merging ${plural(progress.merging.total, "message")}`
    description = "All providers answered. Putting the logs in order…"
  } else if (answered.length === rows.length && rows.length > 0) {
    description = "Finishing up…"
  } else {
    const waitingOn = rows.length - answered.length
    description =
      answered.length === 0
        ? `Asking ${rows.length} ${rows.length === 1 ? "provider" : "providers"}…`
        : `${answered.length} of ${rows.length} providers responded, waiting on ${waitingOn}`
  }

  return (
    <EmptyState
      icon={progress?.merging ? icon : LoaderCircleIcon}
      spinning={!progress?.merging}
      title={heading}
      description={description}
    >
      <ProviderList
        rows={rows}
        unit={unit}
        elapsed={elapsed}
        extra={
          progress?.profile ? (
            <ListRow
              icon={
                progress.profile === "pending"
                  ? LoaderCircleIcon
                  : UserRoundIcon
              }
              iconClassName={cn(
                "text-muted-foreground",
                progress.profile === "pending" && "animate-spin"
              )}
              name="Twitch profile"
              detail={progress.profile === "pending" ? "Looking up…" : "Found"}
              muted={progress.profile === "done"}
            />
          ) : null
        }
        skipped={skippedIds.map((id) => providerName(providers, id))}
      />
      {canContinue ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1 animate-in rounded-full fade-in"
          onClick={onContinue}
        >
          <FastForwardIcon />
          Continue with {found} of {rows.length}{" "}
          {rows.length === 1 ? "provider" : "providers"}
        </Button>
      ) : null}
    </EmptyState>
  )
}

/** Final per-provider results, shown alongside load errors. */
export function ProviderResultsList({
  providers,
  statuses,
  unit,
}: {
  providers: Provider[]
  statuses: ProviderStatus[]
  unit: CountUnit
}) {
  if (statuses.length === 0) {
    return null
  }
  return (
    <ProviderList
      unit={unit}
      elapsed={0}
      rows={statuses.map(({ providerId, ...status }) => ({
        id: providerId,
        name: providerName(providers, providerId),
        progress: { ...status, count: 0, elapsedMs: -1 },
      }))}
    />
  )
}

function ProviderList({
  rows,
  unit,
  elapsed,
  extra,
  skipped = [],
}: {
  rows: Row[]
  unit: CountUnit
  elapsed: number
  extra?: React.ReactNode
  skipped?: string[]
}) {
  return (
    <ul className="mt-2 flex w-full max-w-sm flex-col overflow-hidden rounded-lg border bg-background/60 text-left text-sm">
      {rows.map((row) => (
        <ProviderRow key={row.id} row={row} unit={unit} elapsed={elapsed} />
      ))}
      {extra}
      {skipped.length > 0 ? (
        <li className="border-t px-3 py-2 text-xs text-muted-foreground">
          Not asked: {skipped.join(", ")} — no logs listed for this day.
        </li>
      ) : null}
    </ul>
  )
}

function ProviderRow({
  row,
  unit,
  elapsed,
}: {
  row: Row
  unit: CountUnit
  elapsed: number
}) {
  const { progress } = row

  if (progress.status === "pending") {
    const slow = elapsed >= PROVIDER_SLOW_MS
    return (
      <ListRow
        icon={LoaderCircleIcon}
        iconClassName="animate-spin text-muted-foreground"
        name={row.name}
        detail={
          <span className={cn(slow && "text-amber-600 dark:text-amber-400")}>
            {slow ? "Slow to respond" : "Waiting"} — {formatSeconds(elapsed)}
          </span>
        }
        progress={Math.min(1, elapsed / REQUEST_TIMEOUT_MS)}
        progressClassName={slow ? "bg-amber-500/70" : "bg-purple-500/60"}
      />
    )
  }

  const time =
    progress.elapsedMs >= 0 ? ` — ${formatSeconds(progress.elapsedMs)}` : ""

  if (progress.status === "ok" && progress.count > 0) {
    return (
      <ListRow
        icon={CircleCheckIcon}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        name={row.name}
        detail={`${plural(progress.count, unit)}${time}`}
      />
    )
  }

  if (progress.status === "ok" || progress.status === "missing") {
    return (
      <ListRow
        icon={CircleMinusIcon}
        iconClassName="text-muted-foreground"
        name={row.name}
        detail={`No logs${time}`}
        muted
      />
    )
  }

  if (progress.skipped) {
    return (
      <ListRow
        icon={SkipForwardIcon}
        iconClassName="text-muted-foreground"
        name={row.name}
        detail="Skipped"
        muted
      />
    )
  }

  if (progress.timedOut) {
    return (
      <ListRow
        icon={TimerOffIcon}
        iconClassName="text-amber-600 dark:text-amber-400"
        name={row.name}
        detail={`Timed out${time}`}
      />
    )
  }

  return (
    <ListRow
      icon={CircleAlertIcon}
      iconClassName="text-destructive"
      name={row.name}
      detail={`Failed${time}`}
      note={progress.error}
    />
  )
}

function ListRow({
  icon: Icon,
  iconClassName,
  name,
  detail,
  note,
  muted = false,
  progress,
  progressClassName,
}: {
  icon: ComponentType<{ className?: string }>
  iconClassName?: string
  name: string
  detail: React.ReactNode
  note?: string
  muted?: boolean
  progress?: number
  progressClassName?: string
}) {
  return (
    <li className="relative border-b px-3 py-2 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <Icon className={cn("size-4 shrink-0", iconClassName)} />
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-medium",
            muted && "text-muted-foreground"
          )}
        >
          {name}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {detail}
        </span>
      </div>
      {note ? (
        <p
          className="mt-0.5 truncate pl-6.5 text-xs text-muted-foreground"
          title={note}
        >
          {note}
        </p>
      ) : null}
      {progress !== undefined ? (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-0 left-0 h-0.5 transition-[width] duration-300 ease-linear",
            progressClassName
          )}
          style={{ width: `${progress * 100}%` }}
        />
      ) : null}
    </li>
  )
}
