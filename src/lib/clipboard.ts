import { toast } from "sonner"

export async function copyText(
  label: string,
  value: string | undefined | null
) {
  const text = value?.trim()
  if (!text) {
    toast.error(`${label} is not available.`)
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`Copied ${label.toLowerCase()}.`)
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}.`)
  }
}
