import { useCallback, useEffect, useState } from "react"

import {
  addBookmark,
  listBookmarks,
  removeBookmark,
  type Bookmark,
} from "@/lib/bookmarks"
import { parseTarget } from "@/lib/twitch"

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => listBookmarks())

  const refresh = useCallback(() => {
    setBookmarks(listBookmarks())
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "chatlogs:bookmarks") {
        refresh()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [refresh])

  const add = useCallback(
    (channel: string) => {
      const next = addBookmark(channel)
      setBookmarks(next)
      return next
    },
    []
  )

  const remove = useCallback((channel: string) => {
    const next = removeBookmark(channel)
    setBookmarks(next)
    return next
  }, [])

  const has = useCallback(
    (channel: string) => {
      const target = parseTarget(channel)
      if (!target) {
        return false
      }
      return bookmarks.some((item) => item.channel === target.value)
    },
    [bookmarks]
  )

  return { bookmarks, add, remove, has }
}
