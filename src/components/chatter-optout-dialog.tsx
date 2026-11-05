import { useEffect, useMemo, useRef, useState } from "react"
import { LoaderCircleIcon } from "lucide-react"

import {
  CodeActions,
  OpenChatLink,
  ServiceList,
} from "@/components/optout-codes"
import { SettingsCallout } from "@/components/settings/settings-primitives"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useOptoutCodes } from "@/hooks/use-optout-codes"
import { useProviders } from "@/hooks/use-providers"
import {
  checkChatLogs,
  getOptoutServices,
  OPTOUT_CODE_TTL_MS,
  type LogCheck,
} from "@/lib/optout"

export function ChatterOptoutDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="shrink-0 border-b border-border pr-12">
          <DialogTitle>Opt out as a chatter</DialogTitle>
          <DialogDescription>
            Send these in #{channel} while logged in as the account you want
            removed. Each service stops logging you and removes or hides your
            logs.
          </DialogDescription>
        </DialogHeader>
        {open && channel ? (
          <ChatterOptout key={channel} channel={channel} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ChatterOptout({ channel }: { channel: string }) {
  const { providers } = useProviders()
  const services = useMemo(() => getOptoutServices(providers), [providers])
  const [checks, setChecks] = useState<Record<string, LogCheck>>({})
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set())
  const codes = useOptoutCodes()
  const { requestCodes } = codes
  const requested = useRef(new Set<string>())

  useEffect(() => {
    let active = true
    for (const service of services) {
      void checkChatLogs(service.url, channel).then((check) => {
        if (!active) {
          return
        }
        setChecks((current) =>
          current[service.url] === check
            ? current
            : { ...current, [service.url]: check }
        )
        if (check.status === "found" && !requested.current.has(service.id)) {
          requested.current.add(service.id)
          requestCodes([service])
        }
      })
    }
    return () => {
      active = false
    }
  }, [services, channel, requestCodes])

  const logging = services.filter(
    (service) => checks[service.url]?.status === "found"
  )
  const checking = services.some((service) => !checks[service.url])
  const others = services.length - logging.length
  const targets = logging.filter((service) => !excluded.has(service.id))

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CodeActions targets={targets} codes={codes} showCount={false} />
        <OpenChatLink chat={channel} />
      </div>

      {logging.length > 0 ? (
        <ServiceList
          services={logging}
          codes={codes}
          excluded={excluded}
          onIncludedChange={(id, included) =>
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
        />
      ) : null}

      {checking ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircleIcon className="size-3.5 animate-spin" />
          Checking which services log #{channel}…
        </p>
      ) : logging.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None of the known services log #{channel} right now.
        </p>
      ) : null}

      <SettingsCallout>
        Send each command as its own message within{" "}
        {Math.round(OPTOUT_CODE_TTL_MS / 1000)} seconds. These only reach
        services that log #{channel}
        {checking
          ? ""
          : `, so the other ${others} known ${others === 1 ? "service" : "services"} may still have your messages from other chats`}
        . Please only send them in a chat you already talk in.
      </SettingsCallout>
    </div>
  )
}
