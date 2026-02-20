import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = "", id, ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[var(--foreground)]"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-1 focus:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-[var(--destructive)]" : ""} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-[var(--destructive)]">{error}</p>
      )}
    </div>
  );
});
