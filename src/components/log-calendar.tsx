import { Calendar } from "@/components/ui/calendar"
import { civilDateFromKey, civilDateToKey } from "@/lib/dates"

export function LogCalendar({
  dates,
  date,
  onChange,
}: {
  dates: string[]
  date: string
  onChange: (date: string) => void
}) {
  const logged = new Set(dates)
  const selected = date ? civilDateFromKey(date) : undefined
  const newest = dates[0] ? civilDateFromKey(dates[0]) : undefined
  const oldest = dates[dates.length - 1]
    ? civilDateFromKey(dates[dates.length - 1])
    : undefined

  return (
    <Calendar
      mode="single"
      captionLayout="dropdown"
      selected={selected}
      onSelect={(next) => {
        if (!next) {
          return
        }
        const key = civilDateToKey(next)
        if (logged.has(key)) {
          onChange(key)
        }
      }}
      defaultMonth={selected ?? newest}
      startMonth={oldest}
      endMonth={newest}
      disabled={(day) => !logged.has(civilDateToKey(day))}
      modifiers={{
        logged: dates
          .map((key) => civilDateFromKey(key))
          .filter((value): value is Date => Boolean(value)),
      }}
      modifiersClassNames={{
        logged: "font-medium text-foreground",
      }}
      classNames={{
        disabled:
          "bg-transparent text-muted-foreground/30 [&_button]:bg-transparent [&_button]:hover:bg-transparent [&_button]:hover:text-muted-foreground/30",
      }}
      showOutsideDays={false}
    />
  )
}
