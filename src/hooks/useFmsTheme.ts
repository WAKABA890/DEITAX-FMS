import { useEffect, useState } from 'react';

export type FmsColorMode = 'dark' | 'light';

const MODE_KEY = 'dt-fms-color-mode';

const readPreference = <T extends string>(key: string, valid: readonly T[], fallback: T): T => {
  const value = localStorage.getItem(key);
  return valid.includes(value as T) ? value as T : fallback;
};

export const useFmsTheme = () => {
  const [colorMode, setColorMode] = useState<FmsColorMode>(() => readPreference(MODE_KEY, ['dark', 'light'] as const, 'dark'));

  useEffect(() => {
    // Modern is the only supported DT-FMS palette. This also migrates users
    // who previously saved the retired Classic preference.
    document.documentElement.dataset.fmsTheme = 'modern';
    localStorage.setItem('dt-fms-theme', 'modern');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.fmsMode = colorMode;
    localStorage.setItem(MODE_KEY, colorMode);
  }, [colorMode]);

  return { colorMode, setColorMode };
};
