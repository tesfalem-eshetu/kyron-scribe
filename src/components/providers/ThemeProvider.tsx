"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type ThemeChoice = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeChoice;
  resolved: "light" | "dark";
  setTheme: (theme: ThemeChoice) => void;
}

const STORAGE_KEY = "ks-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeChoice) || "system";
    setThemeState(stored);
    applyTheme(stored);
    setResolved(
      stored === "dark" || (stored === "system" && systemPrefersDark())
        ? "dark"
        : "light",
    );
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyTheme("system");
      setResolved(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemeChoice) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    applyTheme(next);
    setResolved(
      next === "dark" || (next === "system" && systemPrefersDark())
        ? "dark"
        : "light",
    );
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
