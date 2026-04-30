"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check localStorage or system preference on mount
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    } else if (stored === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      // Follow system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(prefersDark);
      if (prefersDark) document.documentElement.classList.add("dark");
    }
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-variant/60 transition-colors"
      aria-label="Toggle theme"
    >
      {/* Sun icon — shown when dark mode is active (click to go light) */}
      <span
        className={`material-symbols-outlined text-[20px] absolute transition-all duration-300 ${
          isDark
            ? "opacity-100 rotate-0 scale-100 text-amber-400"
            : "opacity-0 rotate-90 scale-50"
        }`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        light_mode
      </span>
      {/* Moon icon — shown when light mode is active (click to go dark) */}
      <span
        className={`material-symbols-outlined text-[20px] absolute transition-all duration-300 ${
          isDark
            ? "opacity-0 -rotate-90 scale-50"
            : "opacity-100 rotate-0 scale-100 text-on-surface-variant"
        }`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        dark_mode
      </span>
    </button>
  );
}
