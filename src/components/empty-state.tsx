import type { ComponentType, ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Centered icon, title and description used for empty, loading and error panes. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  tone = "default",
  spinning = false,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  tone?: "default" | "error"
  spinning?: boolean
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-8 text-center",
        className
      )}
    >
      <div
        className={cn(
          "rounded-full border p-3",
          tone === "error"
            ? "border-destructive/30 bg-destructive/10"
            : "border-border bg-muted/40"
        )}
      >
        <Icon
          className={cn(
            "size-5",
            tone === "error" ? "text-destructive" : "text-muted-foreground",
            spinning && "animate-spin"
          )}
        />
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div className="font-medium">{title}</div>
        {description ? (
          <div className="max-w-sm text-sm text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  )
}
