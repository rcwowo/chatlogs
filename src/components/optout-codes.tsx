import {
  CheckIcon,
  CopyIcon,
  LoaderCircleIcon,
  RotateCwIcon,
  SquareArrowOutUpRightIcon,
} from "lucide-react"

import { SettingsGroup } from "@/components/settings/settings-primitives"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  copyKey,
  type CodeState,
  type OptoutCodes,
} from "@/hooks/use-optout-codes"
import { OPTOUT_CODE_TTL_MS, type OptoutService } from "@/lib/optout"
import { cn } from "@/lib/utils"

function isLive(state: CodeState | undefined, now: number) {
  return state?.status === "ready" && state.code.expiresAt > now
}

/** Get codes, copy them one at a time, and retry the ones that failed. */
export function CodeActions({
  targets,
  codes,
  showCount,
}: {
  targets: OptoutService[]
  codes: OptoutCodes
  showCount: boolean
}) {
  const { codes: states, copied, now } = codes
  const queue = targets.flatMap((service) => {
    const state = states[service.id]
    if (state?.status !== "ready" || !isLive(state, now)) {
      return []
    }
    return [{ key: copyKey(service, state), command: state.code.command }]
  })
  const next = queue.find((item) => !copied.has(item.key))
  const copiedCount = queue.filter((item) => copied.has(item.key)).length
  const renewable = targets.filter((service) => {
    const state = states[service.id]
    return (
      state?.status === "error" ||
      (state?.status === "ready" && !isLive(state, now))
    )
  })
  const pending = targets.some(
    (service) => states[service.id]?.status === "pending"
  )
  const hasCodes = targets.some((service) => states[service.id])

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={targets.length === 0 || pending}
        variant={hasCodes ? "outline" : "default"}
        onClick={() => {
          codes.resetCopied()
          codes.requestCodes(targets)
        }}
      >
        {pending ? (
          <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
        ) : (
          <RotateCwIcon data-icon="inline-start" />
        )}
        {hasCodes ? "Get new codes" : "Get codes"}
        {showCount && targets.length > 0 ? ` (${targets.length})` : ""}
      </Button>
      {hasCodes ? (
        <Button
          disabled={!next}
          onClick={() => next && void codes.copyCommand(next.key, next.command)}
        >
          {next ? (
            <CopyIcon data-icon="inline-start" />
          ) : (
            <CheckIcon data-icon="inline-start" />
          )}
          {next
            ? `Copy next (${copiedCount + 1}/${queue.length})`
            : queue.length > 0
              ? "All copied"
              : "Nothing to copy"}
        </Button>
      ) : null}
      {renewable.length > 0 && !pending ? (
        <Button variant="outline" onClick={() => codes.requestCodes(renewable)}>
          <RotateCwIcon data-icon="inline-start" />
          Retry {renewable.length}
        </Button>
      ) : null}
    </div>
  )
}

export function OpenChatLink({ chat }: { chat: string }) {
  return (
    <a
      href={`https://www.twitch.tv/popout/${encodeURIComponent(chat)}/chat`}
      target="_blank"
      rel="noreferrer noopener"
      className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      Open #{chat} chat
      <SquareArrowOutUpRightIcon className="size-3" />
    </a>
  )
}

export function ServiceList({
  services,
  codes,
  excluded,
  onIncludedChange,
  notes,
}: {
  services: OptoutService[]
  codes: OptoutCodes
  excluded: Set<string>
  onIncludedChange: (id: string, included: boolean) => void
  notes?: Record<string, string>
}) {
  return (
    <SettingsGroup>
      {services.map((service) => {
        const state = codes.codes[service.id]
        const key = copyKey(service, state)
        return (
          <ServiceRow
            key={service.id}
            service={service}
            note={notes?.[service.id]}
            included={!excluded.has(service.id)}
            state={state}
            now={codes.now}
            copied={codes.copied.has(key)}
            onIncludedChange={(value) => onIncludedChange(service.id, value)}
            onCopy={(command) => void codes.copyCommand(key, command)}
            onRequest={() => codes.requestCodes([service])}
          />
        )
      })}
    </SettingsGroup>
  )
}

