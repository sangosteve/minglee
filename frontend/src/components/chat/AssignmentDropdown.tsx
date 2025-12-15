// frontend/src/components/chat/AssignmentDropdown.tsx
import React, { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserIcon, UserPlusIcon, CheckIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckSolid } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/lib/api/conversations';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AssignmentDropdownProps {
  conversationId: string;
  currentAssignment?: string; // assignedToUserId
  onAssignmentChange?: () => void;
}

export const AssignmentDropdown: React.FC<AssignmentDropdownProps> = ({
  conversationId,
  currentAssignment,
  onAssignmentChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Fetch available users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['available-users'],
    queryFn: () => conversationsApi.getAvailableUsers(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const assignMutation = useMutation({
    mutationFn: (assignedToUserId?: string) => 
      conversationsApi.assignConversation(conversationId, assignedToUserId),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations-assigned'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-unassigned'] });
      
      if (onAssignmentChange) {
        onAssignmentChange();
      }
    },
  });
  
  const users = usersData?.users || [];
  const currentUser = users.find(user => user.id === currentAssignment);
  
  const handleAssign = (userId?: string) => {
    assignMutation.mutate(userId);
    setIsOpen(false);
  };
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-sm",
            currentAssignment 
              ? "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20" 
              : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"
          )}
          disabled={assignMutation.isPending}
        >
          {assignMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : currentUser ? (
            <>
              <UserIcon className="w-4 h-4" />
              <span className="font-medium">{currentUser.name}</span>
              <span className="text-xs opacity-70">(Assigned)</span>
            </>
          ) : (
            <>
              <UserPlusIcon className="w-4 h-4" />
              <span>Assign to...</span>
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-64 max-h-80 overflow-y-auto bg-card border-border"
      >
        <DropdownMenuItem
          onClick={() => handleAssign()}
          className={cn(
            "flex items-center justify-between cursor-pointer",
            !currentAssignment && "bg-primary/10 text-primary font-medium"
          )}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xs">👤</span>
            </div>
            <span>Unassigned</span>
          </div>
          {!currentAssignment && <CheckSolid className="w-4 h-4" />}
        </DropdownMenuItem>
        
        <div className="border-t border-border my-1" />
        
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Available Users
        </div>
        
        {usersLoading ? (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">
            No other users available
          </div>
        ) : (
          users.map((user) => (
            <DropdownMenuItem
              key={user.id}
              onClick={() => handleAssign(user.id)}
              className={cn(
                "flex items-center justify-between cursor-pointer",
                currentAssignment === user.id && "bg-primary/10 text-primary font-medium"
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
              {currentAssignment === user.id && <CheckSolid className="w-4 h-4" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};