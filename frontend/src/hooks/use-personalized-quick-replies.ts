import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quickRepliesApi } from '@/lib/api/quick-replies';
import { toast } from '@/hooks/use-toast';

export const usePersonalizedQuickReplies = () => {
  const queryClient = useQueryClient();

  // Preview quick reply with variables
  const previewMutation = useMutation({
    mutationFn: ({ quickReplyId, conversationId }: { quickReplyId: string; conversationId: string }) =>
      quickRepliesApi.previewQuickReply(quickReplyId, conversationId),
    onError: (error: any) => {
      console.error('Preview error:', error);
    },
  });

  // Send quick reply
  const sendMutation = useMutation({
    mutationFn: ({ conversationId, quickReplyId }: { conversationId: string; quickReplyId: string }) =>
      quickRepliesApi.sendQuickReply(conversationId, quickReplyId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      
      toast({
        title: "Quick reply sent",
        description: "Your personalized message has been sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send quick reply",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  return {
    preview: previewMutation,
    send: sendMutation,
  };
};