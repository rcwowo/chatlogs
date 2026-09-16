import { ChannelAvatar } from "@/components/channel-avatar"
import { Badge } from "@/components/ui/badge"
import type { TwitchUser } from "@/lib/twitch-user"

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function UserPanel({
  login,
  profile,
}: {
  login: string
  profile: TwitchUser | null
}) {
  const name = profile?.displayName || login

  if (!profile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card p-6">
        <p className="text-sm font-medium">{login}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Could not load Twitch profile info for this channel.
        </p>
      </div>
    )
  }

  const role = profile.roles.isPartner
    ? "Partner"
    : profile.roles.isAffiliate
      ? "Affiliate"
      : "User"
  const rules = profile.chatSettings?.rules ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border bg-card">
      {profile.banner ? (
        <div className="h-28 overflow-hidden rounded-t-xl bg-muted">
          <img
            src={profile.banner}
            alt=""
            className="size-full object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <ChannelAvatar name={name} src={profile.logo} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">{name}</h2>
              <Badge variant="secondary">{role}</Badge>
              {profile.banned ? (
                <Badge variant="destructive">Banned</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {profile.login} · ID {profile.id}
            </p>
          </div>
        </div>

        {profile.bio ? (
          <p className="max-w-2xl text-sm whitespace-pre-wrap">{profile.bio}</p>
        ) : null}

        <dl className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Followers</dt>
            <dd className="font-medium tabular-nums">
              {profile.followers !== null
                ? profile.followers.toLocaleString()
                : "Unknown"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium">{formatDate(profile.createdAt)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Last broadcast</dt>
            <dd className="font-medium">
              {profile.lastBroadcast?.title || "None recorded"}
              {profile.lastBroadcast?.startedAt ? (
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {formatDate(profile.lastBroadcast.startedAt)}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        {rules.length > 0 ? (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Chat rules</p>
            <ul className="max-w-xl list-disc space-y-1 pl-5 text-sm">
              {rules.map((rule) => (
                <li key={rule}>{rule.replace(/^-+\s*/, "")}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
