// frontend/src/components/chat/BotDialog.tsx
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  Zap,
  Play,
  Pause,
  Sparkles,
  Clock,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Settings,
  Search,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { automationsApi } from "@/lib/api/automations";

interface Automation {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "archived";
  trigger_type?: string;
  updated_at: string;
  created_at: string;
  totalRuns?: number;
  user_id?: string;
}

interface BotDialogProps {
  conversationId: string | null;
  contact?: any;
  user?: any;
  conversation?: any;
  onAutomationSelect?: (automationId: string) => void;
  onAutomationStop?: () => void;
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
};

const getAutomationStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-500/10 text-green-600";
    case "paused":
      return "bg-amber-500/10 text-amber-600";
    case "draft":
      return "bg-blue-500/10 text-blue-600";
    default:
      return "bg-gray-500/10 text-gray-600";
  }
};

const getAutomationStatusText = (status: string) => {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "draft":
      return "Draft";
    case "archived":
      return "Archived";
    default:
      return status;
  }
};

export const BotDialog: React.FC<BotDialogProps> = ({
  conversationId,
  contact,
  user,
  conversation,
  onAutomationSelect,
  onAutomationStop,
}) => {
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [automationActive, setAutomationActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Fetch automations
  const { data: automationsData, isLoading: automationsLoading } = useQuery({
    queryKey: ["automations"],
    queryFn: () =>
      automationsApi.getAutomations({
        page: 1,
        limit: 50,
        status: "active",
      }),
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  const automations = automationsData?.data || [];

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter automations by search query
  const filteredAutomations = useMemo(() => {
    if (!debouncedSearch) return automations;
    
    return automations.filter(automation => {
      const searchLower = debouncedSearch.toLowerCase();
      return (
        automation.name.toLowerCase().includes(searchLower) ||
        (automation.description?.toLowerCase() || '').includes(searchLower) ||
        automation.status.toLowerCase().includes(searchLower)
      );
    });
  }, [automations, debouncedSearch]);

  // Check if conversation has active automation
  useEffect(() => {
    const checkConversationAutomation = async () => {
      if (!conversationId || !user?.id) {
        setSelectedAutomationId(null);
        setAutomationActive(false);
        return;
      }

      const activeAutomation = localStorage.getItem(
        `conversation_${conversationId}_automation`
      );
      if (activeAutomation) {
        setSelectedAutomationId(activeAutomation);
        setAutomationActive(true);
      } else {
        setSelectedAutomationId(null);
        setAutomationActive(false);
      }
    };

    checkConversationAutomation();
  }, [conversationId, user?.id]);

  const handleTriggerAutomation = async (automationId: string) => {
    if (!conversationId || !contact || !user) {
      toast({
        title: "Cannot trigger automation",
        description: "Please select a conversation first",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await automationsApi.triggerAutomation(automationId, {
        contactId: contact.id,
        triggerData: {
          manual_trigger: true,
          conversation_id: conversationId,
        },
      });

      if (response?.success) {
        setSelectedAutomationId(automationId);
        setAutomationActive(true);

        localStorage.setItem(
          `conversation_${conversationId}_automation`,
          automationId
        );

        toast({
          title: "Automation activated",
          description: "Automation is now handling this conversation",
          variant: "default",
        });

        if (onAutomationSelect) {
          onAutomationSelect(automationId);
        }
      } else {
        throw new Error(response?.error || "Failed to trigger automation");
      }
    } catch (error: any) {
      console.error("Error triggering automation:", error);
      toast({
        title: "Failed to activate automation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleStopAutomation = () => {
    if (!conversationId) return;

    localStorage.removeItem(`conversation_${conversationId}_automation`);

    setSelectedAutomationId(null);
    setAutomationActive(false);

    toast({
      title: "Automation stopped",
      description: "You are now handling this conversation",
      variant: "default",
    });

    if (onAutomationStop) {
      onAutomationStop();
    }
  };

  const handleManageAutomations = () => {
    window.open("/automations", "_blank");
  };

  const selectedAutomation = automations.find(
    (a) => a.id === selectedAutomationId
  );

  const hasActiveAutomation = automationActive && selectedAutomation;

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full shrink-0 hover:bg-primary/10 transition-colors",
                  automationActive && "bg-primary/10 text-primary"
                )}
              >
                <Bot className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Automations</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent
        align="start"
        className="w-96 max-h-[80vh] overflow-y-auto bg-popover shadow-xl border-border"
        sideOffset={8}
      >
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">Automations</h3>
              {hasActiveAutomation && (
                <Badge
                  variant="default"
                  className="text-xs px-2 py-0.5 flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManageAutomations}
              className="text-xs h-7 hover:bg-accent/50"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Manage
            </Button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search automations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 h-9 text-sm"
            />
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Active Automation Section */}
        {hasActiveAutomation && (
          <>
            <div className="p-4 pb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Play className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Active Automation</h4>
                    <p className="text-xs text-muted-foreground">
                      Currently handling this conversation
                    </p>
                  </div>
                </div>
                <Badge
                  className={cn(
                    "px-2 py-1 text-xs",
                    getAutomationStatusColor(selectedAutomation.status)
                  )}
                >
                  {getAutomationStatusText(selectedAutomation.status)}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <span className="text-sm font-medium">
                    {selectedAutomation.name}
                  </span>
                  {selectedAutomation.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {selectedAutomation.description}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Label htmlFor="automation-toggle" className="text-sm">
                    Automation Status
                  </Label>
                  <Switch
                    id="automation-toggle"
                    checked={automationActive}
                    onCheckedChange={handleStopAutomation}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>
            </div>

            <DropdownMenuSeparator />
          </>
        )}

        {/* Available Automations Section */}
        <div className="p-4 pb-2">
          {automationsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                  <Skeleton className="w-12 h-5 rounded-full" />
                </div>
              ))}
            </div>
          ) : filteredAutomations.length === 0 ? (
            <div className="text-center py-8">
              {searchQuery ? (
                <>
                  <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No automations found for "{searchQuery}"
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Try a different search term
                  </p>
                </>
              ) : (
                <>
                  <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No automations available
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Create automations to handle conversations automatically
                  </p>
                  <Button
                    onClick={handleManageAutomations}
                    size="sm"
                    className="hover:bg-accent/90"
                  >
                    <Sparkles className="h-3 w-3 mr-2" />
                    Create Automation
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                {filteredAutomations.length} automation{filteredAutomations.length !== 1 ? 's' : ''} found
              </p>
              
              <div className="space-y-2">
                {filteredAutomations.map((automation) => {
                  const isSelected = selectedAutomationId === automation.id;
                  
                  return (
                    <div
                      key={automation.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                        isSelected
                          ? "border-primary/30 bg-primary/5"
                          : "border-transparent hover:border-border hover:bg-accent/30"
                      )}
                      onClick={() => handleTriggerAutomation(automation.id)}
                    >
                      {/* Radio Button */}
                      <div className="flex items-center justify-center">
                        <div className="relative">
                          <Circle className={cn(
                            "w-4 h-4",
                            isSelected
                              ? "text-primary"
                              : "text-muted-foreground"
                          )} />
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-primary absolute top-0 left-0" fill="currentColor" />
                          )}
                        </div>
                      </div>

                      {/* Automation Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate">
                            {automation.name}
                          </span>
                          <Badge
                            className={cn(
                              "text-xs px-2 py-0.5",
                              getAutomationStatusColor(automation.status)
                            )}
                          >
                            {getAutomationStatusText(automation.status)}
                          </Badge>
                        </div>
                        
                        {automation.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {automation.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Information */}
        <DropdownMenuSeparator />
        <div className="p-4 pt-2">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <p>
              Automations will monitor this conversation and respond automatically.
            </p>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};