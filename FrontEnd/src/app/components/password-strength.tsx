import { Check, X } from "lucide-react";
import { cn } from "./ui/utils";

export interface PasswordCheck {
  label: string;
  passed: boolean;
}

export interface PasswordScore {
  /** 0 (empty/very weak) to 5 (very strong) */
  score: number;
  label: string;
  /** Tailwind classes for the strength bar fill */
  barClass: string;
  checks: PasswordCheck[];
}

const STRENGTH_LEVELS = [
  { label: "Very weak", barClass: "bg-red-500" },
  { label: "Weak", barClass: "bg-red-500" },
  { label: "Fair", barClass: "bg-amber-500" },
  { label: "Strong", barClass: "bg-blue-500" },
  { label: "Very strong", barClass: "bg-blue-500" },
  { label: "Excellent", barClass: "bg-emerald-500" },
] as const;

export function scorePassword(password: string): PasswordScore {
  const checks: PasswordCheck[] = [
    { label: "At least 8 characters", passed: password.length >= 8 },
    {
      label: "Mix of uppercase and lowercase letters",
      passed: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { label: "At least one number", passed: /\d/.test(password) },
    { label: "At least one symbol", passed: /[^A-Za-z0-9]/.test(password) },
  ];

  // Raw score: one point per satisfied requirement
  let score = checks.filter((c) => c.passed).length;

  // Bonus: extra length beyond the minimum is rewarded
  if (password.length >= 12) score = Math.min(5, score + 1);

  // Penalize passwords made of a single character class (e.g. "password123")
  const classes =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  if (password.length > 0 && classes <= 1) score = Math.min(score, 1);

  // Empty password shows no strength
  const level = password.length === 0 ? 0 : Math.max(1, score);

  return {
    score: level,
    ...STRENGTH_LEVELS[level],
    checks,
  };
}

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

/**
 * Live password strength feedback for account-creation forms:
 * a segmented color bar, a strength label, and a requirement checklist
 * that updates as the user types. Display-only — it does not block submit.
 */
export function PasswordStrengthIndicator({
  password,
  className,
}: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const { score, label, barClass, checks } = scorePassword(password);

  return (
    <div
      className={cn("space-y-2", className)}
      role="status"
      aria-live="polite"
    >
      {/* Segmented strength bar */}
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((segment) => (
          <div
            key={segment}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-200",
              segment <= score ? barClass : "bg-muted",
            )}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Password strength:{" "}
        <span
          className={cn(
            "font-medium",
            score <= 1 && "text-red-500",
            score === 2 && "text-amber-600",
            score === 3 && "text-blue-500",
            score >= 4 && "text-emerald-600",
          )}
        >
          {label}
        </span>
      </p>

      {/* Requirement checklist */}
      <ul className="space-y-1">
        {checks.map((check) => (
          <li
            key={check.label}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              check.passed ? "text-emerald-600" : "text-muted-foreground",
            )}
          >
            {check.passed ? (
              <Check className="size-3" aria-hidden="true" />
            ) : (
              <X className="size-3" aria-hidden="true" />
            )}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
