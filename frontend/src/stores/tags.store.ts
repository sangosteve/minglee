// frontend/src/store/tags.store.ts
import { create } from 'zustand';
import { Tag } from '@/lib/api/tags';

interface TagSelectItem {
  id: string;
  label: string;
  color?: string;
  description?: string;
}

interface TagsStore {
  // For EditContactSheet component
  selectTags: TagSelectItem[];
  isLoading: boolean;
  isLoaded: boolean;
  // Actions
  setSelectTags: (tags: Tag[]) => void;
  setLoading: (loading: boolean) => void;
  setLoaded: (loaded: boolean) => void;
  // Utility functions
  getTagById: (id: string) => TagSelectItem | undefined;
  getTagNameById: (id: string) => string;
  refreshTags: (tags: Tag[]) => void;
}

export const useTagsStore = create<TagsStore>((set, get) => ({
  selectTags: [],
  isLoading: false,
  isLoaded: false,
  
  setSelectTags: (tags: Tag[]) => {
    const transformedTags: TagSelectItem[] = tags.map(tag => ({
      id: tag.id,
      label: tag.name,
      color: tag.color,
      description: tag.description,
    }));
    set({ selectTags: transformedTags, isLoaded: true });
  },
  
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  
  setLoaded: (loaded: boolean) => set({ isLoaded: loaded }),
  
  getTagById: (id: string) => {
    return get().selectTags.find(tag => tag.id === id);
  },
  
  getTagNameById: (id: string) => {
    const tag = get().getTagById(id);
    return tag?.label || id.slice(0, 8); // Fallback to first 8 chars of ID
  },
  
  refreshTags: (tags: Tag[]) => {
    const transformedTags: TagSelectItem[] = tags.map(tag => ({
      id: tag.id,
      label: tag.name,
      color: tag.color,
      description: tag.description,
    }));
    set({ selectTags: transformedTags });
  },
}));