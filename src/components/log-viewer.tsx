import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDownToLineIcon, ArrowUpToLineIcon } from "lucide-react"

import { ChatHoverTooltipProvider } from "@/components/chat/hover-tooltip"
import { LogMessage } from "@/components/log-message"
import { Button } from "@/components/ui/button"
import type { ChatBadgeCatalog } from "@/lib/chat/badges"
import type { ThirdPartyEmoteCatalog } from "@/lib/chat/emotes"
import { getChatPresentationStyle } from "@/lib/chat/presentation"
import { useSettingsSelector } from "@/hooks/use-settings"
import type { MergedMessage } from "@/lib/rustlog"

export function LogViewer({
  messages,
  contextMessages,
  isFiltered = false,
  onClearFilters,
  total,
  badges,
  emotes,
  newestAtBottom = true,
}: {
  messages: MergedMessage[]
  contextMessages?: MergedMessage[]
  isFiltered?: boolean
  onClearFilters?: () => void
  total: number
  badges: ChatBadgeCatalog
  emotes: ThirdPartyEmoteCatalog
  newestAtBottom?: boolean
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [showJumpToNewest, setShowJumpToNewest] = useState(false)
  // When filters are active, remember where the unfiltered view was so it can
  // be restored once the filters are cleared. Anchored by message key so it
  // stays valid regardless of which list is currently rendered.
  const anchorRef = useRef<{ key: string; offset: number } | null>(null)
  const [pendingJumpKey, setPendingJumpKey] = useState<string | null>(null)
  const [highlightKey, setHighlightKey] = useState<string | null>(null)
  const wasFilteredRef = useRef(isFiltered)

  const fullIndex = useMemo(() => {
    if (!contextMessages) {
      return null
    }
    const map = new Map<string, number>()
    contextMessages.forEach((message, index) => {
      map.set(message.key, index)
    })
    return map
  }, [contextMessages])

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
    if (!isFiltered) {
      // Snapshot the current view onto the unfiltered list using the message
      // key, so the anchor survives switching to and from filtered views.
      const items = virtualizer.getVirtualItems()
      const top = items[0]
      if (top) {
        const sourceIndex = newestAtBottom
          ? top.index
          : messages.length - 1 - top.index
        const key = messages[sourceIndex]?.key
        if (key) {
          anchorRef.current = { key, offset: el.scrollTop - top.start }
        }
      }
    }
    const threshold = 300
    if (newestAtBottom) {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight
      setShowJumpToNewest(distanceFromBottom > threshold)
    } else {
      setShowJumpToNewest(el.scrollTop > threshold)
    }
  }, [newestAtBottom, isFiltered, messages, virtualizer])

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

  // Returning to the unfiltered view: jump pending context target if one was
  // requested from a filtered view, otherwise restore the previous scroll
  // position, falling back to the newest end per the view direction.
  useEffect(() => {
    if (wasFilteredRef.current && !isFiltered && messages.length > 0) {
      const jumpKey = pendingJumpKey
      const anchor = anchorRef.current
      setPendingJumpKey(null)
      if (jumpKey) {
        const sourceIndex = fullIndex?.get(jumpKey)
        if (sourceIndex !== undefined) {
          virtualizer.scrollToIndex(
            newestAtBottom ? sourceIndex : messages.length - 1 - sourceIndex,
            { align: "start" }
          )
          setHighlightKey(jumpKey)
          const timer = setTimeout(() => setHighlightKey(null), 1500)
          anchorRef.current = null
          return () => clearTimeout(timer)
        }
      } else if (anchor) {
        const sourceIndex = fullIndex?.get(anchor.key)
        if (
          sourceIndex !== undefined &&
          anchor.key !== messages[newestAtBottom ? 0 : messages.length - 1]?.key
        ) {
          const target = newestAtBottom
            ? sourceIndex
            : messages.length - 1 - sourceIndex
          virtualizer.scrollToIndex(target, { align: "start" })
          requestAnimationFrame(() => {
            const node = parentRef.current
            if (node) {
              node.scrollTop -= anchor.offset
            }
          })
        }
        // No anchor: the list already sits wherever it was, and initial loads
        // are handled by the newest-end scroll above.
      }
    }
    wasFilteredRef.current = isFiltered
  }, [
    isFiltered,
    messages,
    fullIndex,
    newestAtBottom,
    virtualizer,
    pendingJumpKey,
  ])

  function jumpToContext(key: string) {
    if (!onClearFilters) {
      return
    }
    // Reset the anchor so clearing filters uses the context jump, not the
    // stale pre-filter scroll position.
    anchorRef.current = null
    setPendingJumpKey(key)
    onClearFilters()
  }

  const appearance = useSettingsSelector((settings) => settings.appearance)
  const presentationStyle = useMemo(
    () =>
      getChatPresentationStyle({
        fontFamily: appearance.fontFamily,
        fontSizePx: appearance.fontSizePx,
        emoteScale: appearance.emoteScale,
      }),
    [appearance.emoteScale, appearance.fontFamily, appearance.fontSizePx]
  )

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
          data-alternating-rows={
            appearance.alternatingRowBackgrounds ? "true" : undefined
          }
          data-separators={appearance.messageSeparators ? "true" : undefined}
          className="chat-scroll chat-presentation min-h-0 flex-1 overflow-auto pb-3"
          style={presentationStyle}
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
                    striped={index % 2 === 1}
                    highlighted={message.key === highlightKey}
                    onJumpToContext={
                      isFiltered && onClearFilters
                        ? () => jumpToContext(message.key)
                        : undefined
                    }
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
            {newestAtBottom ? <ArrowDownToLineIcon /> : <ArrowUpToLineIcon />}
          </Button>
        ) : null}
      </div>
    </ChatHoverTooltipProvider>
  )
}
