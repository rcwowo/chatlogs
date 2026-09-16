const MESSAGE_URL_PATTERN = /https?:\/\/\S+/g

export type MessageUrlMatch = {
  url: string
  start: number
  end: number
}

export function findMessageUrls(text: string): MessageUrlMatch[] {
  return Array.from(text.matchAll(MESSAGE_URL_PATTERN), (match) => {
    const url = match[0]
    const start = match.index ?? 0
    return {
      url,
      start,
      end: start + url.length,
    }
  })
}
