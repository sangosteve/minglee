import { api } from '../api';
import { useQuery } from '@tanstack/react-query';

export interface AnalyticsOverview {
  summary: {
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
    avgResponseTime: number;
  };
  trends: {
    messageTrends: Array<{
      date: string;
      count: number;
      incoming: number;
      outgoing: number;
    }>;
    conversationStatus: Array<{
      status: string;
      count: number;
    }>;
  };
  insights: {
    topContacts: Array<{
      name: string;
      phone: string;
      message_count: number;
    }>;
    mediaStats: {
      total_media: number;
      images: number;
      videos: number;
      audio: number;
      documents: number;
    };
  };
  timeframe: {
    start: string;
    end: string;
  };
}

export interface ConversationAnalytics {
  growth: Array<{
    date: string;
    cumulative_count: number;
    daily_new: number;
  }>;
  duration: {
    avgDurationHours: number;
    totalConversations: number;
  };
  resolution: {
    avg_resolution_hours: number;
    resolved_count: number;
  };
}

export interface ContactAnalytics {
  growth: Array<{
    date: string;
    cumulative_count: number;
    daily_new: number;
  }>;
  engagement: Array<{
    id: string;
    name: string;
    phone: string;
    message_count: number;
    active_days: number;
    last_contact: string;
  }>;
  demographics: Array<{
    country: string;
    city: string;
    count: number;
  }>;
}

export interface TeamAnalytics {
  userPerformance: Array<{
    date: string;
    total_messages: number;
    sent_messages: number;
    received_messages: number;
    avg_response_time_minutes: number;
  }>;
  assignmentStats: Array<{
    assigned_to: string;
    conversation_count: number;
    avg_unread: number;
    resolved_count: number;
  }>;
}

export interface RealtimeAnalytics {
  realtime: {
    messages_last_hour: number;
    incoming_last_hour: number;
    outgoing_last_hour: number;
    active_conversations_last_hour: number;
  };
  unread: {
    total_unread: number;
    conversations_with_unread: number;
  };
  activeUsers: Array<{
    name: string;
    assigned_conversations: number;
    assigned_unread: number;
  }>;
  timestamp: string;
}

// API Calls
export const analyticsApi = {
  getOverview: async (range: string = 'month'): Promise<{ success: boolean; data: AnalyticsOverview }> => {
    const response = await api.get(`/analytics/overview?range=${range}`);
    
    // Ensure numeric values are numbers
    const data = response.data;
    if (data.summary) {
      data.summary.totalConversations = Number(data.summary.totalConversations) || 0;
      data.summary.activeConversations = Number(data.summary.activeConversations) || 0;
      data.summary.totalMessages = Number(data.summary.totalMessages) || 0;
      data.summary.avgResponseTime = Number(data.summary.avgResponseTime) || 0;
    }
    
    return response;
  },

  // Get conversation analytics
  getConversationAnalytics: async (range: string = 'month'): Promise<{ success: boolean; data: ConversationAnalytics }> => {
    return await api.get(`/analytics/conversations?range=${range}`);
  },

  // Get contact analytics
  getContactAnalytics: async (range: string = 'month'): Promise<{ success: boolean; data: ContactAnalytics }> => {
    return await api.get(`/analytics/contacts?range=${range}`);
  },

  // Get team analytics
  getTeamAnalytics: async (range: string = 'month'): Promise<{ success: boolean; data: TeamAnalytics }> => {
    return await api.get(`/analytics/team?range=${range}`);
  },

  // Get realtime analytics
  getRealtimeAnalytics: async (): Promise<{ success: boolean; data: RealtimeAnalytics }> => {
    return await api.get('/analytics/realtime');
  },
};

// React Query Hooks
export const useAnalyticsOverview = (range: string = 'month') => {
  return useQuery({
    queryKey: ['analytics', 'overview', range],
    queryFn: () => analyticsApi.getOverview(range),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
  });
};

export const useConversationAnalytics = (range: string = 'month') => {
  return useQuery({
    queryKey: ['analytics', 'conversations', range],
    queryFn: () => analyticsApi.getConversationAnalytics(range),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 10,
  });
};

export const useContactAnalytics = (range: string = 'month') => {
  return useQuery({
    queryKey: ['analytics', 'contacts', range],
    queryFn: () => analyticsApi.getContactAnalytics(range),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 10,
  });
};

export const useTeamAnalytics = (range: string = 'month') => {
  return useQuery({
    queryKey: ['analytics', 'team', range],
    queryFn: () => analyticsApi.getTeamAnalytics(range),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 10,
  });
};

export const useRealtimeAnalytics = () => {
  return useQuery({
    queryKey: ['analytics', 'realtime'],
    queryFn: () => analyticsApi.getRealtimeAnalytics(),
    select: (data) => data.data,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // Refresh every 30 seconds
  });
};