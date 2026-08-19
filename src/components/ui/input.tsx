import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, inputMode, onWheel, ...props }, ref) => {
    // Determine default inputMode for numeric/tel inputs if not explicitly specified
    const computedInputMode =
      inputMode ||
      (type === "number"
        ? props.step && props.step !== "1"
          ? "decimal"
          : "numeric"
        : type === "tel"
          ? "tel"
          : undefined);

    return (
      <input
        type={type}
        inputMode={computedInputMode}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        onWheel={(e) => {
          if (type === "number") {
            (e.target as HTMLInputElement).blur();
          }
          onWheel?.(e);
        }}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
