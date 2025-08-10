"use client";
import { useEffect } from "react";
import { useTheme } from "next-themes";

export default function FaviconSwitcher() {
  const { theme, systemTheme } = useTheme();
  
  useEffect(() => {
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
    
    if (!favicon) return;
    
    const isDark = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
    
    if (isDark) {
      favicon.href = '/favicon-dark-96x96.png';
      if (appleIcon) appleIcon.href = '/apple-touch-icon-dark.png';
    } else {
      favicon.href = '/favicon-96x96.png';
      if (appleIcon) appleIcon.href = '/apple-touch-icon.png';
    }
  }, [theme, systemTheme]);
  
  return null;
} 