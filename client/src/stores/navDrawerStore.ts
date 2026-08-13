import { create } from "zustand";

interface NavDrawerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useNavDrawerStore = create<NavDrawerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

export const selectIsNavDrawerOpen = (state: NavDrawerState) => state.isOpen;
