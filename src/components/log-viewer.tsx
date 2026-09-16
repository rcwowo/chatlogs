import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDownToLineIcon, ArrowUpToLineIcon } from "lucide-react"

import { ChatHoverTooltipProvider } from "@/components/chat/hover-tooltip"
import { LogMessage } from "@/components/log-message"
import { Button } from "@/components/ui/button"
import type { ChatBadgeCatalog } from "@/lib/chat/badges"
import type { ThirdPartyEmoteCatalog } from "@/lib/chat/emotes"
import type { MergedMessage } from "@/lib/rustlog"

export function LogViewer({
  messages,
  total,
  badges,
  emotes,
  newestAtBottom = true,
}: {
  messages: MergedMessage[]
  total: number
  badges: ChatBadgeCatalog
  emotes: ThirdPartyEmoteCatalog
  newestAtBottom?: boolean
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [showJumpToNewest, setShowJumpToNewest] = useState(false)

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 24,
    getItemKey: (index) => {
      const mapped = newestAtBottom ? index : messages.length - 1 - index
      return messages[mapped]?.key ?? index
    },
  })

  const checkJumpVisibility = useCallback(() => {
    const el = parentRef.current
    if (!el) {
      return
    }
    const threshold = 300
    if (newestAtBottom) {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight
      setShowJumpToNewest(distanceFromBottom > threshold)
    } else {
      setShowJumpToNewest(el.scrollTop > threshold)
    }
  }, [newestAtBottom])

  useEffect(() => {
    const el = parentRef.current
    if (!el) {
      return
    }
    checkJumpVisibility()
    el.addEventListener("scroll", checkJumpVisibility, { passive: true })
    return () => el.removeEventListener("scroll", checkJumpVisibility)
  }, [checkJumpVisibility, messages.length])

  function scrollToNewest() {
    const el = parentRef.current
    if (!el || messages.length === 0) {
      return
    }
    if (newestAtBottom) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" })
      requestAnimationFrame(() => {
        const node = parentRef.current
        if (node) {
          node.scrollTop = node.scrollHeight
        }
        setShowJumpToNewest(false)
      })
    } else {
      el.scrollTop = 0
      virtualizer.scrollToIndex(0, { align: "start" })
      setShowJumpToNewest(false)
    }
  }

  useLayoutEffect(() => {
    if (messages.length === 0 || total === 0) {
      return
    }
    scrollToNewest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestAtBottom, total])

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
        No messages match that filter.
      </div>
    )
  }

  const count = messages.length
  const items = virtualizer.getVirtualItems()

  return (
    <ChatHoverTooltipProvider>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={parentRef}
          className="chat-scroll chat-presentation min-h-0 flex-1 overflow-auto pb-3"
        >
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {items.map((item) => {
              // Map the virtual index into the source array without copying or
              // reversing tens of thousands of messages on every render.
              const index = newestAtBottom ? item.index : count - 1 - item.index
              const message = messages[index]
              if (!message) {
                return null
              }
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
        {showJumpToNewest ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className={`absolute right-4 rounded-full shadow-lg ${
              newestAtBottom ? "bottom-4" : "top-4"
            }`}
            aria-label={
              newestAtBottom
                ? "Scroll to bottom, newest messages"
                : "Scroll to top, newest messages"
            }
            title={newestAtBottom ? "Scroll to bottom" : "Scroll to top"}
            onClick={scrollToNewest}
          >
            {newestAtBottom ? (
              <ArrowDownToLineIcon />
            ) : (
              <ArrowUpToLineIcon />
            )}
          </Button>
        ) : null}
      </div>
    </ChatHoverTooltipProvider>
  )
}
