import * as React from "react"
import { PaintbrushIcon, ServerIcon, SmileIcon } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppearanceTab } from "@/components/settings/appearance-tab"
import { EmotesTab } from "@/components/settings/emotes-tab"
import { ProvidersTab } from "@/components/settings/providers-tab"

export type SettingsCategory = "appearance" | "emotes" | "providers"

type SettingsCategoryEntry = {
  id: SettingsCategory
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const SETTINGS_CATEGORIES: SettingsCategoryEntry[] = [
  { id: "appearance", label: "Appearance", icon: PaintbrushIcon },
  { id: "emotes", label: "Emotes", icon: SmileIcon },
  { id: "providers", label: "Providers", icon: ServerIcon },
]

const SETTINGS_TAB_PANELS: Record<SettingsCategory, React.ComponentType> = {
  appearance: AppearanceTab,
  emotes: EmotesTab,
  providers: ProvidersTab,
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [activeCategory, setActiveCategory] =
    React.useState<SettingsCategory>("appearance")
  const [wasOpen, setWasOpen] = React.useState(open)

  // Always land on a real tab and reset to the first one when reopened.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setActiveCategory("appearance")
    }
  }

  const ActivePanel = SETTINGS_TAB_PANELS[activeCategory]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="shrink-0 flex-row items-center border-b border-border px-4 py-3 pr-12">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeCategory}
          onValueChange={(value) =>
            setActiveCategory(value as SettingsCategory)
          }
          className="min-h-0 flex-1 gap-0"
        >
          <div className="flex shrink-0 overflow-x-auto border-b border-border px-3 py-2">
            <TabsList className="h-9 w-full min-w-fit">
              {SETTINGS_CATEGORIES.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="gap-1.5 px-3"
                >
                  <category.icon />
                  {category.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent
            value={activeCategory}
            className="min-h-0 flex-1 overflow-y-auto p-4"
          >
            <ActivePanel />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
