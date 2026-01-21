import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { conversationsApi } from "@/lib/api/conversations";
import { useAuthStore } from "@/stores/auth.store";

export const useConversationsData = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState<string>("All");
  const [sidebarFilters, setSidebarFilters] = useState({
    inboxType: 'all',
    lifecycle: '',
    status: 'open',
    teamInbox: '',
    customInbox: '',
    viewType: 'chats',
  });

  const { user } = useAuthStore();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch ALL conversations once
  const { data: allConversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', {
      status: selectedTab !== "All" ? selectedTab.toLowerCase() : undefined,
      search: debouncedSearch
    }],
    queryFn: () => conversationsApi.getAllConversations({
      status: selectedTab !== "All" ? selectedTab.toLowerCase() : undefined,
      search: debouncedSearch || undefined,
    }),
    staleTime: 1000 * 30,
  });

  // Fetch assigned conversations (for "Mine" filter)
  const { data: assignedConversationsData, isLoading: assignedLoading } = useQuery({
    queryKey: ['conversations-assigned', { user: user?.id }],
    queryFn: () => conversationsApi.getAssignedConversations(),
    enabled: sidebarFilters.inboxType === 'mine' && !!user?.id,
    staleTime: 1000 * 30,
  });

  // Fetch unassigned conversations (for "Unassigned" filter)
  const { data: unassignedConversationsData, isLoading: unassignedLoading } = useQuery({
    queryKey: ['conversations-unassigned'],
    queryFn: () => conversationsApi.getUnassignedConversations(),
    enabled: sidebarFilters.inboxType === 'unassigned',
    staleTime: 1000 * 30,
  });

  const allConversations = allConversationsData?.conversations || [];

  // Select the appropriate data based on active filter
  const conversations = useMemo(() => {
    switch (sidebarFilters.inboxType) {
      case 'mine':
        return assignedConversationsData?.conversations || [];
      case 'unassigned':
        return unassignedConversationsData?.conversations || [];
      case 'all':
      default:
        return allConversationsData?.conversations || [];
    }
  }, [
    sidebarFilters.inboxType,
    allConversationsData?.conversations,
    assignedConversationsData?.conversations,
    unassignedConversationsData?.conversations,
  ]);

  // Calculate counts for sidebar
  const inboxCounts = useMemo(() => {
    const currentUserId = user?.id ? String(user.id) : null;

    const mineCount = allConversations.filter(conv => {
      if (!currentUserId || !conv.assignedToUserId) return false;
      return String(conv.assignedToUserId) === currentUserId;
    }).length;

    const unassignedCount = allConversations.filter(conv => {
      return conv.assignedToUserId === null || conv.assignedToUserId === undefined;
    }).length;

    return {
      all: allConversations.length,
      mine: mineCount,
      unassigned: unassignedCount,
    };
  }, [allConversations, user?.id]);

  const isLoading = conversationsLoading || assignedLoading || unassignedLoading;

  return {
    searchQuery,
    setSearchQuery,
    selectedTab,
    setSelectedTab,
    sidebarFilters,
    setSidebarFilters,
    conversations,
    inboxCounts,
    isLoading,
    user,
  };
};