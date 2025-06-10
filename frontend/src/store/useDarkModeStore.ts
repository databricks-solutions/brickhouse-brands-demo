import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DarkModeState {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}

export const useDarkModeStore = create<DarkModeState>()(
  persist(
    (set, get) => ({
      isDarkMode: false,
      toggleDarkMode: () => {
        const newDarkMode = !get().isDarkMode;
        set({ isDarkMode: newDarkMode });

        // Apply dark class to document
        if (newDarkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
      setDarkMode: (isDark: boolean) => {
        set({ isDarkMode: isDark });

        // Apply dark class to document
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
    }),
    {
      name: 'dark-mode-storage', // unique name for localStorage
      onRehydrateStorage: () => (state) => {
        // Apply dark class on hydration
        if (state?.isDarkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
    }
  )
); 