// frontend/src/store/teams.store.ts
import { create } from 'zustand';
import { Team } from '@/lib/api/teams';

interface TeamsStore {
  selectedTeamId: string | null;
  isLoading: boolean;
  // Actions
  setSelectedTeamId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  // Helper functions
  isTeamSelected: (teamId: string) => boolean;
}

export const useTeamsStore = create<TeamsStore>((set, get) => ({
  selectedTeamId: null,
  isLoading: false,
  
  setSelectedTeamId: (id: string | null) => set({ selectedTeamId: id }),
  
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  
  isTeamSelected: (teamId: string) => get().selectedTeamId === teamId,
}));