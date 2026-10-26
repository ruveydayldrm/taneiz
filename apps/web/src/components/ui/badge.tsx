import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper",
        outline: "border border-ink/15 text-ink-soft",
        field: "bg-field-50 text-field-600 ring-1 ring-field-500/25",
        wheat: "bg-wheat-100 text-wheat-700 ring-1 ring-wheat-500/30",
        alarm: "bg-alarm-50 text-alarm-600 ring-1 ring-alarm-500/30",
        muted: "bg-ink/5 text-ink-soft",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
