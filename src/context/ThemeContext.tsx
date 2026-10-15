import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppTheme, THEMES, DEFAULT_THEME_ID, getThemeById } from '../themes/themeDefinitions';

interface ThemeContextType {
  theme: AppTheme;
  currentThemeId: string;
  previewThemeId: string | null;
  setTheme: (themeId: string) => void;
  setPreviewTheme: (themeId: string | null) => void;
  isThemeSelectorOpen: boolean;
  setIsThemeSelectorOpen: (open: boolean) => void;
  allThemes: AppTheme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'msec_active_theme';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && THEMES.some(t => t.id === saved)) {
        return saved;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_THEME_ID;
  });

  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);

  const activeId = previewThemeId || currentThemeId;
  const activeTheme = getThemeById(activeId);

  // Synchronize data-theme on <html> root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeId);

    // Update browser theme-color meta tag if present
    let metaTag = document.querySelector('meta[name="theme-color"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', activeTheme.colors.bgApp);
  }, [activeId, activeTheme]);

  // Support VS Code shortcut (Ctrl+K, then Ctrl+T or Alt+T)
  useEffect(() => {
    let ctrlKPressed = false;
    let ctrlKTimeout: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Direct Alt + T
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setIsThemeSelectorOpen(prev => !prev);
        return;
      }

      // 2. VS Code Chord: Ctrl + K, Ctrl + T
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        ctrlKPressed = true;
        clearTimeout(ctrlKTimeout);
        ctrlKTimeout = setTimeout(() => {
          ctrlKPressed = false;
        }, 1500);
        return;
      }

      if (ctrlKPressed && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        ctrlKPressed = false;
        clearTimeout(ctrlKTimeout);
        setIsThemeSelectorOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(ctrlKTimeout);
    };
  }, []);

  const setTheme = (id: string) => {
    if (THEMES.some(t => t.id === id)) {
      setCurrentThemeId(id);
      setPreviewThemeId(null);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // LocalStorage fallback
      }
    }
  };

  const setPreviewTheme = (id: string | null) => {
    if (id === null || THEMES.some(t => t.id === id)) {
      setPreviewThemeId(id);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: activeTheme,
        currentThemeId,
        previewThemeId,
        setTheme,
        setPreviewTheme,
        isThemeSelectorOpen,
        setIsThemeSelectorOpen,
        allThemes: THEMES
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

