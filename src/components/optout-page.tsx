import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowLeftIcon, LoaderCircleIcon, PlusIcon } from "lucide-react"

import {
  CodeActions,
  OpenChatLink,
  ServiceList,
} from "@/components/optout-codes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useOptoutCodes, type OptoutCodes } from "@/hooks/use-optout-codes"
import { useProviders } from "@/hooks/use-providers"
import { formatDateKey } from "@/lib/dates"
import {
  checkChatLogs,
  getOptoutServices,
  OPTOUT_CODE_TTL_MS,
  parseEndpointList,
  providerNameFromUrl,
  type LogCheck,
  type OptoutService,
} from "@/lib/optout"
import { navigateBack, OPTOUT_PATH } from "@/lib/routes"

type Group = {
  key: string
  title: string
  description?: string
  /** Whether this group's commands work when sent in the streamer's chat. */
  sendable: boolean
  loading?: boolean
  services: OptoutService[]
}

const LOGIN_PATTERN = /^[a-z0-9_]{1,25}$/
const CODE_SECONDS = Math.round(OPTOUT_CODE_TTL_MS / 1000)

function validLogin(input: string) {
  const login = input.trim().replace(/^[#@]/, "").toLowerCase()
  return LOGIN_PATTERN.test(login) ? login : ""
}

function writeChannelParam(channel: string) {
  window.history.replaceState(
    window.history.state,
    "",
    channel
      ? `${OPTOUT_PATH}?channel=${encodeURIComponent(channel)}`
      : OPTOUT_PATH
  )
}

export function OptoutPage() {
  const { providers, addMany } = useProviders()
  const services = useMemo(() => getOptoutServices(providers), [providers])
  const [initialChannel] = useState(() =>
    validLogin(new URLSearchParams(window.location.search).get("channel") ?? "")
  )
  const [draft, setDraft] = useState(initialChannel)
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set())
  const [checks, setChecks] = useState<Record<string, LogCheck>>({})
  const codes = useOptoutCodes()

  const typed = validLogin(draft)
  const settled = useDebouncedValue(typed, 400)
  const channel = settled === typed ? typed : ""

  useEffect(() => {
    const title = document.title
    document.title = "Opt out · Chatlogs"
    return () => {
      document.title = title
    }
  }, [])

  useEffect(() => {
    writeChannelParam(settled)
    if (!settled) {
      return
    }
    for (const service of services) {
      const key = `${service.url}|${settled}`
      void checkChatLogs(service.url, settled).then((check) =>
        setChecks((current) =>
          current[key] === check ? current : { ...current, [key]: check }
        )
      )
    }
  }, [settled, services])

  const { groups, notes } = buildGroups(services, channel, checks)
  const targets = groups
    .filter((group) => group.sendable)
    .flatMap((group) => group.services)
    .filter((service) => !excluded.has(service.id))

  function setIncluded(id: string, included: boolean) {
    setExcluded((current) => {
      const next = new Set(current)
      if (included) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:py-10">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground"
            onClick={() => navigateBack("/")}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Back to logs
          </Button>
        </div>

        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Opt out your channel
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Stop known log services from logging your chat. Each one removes or
            hides the logs it already has of your channel.
          </p>
          <Instructions />
        </header>

        <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
              #
            </span>
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="your channel"
              aria-label="Your channel"
              autoComplete="off"
              spellCheck={false}
              className="pl-6"
            />
          </div>

          <CodeActions
            targets={targets}
            codes={codes}
            showCount={Boolean(channel)}
          />

          {groups.map((group) => (
            <GroupView
              key={group.key}
              group={group}
              channel={group.sendable ? channel : ""}
              codes={codes}
              excluded={excluded}
              notes={notes}
              onIncludedChange={setIncluded}
            />
          ))}

          <BulkAdd onAdd={addMany} />
        </section>
      </main>
    </div>
  )
}

function buildGroups(
  services: OptoutService[],
  channel: string,
  checks: Record<string, LogCheck>
): { groups: Group[]; notes: Record<string, string> } {
  if (!channel) {
    return {
      groups: [
        {
          key: "all",
          title: "Known services",
          description: "Enter your channel to see which of these log it.",
          sendable: false,
          services,
        },
      ],
      notes: {},
    }
  }

  const notes: Record<string, string> = {}
  const here: OptoutService[] = []
  const away: OptoutService[] = []
  const done: OptoutService[] = []
  const pending: OptoutService[] = []
  const unreachable: OptoutService[] = []
  for (const service of services) {
    const check = checks[`${service.url}|${channel}`]
    if (!check) {
      pending.push(service)
    } else if (check.status === "found") {
      here.push(service)
    } else if (check.status === "opted-out") {
      done.push(service)
    } else if (check.status === "unreachable") {
      unreachable.push(service)
    } else {
      if (check.status === "stale") {
        notes[service.id] =
          `Last logged your chat ${formatDateKey(check.lastLogged)}`
      }
      away.push(service)
    }
  }

  const groups: Group[] = [
    {
      key: "here",
      title: `Send in your chat, #${channel}`,
      description:
        here.length === 0 && pending.length === 0
          ? "None of the known services log your chat right now."
          : undefined,
      sendable: true,
      services: here,
    },
  ]
  if (pending.length > 0) {
    groups.push({
      key: "pending",
      title: "Checking…",
      loading: true,
      sendable: false,
      services: pending,
    })
  }
  if (done.length > 0) {
    groups.push({
      key: "done",
      title: "Already opted out",
      description: "Your channel is already opted out on these.",
      sendable: false,
      services: done,
    })
  }
  if (away.length > 0) {
    groups.push({
      key: "away",
      title: "Not logging your chat",
      description:
        "These have no recent logs of your chat, so they won't see a command sent there.",
      sendable: false,
      services: away,
    })
  }
  if (unreachable.length > 0) {
    groups.push({
      key: "unreachable",
      title: "Couldn't reach",
      description:
        "These may be offline right now. You can still try getting a code.",
      sendable: false,
      services: unreachable,
    })
  }
  return { groups, notes }
}

function Instructions() {
  const steps = [
    "Log in to Twitch as your channel's account.",
    "Enter your channel and get codes for the services that log it.",
    "Send each command in your chat as its own message.",
  ]
  return (
    <ol className="grid gap-1.5 pt-1 text-sm text-muted-foreground">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-2.5">
          <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">
            {index + 1}
          </span>
          <span className="leading-relaxed">{step}</span>
        </li>
      ))}
      <li className="pl-7.5 text-xs">
        Codes stop working after {CODE_SECONDS} seconds. Renew any that run out.
      </li>
    </ol>
  )
}

