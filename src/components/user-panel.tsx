import type { ReactNode } from "react"
import { CopyIcon, EllipsisIcon } from "lucide-react"
import type { ChannelStats, ProviderStatus } from "@/lib/rustlog"
import { formatDateKey } from "@/lib/dates"
import type { Provider } from "@/lib/providers"
import { ProviderStatusList } from "@/components/provider-status"
import { ChannelAvatar } from "@/components/channel-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { CosmeticsCard } from "@/components/cosmetics-card"
import { copyText } from "@/lib/clipboard"
import type { TwitchCosmetics } from "@/lib/twitch-cosmetics"
import type { TwitchUser } from "@/lib/twitch-user"
import { cn } from "@/lib/utils"

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
})

function formatDate(value: string | null) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return dateFormatter.format(date)
}

type CopyStatVariant = "tile" | "row"

function CopyStat({
  label,
  value,
  copy,
  variant = "row",
  loading = false,
  className,
}: {
  label: string
  value: ReactNode
  copy?: string | null
  variant?: CopyStatVariant
  loading?: boolean
  className?: string
}) {
  if (loading) {
    return (
      <div className={cn("min-w-0 px-4 py-3", className)}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <Skeleton className="mt-2 h-5 w-24" />
      </div>
    )
  }

  if (!copy) {
    return (
      <div className={cn("min-w-0 px-4 py-3", className)}>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <div
          className={cn(
            "truncate font-medium",
            variant === "tile"
              ? "text-lg tracking-tight tabular-nums"
              : "text-sm"
          )}
        >
          {value}
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void copyText(label, copy)}
      aria-label={`${label}: ${typeof value === "string" ? value : copy}`}
      className={cn(
        "group/copy relative min-w-0 cursor-pointer px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted",
        className
      )}
    >
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <div
        className={cn(
          "truncate font-medium",
          variant === "tile"
            ? "text-lg tracking-tight tabular-nums"
            : "text-sm"
        )}
      >
        {value}
      </div>
      <CopyIcon className="absolute top-2.5 right-2.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/copy:opacity-100 group-focus-visible/copy:opacity-100" />
      <span className="sr-only">Copy {label.toLowerCase()}</span>
    </button>
  )
}

