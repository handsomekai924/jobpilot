/** 主题模式上下文：深浅切换 + 持久化 + MUI 主题注入。 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createAppleTheme } from "@/theme/muiTheme";
import type { ThemeMode } from "@/theme/tokens";

/** 主题模式持久化键。 */
const STORAGE_KEY = "jobpilot-theme";

/** 主题模式上下文值。 */
interface ThemeModeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

/** 读初始模式：持久化优先，其次系统偏好，兜底 dark。 */
function readInitialMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  } catch {
  }
  return "dark";
}

/** 提供主题模式与 MUI 主题。 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readInitialMode);

  /** 把模式写到文档根属性与 localStorage。 */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
    }
  }, [mode]);

  /** 在深浅之间切换。 */
  const toggle = useCallback(() => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo<ThemeModeContextValue>(
    () => ({ mode, setMode, toggle }),
    [mode, toggle],
  );
  const theme = useMemo(() => createAppleTheme(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

/** 取主题模式上下文；不在 Provider 里用会直接抛。 */
export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode 必须在 ThemeModeProvider 内使用");
  return ctx;
}
