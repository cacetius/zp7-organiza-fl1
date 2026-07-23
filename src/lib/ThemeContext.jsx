import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({});

function getAutoTheme() {
  // Força tema escuro no 3º turno (21h–06h) para reduzir fadiga ocular
  const h = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getHours();
  const isTerceiroTurno = h >= 21 || h < 6;
  if (isTerceiroTurno) return "dark";
  return null; // sem força — usa preferência salva
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const auto = getAutoTheme();
    if (auto) return auto;
    return localStorage.getItem("zp7-theme") || "dark";
  });

  // Verifica a cada 30 min se entrou/saiu do 3º turno
  useEffect(() => {
    const check = () => {
      const auto = getAutoTheme();
      if (auto) setTheme(auto);
    };
    const interval = setInterval(check, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
  const isAutoNight = getAutoTheme() === "dark";

  return (
    <ThemeContext.Provider value={{ theme, toggle, isAutoNight }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);