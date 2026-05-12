import { useEffect } from "react";

interface KeyboardShortcuts {
  onAdminPanel?: () => void;
  onProviderPanel?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Alt+A for Admin
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handlers.onAdminPanel?.();
      }
      // Ctrl+Alt+P for Provider
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlers.onProviderPanel?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
