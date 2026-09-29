import { useSyncExternalStore } from 'react';
import { themeStorageKey } from './theme-constants';

export type Theme = 'light' | 'dark' | 'system';

const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Speicher blockiert (z. B. privater Modus): Theme gilt trotzdem bis zum Neuladen.
  }
  document.documentElement.dataset.theme = theme;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => 'system');
}
