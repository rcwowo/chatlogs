import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function ChannelAvatar({
  name,
  src,
  size = "default",
  className,
}: {
  name: string
  src?: string | null
  size?: "default" | "sm" | "lg"
  className?: string
}) {
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <Avatar size={size} className={cn("bg-muted", className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
