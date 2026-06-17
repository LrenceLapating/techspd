import { create } from "zustand";

type AppState = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
}));
