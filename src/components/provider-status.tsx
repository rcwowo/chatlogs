import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Provider } from "@/lib/providers"
import type { ProviderStatus } from "@/lib/rustlog"

export function ProviderStatusList({
  providers,
  statuses,
}: {
  providers: Provider[]
  statuses: ProviderStatus[]
}) {
  if (statuses.length === 0) {
    return null
  }

  const byId = new Map(providers.map((provider) => [provider.id, provider]))
  const ok = statuses.filter((item) => item.status === "ok").length
  const errors = statuses.filter((item) => item.status === "error")

  return (
    <Popover>
      <PopoverTrigger className="text-xs text-muted-foreground hover:text-foreground">
        {ok}/{statuses.length} endpoints
        {errors.length > 0 ? ` · ${errors.length} failed` : ""}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <ul className="flex flex-col gap-1">
          {statuses.map((item) => {
            const provider = byId.get(item.providerId)
            return (
              <li
                key={item.providerId}
                className="flex items-start justify-between gap-2 rounded-md px-1.5 py-1 text-xs"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {provider?.name ?? item.providerId}
                  </span>
                  {item.error ? (
                    <span className="block truncate text-muted-foreground">
                      {item.error}
                    </span>
                  ) : null}
                </span>
                <Badge
                  variant={
                    item.status === "ok"
                      ? "default"
                      : item.status === "missing"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {item.status === "ok"
                    ? "hit"
                    : item.status === "missing"
                      ? "none"
                      : "error"}
                </Badge>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
