import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors",
  {
    variants: {
      variant: {
        default: "bg-white/5 text-text-secondary border-border",
        purple: "bg-gong-purple/10 text-gong-purple-light border-gong-purple/20",
        cyan: "bg-gong-accent/10 text-gong-accent-light border-gong-accent/20",
        green: "bg-gong-success/10 text-gong-success border-gong-success/20",
        yellow: "bg-gong-warning/10 text-gong-warning border-gong-warning/20",
        red: "bg-gong-danger/10 text-gong-danger border-gong-danger/20",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
