import { useEffect, useMemo, useState } from "react"

import type { ThirdPartyEmoteCatalog } from "@/lib/chat/emotes"
import { createLogMessageMatcher } from "@/lib/chat/search"
import type { MergedMessage } from "@/lib/rustlog"

/** Lists up to this size are filtered synchronously; it's cheap enough. */
const SYNC_LIMIT = 5000
/** Time spent scanning per slice before yielding back to the browser. */
const SLICE_BUDGET_MS = 12
/** Only show the loading skeleton if a scan takes longer than this. */
const SLOW_AFTER_MS = 150

const yieldToBrowser = (() => {
  // MessageChannel avoids the 4ms clamp nested setTimeout calls get.
  if (typeof MessageChannel === "undefined") {
    return (callback: () => void) => setTimeout(callback, 0)
  }
  const channel = new MessageChannel()
  const queue: Array<() => void> = []
  channel.port1.onmessage = () => queue.shift()?.()
  return (callback: () => void) => {
    queue.push(callback)
    channel.port2.postMessage(null)
  }
})()

type Job = {
  messages: MergedMessage[]
  test: (message: MergedMessage) => boolean
}

/**
 * Filters chat logs without freezing the page on very large days. Small lists
 * are filtered inline; large ones are scanned in slices between frames, with
 * the previous result kept on screen until the new one is ready.
 */
export function useFilteredMessages(
  messages: MergedMessage[],
  query: string,
  sender: string,
  emotes: ThirdPartyEmoteCatalog | null
) {
  const matcher = useMemo(
    () => createLogMessageMatcher(query, sender, emotes),
    [query, sender, emotes]
  )

  const job = useMemo<Job | null>(
    () =>
      matcher.kind === "some" && messages.length > SYNC_LIMIT
        ? { messages, test: matcher.test }
        : null,
    [matcher, messages]
  )

  const inline = useMemo(() => {
    if (job) {
      return null
    }
    if (matcher.kind === "all") {
      return messages
    }
    if (matcher.kind === "none") {
      return []
    }
    return messages.filter(matcher.test)
  }, [job, matcher, messages])

  const [done, setDone] = useState<{
    job: Job
    filtered: MergedMessage[]
  } | null>(null)
  const [slowJob, setSlowJob] = useState<Job | null>(null)

  useEffect(() => {
    if (!job) {
      return
    }
    const current = job
    let cancelled = false
    const { messages: source, test } = current
    const filtered: MergedMessage[] = []
    let index = 0
    const slowTimer = setTimeout(() => setSlowJob(current), SLOW_AFTER_MS)

    function step() {
      if (cancelled) {
        return
      }
      const deadline = performance.now() + SLICE_BUDGET_MS
      while (index < source.length && performance.now() < deadline) {
        const end = Math.min(index + 500, source.length)
        for (; index < end; index++) {
          const message = source[index]!
          if (test(message)) {
            filtered.push(message)
          }
        }
      }
      if (index < source.length) {
        yieldToBrowser(step)
        return
      }
      clearTimeout(slowTimer)
      setDone({ job: current, filtered })
    }

    yieldToBrowser(step)
    return () => {
      cancelled = true
      clearTimeout(slowTimer)
    }
  }, [job])

  // The last list that was fully shown, so a new scan on the same day can keep
  // it on screen instead of flashing the skeleton.
  const [settled, setSettled] = useState<MergedMessage[] | null>(null)
  const ready = !job || done?.job === job
  if (ready && settled !== messages && messages.length > 0) {
    setSettled(messages)
  }

  if (!job) {
    return { filtered: inline!, pending: false, slow: false }
  }
  if (done?.job === job) {
    return { filtered: done.filtered, pending: false, slow: false }
  }
  const stale =
    done?.job.messages === messages
      ? done.filtered
      : settled === messages
        ? messages
        : null
  return {
    filtered: stale ?? messages,
    pending: true,
    slow: slowJob === job || stale === null,
  }
}
