"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

const ORDER = ["light", "dark", "system"] as const;

const META = {
  light: { Icon: Sun, label: "Light theme" },
  dark: { Icon: Moon, label: "Dark theme" },
  system: { Icon: Monitor, label: "System theme" },
} as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { Icon, label } = META[theme];

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={cycle}
      aria-label={`${label}. Click to change theme.`}
      title={label}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}
