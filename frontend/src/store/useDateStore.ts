import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DateState {
  configuredDate: Date | null;
  isDateConfigured: boolean;
  setConfiguredDate: (date: Date | null) => void;
  clearConfiguredDate: () => void;
  getCurrentDate: () => Date;
  // Add a counter to force reactivity when date is reset
  resetCounter: number;
}

export const useDateStore = create<DateState>()(
  persist(
    (set, get) => ({
      configuredDate: null,
      isDateConfigured: false,
      resetCounter: 0,

      setConfiguredDate: (date: Date | null) => {
        set({
          configuredDate: date,
          isDateConfigured: date !== null,
        });
      },

      clearConfiguredDate: () => {
        set((state) => ({
          configuredDate: null,
          isDateConfigured: false,
          // Increment counter to force refresh of dependent components
          resetCounter: state.resetCounter + 1,
        }));
      },

      getCurrentDate: () => {
        const state = get();
        return state.configuredDate || new Date();
      },
    }),
    {
      name: 'configured-date-storage-v2',
      // Custom storage to handle Date objects properly
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;

          try {
            const parsed = JSON.parse(str);
            // Convert the ISO string back to a Date object
            if (parsed.state.configuredDate) {
              const dateObj = new Date(parsed.state.configuredDate);
              // Validate the date is valid
              if (isNaN(dateObj.getTime())) {
                console.warn('Invalid date found in storage, clearing');
                return null;
              }
              parsed.state.configuredDate = dateObj;
            }
            return parsed;
          } catch (error) {
            console.warn('Failed to parse stored date configuration, clearing:', error);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            // Convert Date object to ISO string for storage
            const valueToStore = {
              ...value,
              state: {
                ...value.state,
                configuredDate: value.state.configuredDate?.toISOString() || null,
              },
            };
            localStorage.setItem(name, JSON.stringify(valueToStore));
          } catch (error) {
            console.error('Failed to store date configuration:', error);
          }
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
); 