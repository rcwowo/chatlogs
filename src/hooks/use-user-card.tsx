import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { UserCardTarget } from "@/lib/chat/types"

type UserCardState = {
  target: UserCardTarget | null
  anchor: DOMRect | null
}

type UserCardContextValue = {
  target: UserCardTarget | null
  anchor: DOMRect | null
  toggle: (target: UserCardTarget, el: HTMLElement | null) => void
  close: () => void
  isOpenFor: (target: UserCardTarget) => boolean
}

const UserCardContext = createContext<UserCardContextValue | null>(null)

function targetKey(target: UserCardTarget) {
  if (target.userId) {
    return `id:${target.userId}`
  }
  return `login:${target.userName.toLowerCase()}`
}

export function UserCardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserCardState>({
    target: null,
    anchor: null,
  })

  const close = useCallback(() => {
    setState({ target: null, anchor: null })
  }, [])

  const toggle = useCallback((target: UserCardTarget, el: HTMLElement | null) => {
    setState((current) => {
      if (current.target && targetKey(current.target) === targetKey(target)) {
        return { target: null, anchor: null }
      }
      return {
        target,
        anchor: el?.getBoundingClientRect() ?? null,
      }
    })
  }, [])

  const isOpenFor = useCallback(
    (target: UserCardTarget) => {
      return Boolean(state.target && targetKey(state.target) === targetKey(target))
    },
    [state.target]
  )

  const value = useMemo(
    () => ({
      target: state.target,
      anchor: state.anchor,
      toggle,
      close,
      isOpenFor,
    }),
    [close, isOpenFor, state.anchor, state.target, toggle]
  )

  return (
    <UserCardContext.Provider value={value}>{children}</UserCardContext.Provider>
  )
}

export function useUserCard() {
  const context = useContext(UserCardContext)
  if (!context) {
    throw new Error("useUserCard must be used within UserCardProvider")
  }
  return context
}

export function useUserCardOptional() {
  return useContext(UserCardContext)
}
