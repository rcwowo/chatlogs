import { useState } from "react"
import { toast } from "sonner"
import { PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import type { Provider } from "@/lib/providers"

export function ProviderSettings({
  providers,
  onEnabledChange,
  onAdd,
  onRemove,
}: {
  providers: Provider[]
  onEnabledChange: (id: string, enabled: boolean) => void
  onAdd: (name: string, url: string) => void
  onRemove: (id: string) => void
}) {
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")

  const builtins = providers.filter((provider) => provider.builtin)
  const custom = providers.filter((provider) => !provider.builtin)
  const enabledCount = providers.filter((provider) => provider.enabled).length

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    try {
      onAdd(name, url)
      setName("")
      setUrl("")
      toast.success("Endpoint added")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add endpoint")
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {enabledCount} of {providers.length} endpoints will be queried. Custom
        URLs stay in this browser.
      </p>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 pr-3">
          {builtins.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              onEnabledChange={onEnabledChange}
            />
          ))}

          {custom.length > 0 ? (
            <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">
              Added in this browser
            </p>
          ) : null}

          {custom.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              onEnabledChange={onEnabledChange}
              onRemove={onRemove}
            />
          ))}
        </div>
      </ScrollArea>

      <form className="flex flex-col gap-2 border-t pt-4" onSubmit={handleAdd}>
        <p className="text-sm font-medium">Add rustlog endpoint</p>
        <div className="grid gap-2">
          <Label htmlFor="provider-name" className="sr-only">
            Name
          </Label>
          <Input
            id="provider-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            autoComplete="off"
          />
          <Label htmlFor="provider-url" className="sr-only">
            URL
          </Label>
          <Input
            id="provider-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://logs.example.com"
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="sm" className="self-start">
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </form>
    </div>
  )
}

function ProviderRow({
  provider,
  onEnabledChange,
  onRemove,
}: {
  provider: Provider
  onEnabledChange: (id: string, enabled: boolean) => void
  onRemove?: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-muted/60">
      <Switch
        size="sm"
        checked={provider.enabled}
        onCheckedChange={(checked) => onEnabledChange(provider.id, checked)}
        aria-label={`Toggle ${provider.name}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{provider.name}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {provider.url.replace(/^https:\/\//, "")}
        </p>
      </div>
      {onRemove ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={() => onRemove(provider.id)}
          aria-label={`Remove ${provider.name}`}
        >
          <Trash2Icon />
        </Button>
      ) : null}
    </div>
  )
}
