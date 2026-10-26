import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold leading-none transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white shadow-sm hover:bg-primary-hover hover:shadow-md",
        secondary: "border border-line bg-surface text-ink hover:border-primary/40 hover:bg-primary-soft/50",
        soft: "bg-primary-soft text-primary hover:bg-primary/15",
        ghost: "text-ink hover:bg-primary-soft",
        danger: "bg-danger text-white hover:opacity-90",
        outlineDanger: "border border-danger/30 bg-surface text-danger hover:bg-danger-soft",
      },
      size: { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4", lg: "h-12 px-6 text-[15px]", icon: "h-9 w-9", iconSm: "h-8 w-8" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { pending?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant, size, pending, disabled, children, type = "button", ...props }, ref,
) {
  return (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function LinkButton({ href, className, variant, size, children, ...props }: Omit<React.ComponentProps<typeof Link>, "className"> & VariantProps<typeof buttonVariants> & { className?: string }) {
  return <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...props}>{children}</Link>;
}
