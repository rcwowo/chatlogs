import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "cn"

type SliderProps = Omit<
  SliderPrimitive.Root.Props<number[]>,
  "onValueChange"
> & {
  onValueChange?: (value: number[]) => void
}

function Slider({ className, value, onValueChange, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50",
        className
      )}
      value={value}
      onValueChange={(next) => {
        onValueChange?.(Array.isArray(next) ? [...next] : [next])
      }}
      {...props}
    >
      <SliderPrimitive.Control
        data-slot="slider-control"
        className="relative flex h-4 w-full touch-none items-center outline-none"
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-1.5 w-full grow rounded-full bg-muted"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-indicator"
            className="h-full rounded-full bg-primary"
          />
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-xs transition-colors outline-none hover:ring-4 hover:ring-ring/20 focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider, type SliderProps }
