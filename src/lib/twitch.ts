export type NamedTarget = {
  kind: "name" | "id"
  value: string
}

export function parseTarget(input: string): NamedTarget | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  if (/^id:/i.test(trimmed)) {
    const value = trimmed.slice(3).trim()
    if (!value) {
      return null
    }
    return { kind: "id", value }
  }

  const value = trimmed.replace(/^#/, "").toLowerCase()
  if (!value) {
    return null
  }

  return { kind: "name", value }
}
