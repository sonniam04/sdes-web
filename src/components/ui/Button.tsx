import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader } from "lucide-react";

type Variant = "primary" | "secondary" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-action text-action-text border-action hover:bg-action-hover hover:border-action-hover",
  secondary: "bg-surface text-text border-rule-strong hover:bg-canvas",
  danger: "bg-surface text-risk border-risk hover:bg-risk-bg",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  shortcut?: string;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", loading = false, shortcut, icon, disabled, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-variant={variant}
      className={`inline-flex items-center gap-1.5 rounded-sm border-[1.5px] px-3.5 py-1.5 font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader aria-hidden className="size-4 animate-spin" /> : icon}
      {children}
      {shortcut && (
        <kbd className="rounded-sm border border-current px-1 text-[11px] font-medium opacity-70">{shortcut}</kbd>
      )}
    </button>
  );
});
