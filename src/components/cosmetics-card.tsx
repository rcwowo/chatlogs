import { useMemo, useState } from "react"
import { CopyIcon } from "lucide-react"

import {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { copyText } from "@/lib/clipboard"
import {
  twitchEmoteImageUrl,
  type TwitchCosmetics,
} from "@/lib/twitch-cosmetics"
import { cn } from "@/lib/utils"

export function CosmeticsCard({
  cosmetics,
  loading,
  className,
}: {
  cosmetics: TwitchCosmetics | null
  loading: boolean
  className?: string
}) {
  const emoteCount = useMemo(
    () =>
      (cosmetics?.emoteGroups ?? []).reduce(
        (total, group) => total + group.emotes.length,
        0
      ),
    [cosmetics]
  )
  const badgeCount = cosmetics?.badges.length ?? 0
  const groups = cosmetics?.emoteGroups ?? []
  const ready = !loading && cosmetics !== null
  const hasEmotes = ready && emoteCount > 0
  const hasBadges = ready && badgeCount > 0
  const [tab, setTab] = useState<"emotes" | "badges">("emotes")
  const activeTab = !hasEmotes && hasBadges ? "badges" : tab

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl bg-muted/60",
        className
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setTab(value as "emotes" | "badges")}
        className="min-w-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2.5">
          <TabsList className="rounded-full">
            <TabsIndicator className="rounded-full bg-background dark:bg-input/30" />
            <TabsTrigger
              className="rounded-full px-3.5 data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent"
              value="emotes"
              disabled={!hasEmotes && ready}
            >
              Emotes
            </TabsTrigger>
            <TabsTrigger
              className="rounded-full px-3.5 data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent"
              value="badges"
              disabled={!hasBadges && ready}
            >
              Badges
            </TabsTrigger>
          </TabsList>
          {cosmetics ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {emoteCount.toLocaleString()} emotes ·{" "}
              {badgeCount.toLocaleString()} badges
            </p>
          ) : null}
        </div>

        <TabsContent value="emotes" className="px-3 pt-2 pb-3.5">
          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
              {Array.from({ length: 12 }, (_, index) => (
                <Skeleton key={index} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">
              No first-party emotes for this channel.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((group) => (
                <div key={group.title}>
                  <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.title} · {group.emotes.length}
                  </p>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                    {group.emotes.map((emote) => (
                      <button
                        key={emote.id}
                        type="button"
                        title={`Copy ${emote.code}`}
                        onClick={() => void copyText("Emote code", emote.code)}
                        className="group/tile relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/40 p-2 text-center transition-colors hover:bg-muted/70 focus-visible:bg-muted/70"
                      >
                        <img
                          src={twitchEmoteImageUrl(emote.id)}
                          alt={emote.code}
                          loading="lazy"
                          decoding="async"
                          className="size-9 object-contain"
                        />
                        <span className="w-full truncate text-xs text-muted-foreground transition-colors group-hover/tile:text-foreground">
                          {emote.code}
                        </span>
                        <CopyIcon className="absolute top-1.5 right-1.5 size-3 text-muted-foreground opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-visible:opacity-100" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="badges" className="px-3 pt-2 pb-3.5">
          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : badgeCount === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">
              No first-party badges for this channel.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
              {cosmetics?.badges.map((badge) => (
                <div
                  key={`${badge.title}-${badge.imageUrl}`}
                  title={badge.description || badge.title}
                  className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/40 p-2 text-center"
                >
                  <img
                    src={badge.imageUrl}
                    alt={badge.title}
                    loading="lazy"
                    decoding="async"
                    className="size-8 object-contain"
                  />
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {badge.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
