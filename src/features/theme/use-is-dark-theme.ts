"use client";

import { useEffect, useState } from "react";

/** Tracks `document.documentElement` class `dark` (synced when theme toggle runs). */
export function useIsDarkTheme() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const html = document.documentElement;
    const read = () => setDark(html.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return dark;
}
