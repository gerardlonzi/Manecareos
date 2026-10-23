import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-hover shadow-card",
        secondary: "bg-surface text-ink border border-line hover:bg-bg shadow-card",
        ghost: "text-ink hover:bg-primary-soft",
        danger: "bg-danger text-white hover:bg-red-800 shadow-card",
        outlineDanger: "bg-surface text-danger border border-red-200 hover:bg-danger-soft",
      },
      size: { sm: "h-8 px-3", md: "h-10 px-4", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { pending?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant, size, pending, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function LinkButton({
  href, className, variant, size, children, ...props
}: Omit<React.ComponentProps<typeof Link>, "className"> & VariantProps<typeof buttonVariants> & { className?: string }) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </Link>
  );
}
