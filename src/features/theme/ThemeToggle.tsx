"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/features/theme/ThemeScript";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const h = document.documentElement;
    const nextDark = !h.classList.contains("dark");
    if (nextDark) {
      h.classList.add("dark");
      try {
        localStorage.setItem(THEME_STORAGE_KEY, "dark");
      } catch {
        /* ignore */
      }
    } else {
      h.classList.remove("dark");
      try {
        localStorage.setItem(THEME_STORAGE_KEY, "light");
      } catch {
        /* ignore */
      }
    }
    setIsDark(nextDark);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-surface-card text-gold-bright hover:bg-surface-lift ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode (cream & brown)" : "Dark mode (black & gold)"}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
