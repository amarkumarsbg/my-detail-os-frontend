"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-in-out motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary/80 shadow hover:bg-primary/90 dark:bg-primary/15 dark:text-primary dark:border-primary/35 dark:shadow-none dark:hover:bg-primary/25 dark:hover:border-primary/50",
        destructive:
          "bg-destructive text-destructive-foreground border border-red-600 dark:border-red-500 shadow-sm hover:bg-destructive/90",
        outline:
          "border border-primary/50 text-primary bg-background shadow-sm hover:bg-primary/10 hover:text-primary dark:border-primary/40 dark:bg-transparent dark:text-primary dark:hover:bg-primary/10",
        secondary:
          "bg-secondary text-secondary-foreground border border-border/80 shadow-sm hover:bg-secondary/80 dark:border-white/[0.08]",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-white/[0.06]",
        link: "text-primary underline-offset-4 hover:underline motion-safe:active:scale-100",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