function GroupView({
  group,
  channel,
  codes,
  excluded,
  notes,
  onIncludedChange,
}: {
  group: Group
  channel: string
  codes: OptoutCodes
  excluded: Set<string>
  notes: Record<string, string>
  onIncludedChange: (id: string, included: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            {group.loading ? (
              <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />
            ) : null}
            {group.title}
          </h2>
          {group.description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {group.description}
            </p>
          ) : null}
        </div>
        {channel && group.services.length > 0 ? (
          <OpenChatLink chat={channel} />
        ) : null}
      </div>
      {group.services.length > 0 ? (
        <ServiceList
          services={group.services}
          codes={codes}
          excluded={excluded}
          notes={notes}
          onIncludedChange={onIncludedChange}
        />
      ) : null}
    </div>
  )
}

function BulkAdd({
  onAdd,
}: {
  onAdd: (entries: Array<{ name: string; url: string }>) => {
    added: number
    existing: number
  }
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="self-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <PlusIcon data-icon="inline-start" />
        Missing a service? Add more
      </Button>
    )
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const { urls, invalid } = parseEndpointList(draft)
    if (urls.length === 0) {
      toast.error(
        invalid.length > 0
          ? "None of those look like URLs."
          : "Paste at least one URL."
      )
      return
    }

    let result: { added: number; existing: number }
    try {
      result = onAdd(
        urls.map((url) => ({ name: providerNameFromUrl(url), url }))
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add services."
      )
      return
    }

    const count = (value: number, one: string, many: string) =>
      `${value} ${value === 1 ? one : many}`
    const notes = [
      result.existing > 0
        ? `${result.existing} ${result.existing === 1 ? "was" : "were"} already added`
        : "",
      invalid.length > 0
        ? `${count(invalid.length, "invalid entry was", "invalid entries were")} left in the box`
        : "",
    ].filter(Boolean)
    const summary =
      result.added > 0
        ? `Added ${count(result.added, "service", "services")}`
        : "No new services added"
    const description = notes.join(", ") || undefined
    if (result.added > 0) {
      toast.success(summary, { description })
    } else {
      toast.info(summary, { description })
    }

    setDraft(invalid.join("\n"))
    if (invalid.length === 0) {
      setOpen(false)
    }
  }

  return (
    <form className="grid gap-2 border-t pt-4" onSubmit={handleSubmit}>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={"https://logs.example.com\nlogs.example.org"}
        aria-label="Service URLs"
        rows={4}
        autoFocus
        spellCheck={false}
        className="w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <p className="text-xs text-muted-foreground">
        Paste rustlog or justlog URLs, one per line or separated by commas.
        They're saved to this browser and used for browsing logs too.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          <PlusIcon data-icon="inline-start" />
          Add services
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft("")
            setOpen(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
