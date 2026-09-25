import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

// ---------------------------------------------------------------------------
// Section headings
// ---------------------------------------------------------------------------

export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div>
        <h3 className="text-sm leading-none font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Grouped rows
// ---------------------------------------------------------------------------

export function SettingsGroup({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-lg border border-border bg-background",
        className
      )}
    >
      {children}
    </div>
  )
}

export function SettingsSwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  title: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-2.5 py-2",
        disabled && "opacity-60"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-tight font-medium">{title}</div>
        {description ? (
          <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      <div className="shrink-0">
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

export type SettingsSegmentedOption<T extends string> = {
  value: T
  label?: string
  icon?: React.ComponentType<{ className?: string }>
  preview?: string
}

const segmentedSizeStyles = {
  default: {
    button: "gap-1.5 px-2.5 py-1 text-xs rounded-md",
    icon: "size-3.5",
  },
  lg: {
    button: "gap-2 px-3 py-1.5 text-sm rounded-md",
    icon: "size-4",
  },
} as const

export function SettingsSegmented<T extends string>({
  value,
  onChange,
  options,
  size = "default",
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: SettingsSegmentedOption<T>[]
  size?: keyof typeof segmentedSizeStyles
  className?: string
}) {
  const sizeStyle = segmentedSizeStyles[size]

  return (
    <div className={cn("flex flex-wrap gap-1", className)} role="group">
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex cursor-pointer items-center border font-medium transition-colors",
              sizeStyle.button,
              selected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {option.icon && (
              <option.icon className={cn("shrink-0", sizeStyle.icon)} />
            )}
            {option.preview != null ? (
              <span className="font-mono">{option.preview}</span>
            ) : (
              option.label
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

export function SettingsSliderRow({
  title,
  description,
  value,
  valueLabel,
  onChange,
  min,
  max,
}: {
  title: string
  description?: string
  value: number
  valueLabel?: React.ReactNode
  onChange: (value: number) => void
  min: number
  max: number
}) {
  return (
    <div className="px-2.5 py-2">
      <div className="flex items-start justify-between gap-2 text-sm">
        <div className="min-w-0">
          <span className="leading-tight font-medium">{title}</span>
          {description ? (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center">
          <span className="text-xs text-muted-foreground tabular-nums">
            {valueLabel ?? value}
          </span>
        </div>
      </div>
      <div className="pt-3 pb-2">
        <Slider
          min={min}
          max={max}
          step={1}
          value={[value]}
          onValueChange={(values) => onChange(values[0] ?? min)}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Text fields
// ---------------------------------------------------------------------------

export function SettingsInputRow({
  label,
  description,
  value,
  onChange,
  placeholder,
  onBlur,
  onKeyDown,
}: {
  label: string
  description?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}) {
  return (
    <div className="space-y-1.5 px-2.5 py-2">
      <div>
        <Label className="text-sm">{label}</Label>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Actions & callouts
// ---------------------------------------------------------------------------

export function SettingsCallout({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground",
        className
      )}
    >
      {title && (
        <div className="mb-1 text-sm font-medium text-foreground">{title}</div>
      )}
      {children}
    </div>
  )
}

export function SettingsPanel({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return <div className={cn("space-y-6 pb-2", className)}>{children}</div>
}
