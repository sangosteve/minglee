// frontend/src/stores/contacts.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Contact, ContactFilters } from '@/lib/api/contacts';

interface ContactsStore {
  // State
  selectedContactIds: string[];
  bulkActionType: 'export' | 'delete' | 'tag' | 'status' | null;
  importProgress: {
    total: number;
    processed: number;
    success: number;
    failed: number;
    errors: string[];
  } | null;
  
  // Actions
  toggleContactSelection: (contactId: string) => void;
  selectAllContacts: (contactIds: string[]) => void;
  clearSelection: () => void;
  setBulkActionType: (action: 'export' | 'delete' | 'tag' | 'status' | null) => void;
  setImportProgress: (progress: ContactsStore['importProgress']) => void;
  resetImportProgress: () => void;
}

export const useContactsStore = create<ContactsStore>()(
  persist(
    (set) => ({
      selectedContactIds: [],
      bulkActionType: null,
      importProgress: null,

      toggleContactSelection: (contactId) =>
        set((state) => ({
          selectedContactIds: state.selectedContactIds.includes(contactId)
            ? state.selectedContactIds.filter(id => id !== contactId)
            : [...state.selectedContactIds, contactId]
        })),

      selectAllContacts: (contactIds) =>
        set((state) => {
          const allSelected = contactIds.every(id => 
            state.selectedContactIds.includes(id)
          );
          
          return {
            selectedContactIds: allSelected 
              ? [] 
              : [...contactIds]
          };
        }),

      clearSelection: () => set({ selectedContactIds: [] }),

      setBulkActionType: (action) => set({ bulkActionType: action }),

      setImportProgress: (progress) => set({ importProgress: progress }),

      resetImportProgress: () => set({ importProgress: null }),
    }),
    {
      name: 'contacts-store',
      partialize: (state) => ({
        selectedContactIds: state.selectedContactIds,
      }),
    }
  )
);