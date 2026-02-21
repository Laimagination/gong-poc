import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors",
  {
    variants: {
      variant: {
        default: "bg-surface-2 text-text-secondary border-border",
        purple: "bg-gong-purple/8 text-gong-purple border-gong-purple/15",
        cyan: "bg-gong-accent/8 text-gong-accent-light border-gong-accent/15",
        green: "bg-gong-success/8 text-emerald-700 border-gong-success/15",
        yellow: "bg-gong-warning/8 text-amber-700 border-gong-warning/15",
        red: "bg-gong-danger/8 text-red-700 border-gong-danger/15",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