export function UserPanel({
  login,
  profile,
  dates,
  stats,
  statsLoading,
  providers,
  statuses,
  cosmetics,
  cosmeticsLoading,
  onChatterClick,
}: {
  login: string
  profile: TwitchUser | null
  dates: string[]
  stats: (ChannelStats & { providerId: string }) | null
  statsLoading: boolean
  providers: Provider[]
  statuses: ProviderStatus[]
  cosmetics: TwitchCosmetics | null
  cosmeticsLoading: boolean
  onChatterClick: (login: string) => void
}) {
  const name = profile?.displayName || login

  if (!profile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card p-6">
        <p className="text-sm font-medium">{login}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Could not load Twitch profile info for this channel.
        </p>
        <div className="mt-8 max-w-xl">
          <TopChatters
            stats={stats}
            providers={providers}
            statuses={statuses}
            onChatterClick={onChatterClick}
          />
        </div>
      </div>
    )
  }

  const role = profile.roles.isPartner
    ? "Partner"
    : profile.roles.isAffiliate
      ? "Affiliate"
      : "User"
  const rules = profile.chatSettings?.rules ?? []
  const latest = dates[0]
  const oldest = dates[dates.length - 1]
  const messageCount = stats?.messageCount
  const lastBroadcast = profile.lastBroadcast
  const hasBroadcast = Boolean(lastBroadcast?.title || lastBroadcast?.startedAt)
  const hasChatters = (stats?.topChatters.length ?? 0) > 0

  const cosmeticsEmpty =
    !cosmeticsLoading &&
    (cosmetics?.emoteGroups?.length ?? 0) === 0 &&
    (cosmetics?.badges.length ?? 0) === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border bg-card">
      <div className="relative h-40 shrink-0 overflow-hidden rounded-t-xl bg-muted sm:h-44">
        {profile.banner ? (
          <img
            src={profile.banner}
            alt=""
            className="pointer-events-none size-full object-cover"
          />
        ) : (
          <div className="size-full bg-linear-to-br from-muted via-primary/25 to-card" />
        )}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end gap-3 px-4 pb-4 sm:px-6 sm:pb-5">
          <ChannelAvatar
            name={name}
            src={profile.logo}
            size="lg"
            className="size-14 border-2 border-card shadow-md sm:size-16"
          />
          <h2 className="min-w-0 truncate text-2xl leading-tight font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)] sm:text-3xl">
            {name}
          </h2>
          <ActionsMenu
            className="absolute top-1/2 right-4 -translate-y-1/2 sm:right-6"
            login={profile.login}
            userId={profile.id}
            logo={profile.logo}
            banner={profile.banner}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {profile.bio ? (
          <button
            type="button"
            onClick={() => void copyText(`About ${name}`, profile.bio)}
            aria-label={`About ${name}: ${profile.bio}`}
            className="group/bio group relative block w-full cursor-pointer overflow-hidden rounded-xl bg-muted/60 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted"
          >
            <p className="text-xs text-muted-foreground">About {name}</p>
            <p className="mt-1 text-sm font-medium whitespace-pre-wrap">
              {profile.bio}
            </p>
            <CopyIcon className="absolute top-2.5 right-2.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/bio:opacity-100 group-focus-visible:opacity-100" />
            <span className="sr-only">Copy About {name}</span>
          </button>
        ) : null}

        <div className="grid grid-cols-1 divide-y divide-border/60 overflow-hidden rounded-xl bg-muted/60 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
          <CopyStat
            variant="tile"
            label="Followers"
            value={
              profile.followers !== null
                ? profile.followers.toLocaleString()
                : "Unknown"
            }
            copy={
              profile.followers !== null ? profile.followers.toString() : null
            }
          />
          <CopyStat
            variant="tile"
            label="Logged messages"
            value={
              messageCount !== undefined || stats
                ? (messageCount ?? 0).toLocaleString()
                : "Unavailable"
            }
            copy={messageCount !== undefined ? messageCount.toString() : null}
            loading={statsLoading && !stats}
          />
          <CopyStat
            variant="tile"
            label="Days logged"
            value={dates.length.toLocaleString()}
            copy={dates.length.toString()}
          />
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          {hasChatters || statsLoading ? (
            <TopChatters
              stats={stats}
              providers={providers}
              statuses={statuses}
              onChatterClick={onChatterClick}
            />
          ) : null}
          <div
            className={cn(
              "flex flex-col overflow-hidden rounded-xl bg-muted/60",
              !hasChatters && !statsLoading ? "lg:col-span-2" : null
            )}
          >
            <p className="px-4 pt-3 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Details
            </p>
            <div className="grid grid-cols-1 divide-y divide-border/60 border-b border-border/60 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
              <CopyStat
                label="User type"
                value={
                  <>
                    {role}
                    {profile.banned ? " · banned" : ""}
                  </>
                }
                copy={role}
              />
              {profile.createdAt ? (
                <CopyStat
                  label="Created"
                  value={formatDate(profile.createdAt) ?? "Unknown"}
                  copy={profile.createdAt}
                />
              ) : null}
              {latest ? (
                <CopyStat
                  label="Last updated"
                  value={formatDateKey(latest)}
                  copy={latest}
                />
              ) : null}
            </div>
            {hasBroadcast ? (
              <CopyStat
                label={
                  lastBroadcast?.startedAt
                    ? `Last streamed on ${formatDate(lastBroadcast.startedAt)}`
                    : "Last streamed"
                }
                value={lastBroadcast?.title || "Unknown"}
                copy={lastBroadcast?.title ?? lastBroadcast?.startedAt ?? null}
                className="w-full border-b border-border/60"
              />
            ) : null}
            <CopyStat
              label="Coverage"
              value={
                oldest ? `${formatDateKey(oldest)} to ${formatDateKey(latest)}` : "Unknown"
              }
              copy={oldest ? `${formatDateKey(oldest)} to ${formatDateKey(latest)}` : null}
              className={cn("w-full", rules.length > 0 && "border-b border-border/60")}
            />
            {rules.length > 0 ? (
              <button
                type="button"
                onClick={() => void copyText("Chat rules", rules.join("\n"))}
                aria-label={`Chat rules: ${rules.join(" ")}`}
                className="group/rules relative cursor-pointer px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted"
              >
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Chat rules
                </p>
                <ul className="list-disc space-y-0.5 pl-4 text-sm">
                  {rules.map((rule) => (
                    <li key={rule}>{rule.replace(/^-+\s*/, "")}</li>
                  ))}
                </ul>
                <CopyIcon className="absolute top-2.5 right-2.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/rules:opacity-100 group-focus-visible/rules:opacity-100" />
                <span className="sr-only">Copy chat rules</span>
              </button>
            ) : null}
          </div>
        </div>

        {cosmeticsEmpty ? null : (
          <CosmeticsCard
            cosmetics={cosmetics}
            loading={cosmeticsLoading}
          />
        )}
      </div>
    </div>
  )
}

function ActionsMenu({
  login,
  userId,
  logo,
  banner,
  className,
}: {
  login: string
  userId: string
  logo: string
  banner: string | null
  className?: string
}) {
  return (
    <div className={cn("ml-auto", className)}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full bg-card/25 text-white/85 backdrop-blur-sm hover:bg-card/40 hover:text-white"
              aria-label="Profile actions"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Metadata</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => void copyText("Username", login)}>
              Copy username
              <CopyIcon className="ml-auto size-3.5 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void copyText("User ID", userId)}>
              Copy user&apos;s ID
              <CopyIcon className="ml-auto size-3.5 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!logo}
              onClick={() => void copyText("Profile picture URL", logo)}
            >
              Copy profile picture URL
              <CopyIcon className="ml-auto size-3.5 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!banner}
              onClick={() => void copyText("Banner URL", banner)}
            >
              Copy banner URL
              <CopyIcon className="ml-auto size-3.5 text-muted-foreground" />
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function TopChatters({
  stats,
  providers,
  statuses,
  onChatterClick,
}: {
  stats: (ChannelStats & { providerId: string }) | null
  providers: Provider[]
  statuses: ProviderStatus[]
  onChatterClick: (login: string) => void
}) {
  const chatters = stats?.topChatters ?? []
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-muted/60">
      <div className="mb-1 flex items-center justify-between gap-2 px-4 pt-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Top chatters
        </p>
        <ProviderStatusList providers={providers} statuses={statuses} />
      </div>
      {chatters.length === 0 ? (
        <div className="px-4 pb-4">
          <p className="text-sm text-muted-foreground">
            Loading chatter stats…
          </p>
        </div>
      ) : (
        <ol className="m-2 mt-1 divide-y overflow-hidden rounded-lg border border-border/60">
          {chatters.slice(0, 12).map((chatter, index) => {
            const chatterLogin = chatter.userLogin || chatter.userId
            return (
              <li key={chatter.userId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/70"
                  onClick={() => onChatterClick(chatterLogin)}
                >
                  <span className="w-5 text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {chatterLogin}
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
    </div>
  )
}
