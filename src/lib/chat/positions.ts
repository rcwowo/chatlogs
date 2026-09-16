export function createCodePointIndex(text: string) {
  const starts: number[] = []
  const ends: number[] = []
  let utf16 = 0
  for (const char of text) {
    starts.push(utf16)
    utf16 += char.length
    ends.push(utf16 - 1)
  }

  return {
    range(codePointStart: number, codePointEnd: number) {
      if (codePointStart < 0 || codePointEnd < codePointStart) {
        return null
      }
      if (codePointStart >= starts.length) {
        return null
      }
      const clampedEnd = Math.min(codePointEnd, ends.length - 1)
      return { start: starts[codePointStart]!, end: ends[clampedEnd]! }
    },
  }
}
