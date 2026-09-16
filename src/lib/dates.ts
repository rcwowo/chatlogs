export type AvailableLogDate = {
  year: string
  month: string
  day?: string
}

function pad(value: string | number, size = 2) {
  return String(value).padStart(size, "0")
}

export function toDateKey(date: AvailableLogDate) {
  const year = pad(date.year, 4)
  const month = pad(date.month)
  if (date.day) {
    return `${year}-${month}-${pad(date.day)}`
  }
  return `${year}-${month}`
}

export function fromDateKey(key: string): AvailableLogDate | null {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (dayMatch) {
    return { year: dayMatch[1], month: dayMatch[2], day: dayMatch[3] }
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(key)
  if (monthMatch) {
    return { year: monthMatch[1], month: monthMatch[2] }
  }

  return null
}

export function formatDateKey(key: string) {
  const parsed = fromDateKey(key)
  if (!parsed) {
    return key
  }

  const year = Number(parsed.year)
  const month = Number(parsed.month)
  if (parsed.day) {
    const day = Number(parsed.day)
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  }

  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  })
}

export function mergeDateKeys(groups: AvailableLogDate[][]) {
  const keys = new Set<string>()
  for (const group of groups) {
    for (const date of group) {
      keys.add(toDateKey(date))
    }
  }

  return [...keys].sort((a, b) => b.localeCompare(a))
}

export function civilDateFromKey(key: string) {
  const parsed = fromDateKey(key)
  if (!parsed?.day) {
    return undefined
  }
  return new Date(
    Number(parsed.year),
    Number(parsed.month) - 1,
    Number(parsed.day)
  )
}

export function civilDateToKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
