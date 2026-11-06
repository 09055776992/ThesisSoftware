import type { ReactNode } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:]+$/;

function getSafeHref(value: string) {
  const href = value.startsWith("www.") ? `https://${value}` : value;

  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}

export function LinkifiedText({ children }: { children: string }) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_PATTERN.exec(children)) !== null) {
    const value = match[0];
    const punctuation = value.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    const linkText = value.slice(0, value.length - punctuation.length);
    const href = getSafeHref(linkText);

    if (!href) continue;

    if (match.index > lastIndex) {
      parts.push(children.slice(lastIndex, match.index));
    }

    parts.push(
      <a
        key={`${match.index}-${href}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline break-all hover:text-blue-800"
      >
        {linkText}
      </a>,
      punctuation,
    );
    lastIndex = match.index + value.length;
  }

  if (lastIndex === 0) return <>{children}</>;

  parts.push(children.slice(lastIndex));
  return <>{parts}</>;
}
