"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/** Tracks `html.dark` toggled by ThemeScript / user preference. */
export function AppToaster() {
  /** Avoid SSR/client hydration mismatch with Sonner. */
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setMounted(true);
    function read() {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    }
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  if (!mounted) return null;

  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      theme={theme}
      toastOptions={{
        classNames: {
          toast: "border border-gold/25 bg-surface-card text-ink shadow-xl"
        }
      }}
    />
  );
}
