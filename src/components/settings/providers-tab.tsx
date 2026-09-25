import { useState } from "react"
import { toast } from "sonner"
import { PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  addCustomProviderToSettings,
  removeCustomProviderFromSettings,
  setProviderEnabledInSettings,
} from "@/lib/settings/config"
import { getProvidersFromSettings, type Provider } from "@/lib/providers"
import { useSettings } from "@/hooks/use-settings"
import {
  SettingsCallout,
  SettingsGroup,
  SettingsPanel,
  SettingsSection,
} from "@/components/settings/settings-primitives"
import { Switch } from "@/components/ui/switch"

export function ProvidersTab() {
  const { settings, updateSettings } = useSettings()
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")

  const providers = getProvidersFromSettings(settings)
  const builtins = providers.filter((provider) => provider.builtin)
  const custom = providers.filter((provider) => !provider.builtin)

  function handleEnabledChange(id: string, enabled: boolean) {
    updateSettings((current) =>
      setProviderEnabledInSettings(current, id, enabled)
    )
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    try {
      updateSettings((current) => {
        const result = addCustomProviderToSettings(current, name, url)
        return result.settings
      })
      setName("")
      setUrl("")
      toast.success("Endpoint added")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add endpoint"
      )
    }
  }

  function handleRemove(id: string) {
    updateSettings((current) => removeCustomProviderFromSettings(current, id))
  }

  return (
    <SettingsPanel>
      <SettingsSection
        title="Built-in endpoints"
        description="Public rustlog services compiled into the app."
      >
        <SettingsGroup>
          {builtins.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              onEnabledChange={handleEnabledChange}
            />
          ))}
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        title="Added in this browser"
        description="Custom rustlog endpoints stored locally."
      >
        {custom.length > 0 ? (
          <SettingsGroup>
            {custom.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                onEnabledChange={handleEnabledChange}
                onRemove={handleRemove}
              />
            ))}
          </SettingsGroup>
        ) : (
          <SettingsCallout>
            No custom endpoints yet. Add one below to query logs from your own
            rustlog instance.
          </SettingsCallout>
        )}
      </SettingsSection>

      <SettingsSection
        title="Add an endpoint"
        description={
          <>
            Add a link to a publicly accessible rustlog instance, or{" "}
            <a
              href="https://github.com/boring-nick/rustlog"
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              host your own
            </a>
            .
          </>
        }
      >
        <SettingsGroup className="p-2.5">
          <form className="grid gap-2" onSubmit={handleAdd}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name"
              aria-label="Endpoint name"
              autoComplete="off"
            />
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://logs.example.com"
              aria-label="Endpoint URL"
              autoComplete="off"
              inputMode="url"
            />
            <Button type="submit" size="sm" className="self-start">
              <PlusIcon data-icon="inline-start" />
              Add
            </Button>
          </form>
        </SettingsGroup>
      </SettingsSection>
    </SettingsPanel>
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
    <div className="flex items-center gap-2 px-2.5 py-2">
      <Switch
        size="sm"
        checked={provider.enabled}
        onCheckedChange={(checked) => onEnabledChange(provider.id, checked)}
        aria-label={`Toggle ${provider.name}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-tight font-medium">
          {provider.name}
        </p>
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
          title={`Remove ${provider.name}`}
        >
          <Trash2Icon />
        </Button>
      ) : null}
    </div>
  )
}