function ServiceRow({
  service,
  note,
  included,
  state,
  now,
  copied,
  onIncludedChange,
  onCopy,
  onRequest,
}: {
  service: OptoutService
  note?: string
  included: boolean
  state: CodeState | undefined
  now: number
  copied: boolean
  onIncludedChange: (included: boolean) => void
  onCopy: (command: string) => void
  onRequest: () => void
}) {
  const remainingMs =
    state?.status === "ready"
      ? Math.min(OPTOUT_CODE_TTL_MS, state.code.expiresAt - now)
      : 0
  const expired = state?.status === "ready" && remainingMs <= 0
  const host = service.url.replace(/^https?:\/\//, "")

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-2.5 py-2",
        !included && "opacity-60"
      )}
    >
      <Switch
        size="sm"
        checked={included}
        onCheckedChange={onIncludedChange}
        aria-label={`Include ${service.name}`}
      />
      <div className="min-w-0 flex-1 basis-40">
        <a
          href={service.url}
          target="_blank"
          rel="noreferrer noopener"
          className="group/link flex w-fit max-w-full items-center gap-1 text-sm leading-tight font-medium hover:underline"
        >
          <span className="truncate">{service.name}</span>
          <SquareArrowOutUpRightIcon className="size-3 shrink-0 text-muted-foreground group-hover/link:text-foreground" />
        </a>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {service.name !== host ? (
            <span className="truncate font-mono text-[11px]">{host}</span>
          ) : null}
          <RowStatus
            note={note}
            included={included}
            state={state}
            remainingMs={remainingMs}
            copied={copied}
          />
        </p>
      </div>

      {included && !state ? (
        <Button size="sm" variant="ghost" onClick={onRequest}>
          Get code
        </Button>
      ) : null}

      {included && state?.status === "pending" ? (
        <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
      ) : null}

      {included && (state?.status === "error" || expired) ? (
        <Button size="sm" variant="outline" onClick={onRequest}>
          <RotateCwIcon data-icon="inline-start" />
          {expired ? "Renew" : "Retry"}
        </Button>
      ) : null}

      {included && state?.status === "ready" && !expired ? (
        <button
          type="button"
          onClick={() => onCopy(state.code.command)}
          className={cn(
            "flex h-8 max-w-full min-w-0 items-center gap-2 rounded-lg border bg-background px-2.5 font-mono text-xs transition-colors hover:bg-muted",
            copied && "text-muted-foreground"
          )}
          aria-label={`Copy command for ${service.name}`}
        >
          <span className="truncate">{state.code.command}</span>
          {copied ? (
            <CheckIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <CopyIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
      ) : null}
    </div>
  )
}

function RowStatus({
  note,
  included,
  state,
  remainingMs,
  copied,
}: {
  note?: string
  included: boolean
  state: CodeState | undefined
  remainingMs: number
  copied: boolean
}) {
  const parts: React.ReactNode[] = []
  if (note) {
    parts.push(<span key="note">{note}</span>)
  }
  if (!included) {
    parts.push(<span key="skip">Skipped</span>)
  } else if (state?.status === "pending") {
    parts.push(<span key="pending">Getting a code…</span>)
  } else if (state?.status === "error") {
    parts.push(
      <span key="error" className="text-destructive">
        {state.message}
      </span>
    )
  } else if (state?.status === "ready") {
    if (remainingMs <= 0) {
      parts.push(<span key="expired">Code expired</span>)
    } else {
      const seconds = Math.ceil(remainingMs / 1000)
      parts.push(
        <span
          key="time"
          className={cn(
            "tabular-nums",
            seconds <= 15 && "text-amber-600 dark:text-amber-400"
          )}
        >
          Expires in {seconds}s{copied ? " · Copied" : ""}
        </span>
      )
    }
  }
  return parts.flatMap((part, index) =>
    index > 0 ? [<span key={`dot-${index}`}>·</span>, part] : [part]
  )
}
