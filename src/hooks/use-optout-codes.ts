import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  requestOptoutCode,
  type OptoutCode,
  type OptoutService,
} from "@/lib/optout"

export type CodeState =
  | { status: "pending" }
  | { status: "ready"; code: OptoutCode }
  | { status: "error"; message: string }

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) {
      return
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

export function copyKey(service: OptoutService, state: CodeState | undefined) {
  return state?.status === "ready" ? `${service.id}|${state.code.code}` : ""
}

export function useOptoutCodes() {
  const [codes, setCodes] = useState<Record<string, CodeState>>({})
  const [copied, setCopied] = useState<Set<string>>(() => new Set())
  const requests = useRef(new Map<string, AbortController>())
  const now = useNow(Object.keys(codes).length > 0)

  useEffect(() => {
    const active = requests.current
    return () => {
      for (const controller of active.values()) {
        controller.abort()
      }
    }
  }, [])

  const requestCodes = useCallback((targets: OptoutService[]) => {
    for (const service of targets) {
      requests.current.get(service.id)?.abort()
      const controller = new AbortController()
      requests.current.set(service.id, controller)
      setCodes((current) => ({
        ...current,
        [service.id]: { status: "pending" },
      }))

      requestOptoutCode(service, controller.signal)
        .then(
          (code) => {
            if (!controller.signal.aborted) {
              setCodes((current) => ({
                ...current,
                [service.id]: { status: "ready", code },
              }))
            }
          },
          (error: unknown) => {
            if (!controller.signal.aborted) {
              setCodes((current) => ({
                ...current,
                [service.id]: {
                  status: "error",
                  message:
                    error instanceof Error ? error.message : "Request failed",
                },
              }))
            }
          }
        )
        .finally(() => {
          if (requests.current.get(service.id) === controller) {
            requests.current.delete(service.id)
          }
        })
    }
  }, [])

  const copyCommand = useCallback(async (key: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied((current) => new Set(current).add(key))
    } catch {
      toast.error("Could not copy the command.")
    }
  }, [])

  const resetCopied = useCallback(() => setCopied(new Set()), [])

  return { codes, copied, now, requestCodes, copyCommand, resetCopied }
}

export type OptoutCodes = ReturnType<typeof useOptoutCodes>
