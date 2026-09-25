import { readJson, writeJson } from "@/lib/storage"
import { parseTarget } from "@/lib/twitch"

const STORAGE_KEY = "chatlogs:bookmarks"

export type Bookmark = {
  channel: string
}

function readBookmarks(): Bookmark[] {
  const stored = readJson<Bookmark[]>(STORAGE_KEY, [])
  if (!Array.isArray(stored)) {
    return []
  }
  return stored.filter((item) => item && typeof item.channel === "string")
}

function writeBookmarks(bookmarks: Bookmark[]) {
  writeJson(STORAGE_KEY, bookmarks)
}

export function listBookmarks() {
  return readBookmarks()
}

export function addBookmark(channel: string) {
  const target = parseTarget(channel)
  if (!target) {
    throw new Error("Enter a channel name.")
  }
  if (target.kind === "id") {
    throw new Error("Bookmark a channel login, not an id.")
  }

  const bookmarks = readBookmarks()
  if (bookmarks.some((item) => item.channel === target.value)) {
    return bookmarks
  }

  const next = [...bookmarks, { channel: target.value }]
  writeBookmarks(next)
  return next
}

export function moveBookmark(
  channel: string,
  toIndex: number
): Bookmark[] | null {
  const bookmarks = readBookmarks()
  const fromIndex = bookmarks.findIndex((item) => item.channel === channel)
  if (fromIndex === -1) {
    return null
  }

  const next = [...bookmarks]
  const [moved] = next.splice(fromIndex, 1)
  const clamped = Math.min(Math.max(toIndex, 0), next.length)
  next.splice(clamped, 0, moved)
  writeBookmarks(next)
  return next
}

export function removeBookmark(channel: string) {
  const target = parseTarget(channel)
  if (!target) {
    return readBookmarks()
  }
  const next = readBookmarks().filter((item) => item.channel !== target.value)
  writeBookmarks(next)
  return next
}
