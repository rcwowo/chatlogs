import { useEffect, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import { ChatHoverTooltipProvider } from "@/components/chat/hover-tooltip"
import { LogMessage } from "@/components/log-message"
import type { ChatBadgeCatalog } from "@/lib/chat/badges"
import type { ThirdPartyEmoteCatalog } from "@/lib/chat/emotes"
import type { MergedMessage } from "@/lib/rustlog"

export function LogViewer({
  messages,
  total,
  badges,
  emotes,
}: {
  messages: MergedMessage[]
  total: number
  badges: ChatBadgeCatalog
  emotes: ThirdPartyEmoteCatalog
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 24,
  })

  useEffect(() => {
    if (messages.length === 0) {
      return
    }
    const frame = requestAnimationFrame(() => {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" })
    })
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (total === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No messages for this day.
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Nothing matches that filter.
      </div>
    )
  }

  const items = virtualizer.getVirtualItems()

  return (
    <ChatHoverTooltipProvider>
      <div
        ref={parentRef}
        className="chat-scroll chat-presentation min-h-0 flex-1 overflow-auto pb-3"
      >
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {items.map((item) => {
            const message = messages[item.index]
            return (
              <div
                key={message.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <LogMessage
                  message={message}
                  badges={badges}
                  emotes={emotes}
                />
              </div>
            )
          })}
        </div>
      </div>
    </ChatHoverTooltipProvider>
  )
}
