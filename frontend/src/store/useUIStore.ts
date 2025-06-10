import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type TabType = 'order-management' | 'insights';

interface UIState {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: 'order-management', // Default tab
      setActiveTab: (tab: TabType) => {
        set({ activeTab: tab });
      },
    }),
    {
      name: 'ui-storage', // Stored in localStorage as 'ui-storage'
    }
  )
); 