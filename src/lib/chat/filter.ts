import type { MergedMessage } from "@/lib/rustlog"

export function filterLogMessages(
  messages: MergedMessage[],
  userFilter: string,
  textFilter: string
) {
  const user = userFilter.trim().toLowerCase()
  const text = textFilter.trim().toLowerCase()

  return messages.filter((message) => {
    if (user) {
      const login = message.username.toLowerCase()
      const display = message.displayName.toLowerCase()
      if (login !== user && display !== user) {
        return false
      }
    }

    if (text) {
      const haystack = [
        message.text,
        message.systemText,
        message.username,
        message.displayName,
      ]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(text)) {
        return false
      }
    }

    return true
  })
}
