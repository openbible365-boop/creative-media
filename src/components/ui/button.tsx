import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-400":
              variant === "primary",
            "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-brand-400":
              variant === "secondary",
            "bg-red-500 text-white hover:bg-red-600 focus:ring-red-400":
              variant === "danger",
            "text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:ring-gray-400":
              variant === "ghost",
          },
          {
            "text-xs px-2.5 py-1.5": size === "sm",
            "text-sm px-4 py-2.5": size === "md",
            "text-base px-6 py-3": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, type ButtonProps };
