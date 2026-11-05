import { useSyncExternalStore } from "react"

export type Route = "logs" | "optout"

export const OPTOUT_PATH = "/optout"

const NAVIGATE_EVENT = "chatlogs:navigate"

type HistoryState = { inApp?: boolean } | null

function routeFromPath(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "").toLowerCase()
  return path === OPTOUT_PATH ? "optout" : "logs"
}

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener)
  window.addEventListener(NAVIGATE_EVENT, listener)
  return () => {
    window.removeEventListener("popstate", listener)
    window.removeEventListener(NAVIGATE_EVENT, listener)
  }
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () =>
    routeFromPath(window.location.pathname)
  )
}

export function navigate(href: string) {
  const state: HistoryState = { inApp: true }
  window.history.pushState(state, "", href)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}

/** Go back if the previous page was in the app, so its URL is restored. */
export function navigateBack(fallbackHref: string) {
  const state = window.history.state as HistoryState
  if (state?.inApp) {
    window.history.back()
    return
  }
  window.history.replaceState(null, "", fallbackHref)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}
