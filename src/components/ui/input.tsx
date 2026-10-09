"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
      const el = inputRef.current;
      if (!el || type !== "number") return;

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
      };

      el.addEventListener("wheel", handleWheel, { passive: false });
      return () => {
        el.removeEventListener("wheel", handleWheel);
      };
    }, [type]);

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:border-white/12 dark:bg-card/60 dark:placeholder:text-slate-400",
          className
        )}
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
