"use client";
import { useEffect } from "react";
import { useTheme } from "next-themes";

export default function FaviconSwitcher() {
  const { theme } = useTheme();
  useEffect(() => {
    const favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) return;
    if (theme === 'dark') {
      favicon.setAttribute('href', '/favicon-dark.ico');
    } else {
      favicon.setAttribute('href', '/favicon-light.ico');
    }
  }, [theme]);
  return null;
} 