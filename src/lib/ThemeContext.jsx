import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("zp7-theme") || "dark");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light-mode");
      root.classList.remove("dark-mode");
    } else {
      root.classList.remove("light-mode");
      root.classList.add("dark-mode");
    }
    localStorage.setItem("zp7-theme", theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);