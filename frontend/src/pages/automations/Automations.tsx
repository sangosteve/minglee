// frontend/src/pages/Automations.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EllipsisHorizontalIcon,
  PlayIcon,
  PauseIcon,
  ClockIcon,
  BoltIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import {
  PlayIcon as PlaySolid,
  PauseIcon as PauseSolid,
} from "@heroicons/react/24/solid";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateAutomationDialog } from "@/components/automations/CreateAutomationDialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useAutomations,
  useDeleteAutomation,
  useUpdateAutomationStatus,
  type AutomationWorkflow,
} from "@/lib/api/automations";
import { format, formatDistanceToNow, isValid } from 'date-fns';

// Helper functions
const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return "N/A";
    
    return format(date, 'MMM d, h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error);
    return "N/A";
  }
};

const formatRelativeTime = (dateString: string) => {
  if (!dateString) return "N/A";
  
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return "N/A";
    
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return "N/A";
  }
};

const getNodeCount = (flowData: any) => {
  if (!flowData || !flowData.nodes) return 0;
  return flowData.nodes.filter((node: any) => node.type !== 'startNode').length;
};

const getIconForTrigger = (triggerType?: string) => {
  if (!triggerType) return "⚡";

  const icons: { [key: string]: string } = {
    message_received: "👋",
    keyword: "🔍",
    tag_added: "🏷️",
    campaign_reply: "📧",
    time_delay: "⏰",
    manual: "👋", // Add manual
  };
  return icons[triggerType] || "⚡";
};

const getStatusConfig = (status: string) => {
  const configs = {
    active: {
      label: "Active",
      color: "bg-success/10 text-success border-success/20",
      icon: PlaySolid
    },
    paused: {
      label: "Paused",
      color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      icon: PauseSolid
    },
    draft: {
      label: "Draft",
      color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      icon: PencilIcon
    },
    archived: {
      label: "Archived",
      color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      icon: ClockIcon
    },
  };
  return configs[status as keyof typeof configs] || configs.draft;
};

// Stats cards component
const StatsCards = () => {
  // For now, we'll calculate stats from data
  // In a real app, you'd use useAutomationStats()
  const { data: automationsData } = useAutomations();
  const automations = automationsData?.data || [];

  const stats = {
    totalActive: automations.filter((a: AutomationWorkflow) => a.status === 'active').length,
    totalDraft: automations.filter((a: AutomationWorkflow) => a.status === 'draft').length,
    totalPaused: automations.filter((a: AutomationWorkflow) => a.status === 'paused').length,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-card rounded-xl p-4 border border-border">
        <p className="text-sm text-muted-foreground">Active Automations</p>
        <p className="text-2xl font-bold text-success mt-1">{stats.totalActive}</p>
      </div>
      <div className="bg-card rounded-xl p-4 border border-border">
        <p className="text-sm text-muted-foreground">Draft Automations</p>
        <p className="text-2xl font-bold text-blue-500 mt-1">{stats.totalDraft}</p>
      </div>
      <div className="bg-card rounded-xl p-4 border border-border">
        <p className="text-sm text-muted-foreground">Paused Automations</p>
        <p className="text-2xl font-bold text-amber-500 mt-1">{stats.totalPaused}</p>
      </div>
    </div>
  );
};

const Automations = () => {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: "",
    status: "",
  });

  const {
    data: automationsData,
    isLoading: automationsLoading,
    error: automationsError,
    refetch
  } = useAutomations(filters);

  const deleteAutomationMutation = useDeleteAutomation();
  const updateStatusMutation = useUpdateAutomationStatus();

  const automations = automationsData?.data || [];
  const pagination = automationsData?.pagination;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({
        ...prev,
        search: searchQuery || "",
        status: statusFilter !== "all" ? statusFilter : "",
        page: 1
      }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  const handleCreateAutomation = () => {
    setCreateDialogOpen(true);
  };

  const handleEditAutomation = (id: string) => {
    navigate(`/automations/${id}/edit`);
  };

  const handleViewAutomation = (id: string) => {
    navigate(`/automations/${id}`);
  };

  const toggleAutomationStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      await updateStatusMutation.mutateAsync({ id, status: newStatus });
      toast({
        title: `Automation ${newStatus === 'active' ? 'activated' : 'paused'}`,
        description: `Automation has been ${newStatus === 'active' ? 'activated' : 'paused'} successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update automation status.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAutomation = async (automation: AutomationWorkflow) => {
    if (window.confirm(`Are you sure you want to delete "${automation.name}"? This action cannot be undone.`)) {
      try {
        await deleteAutomationMutation.mutateAsync(automation.id);
        toast({
          title: "Automation deleted",
          description: "Automation has been deleted successfully.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete automation.",
          variant: "destructive",
        });
      }
    }
  };

  const handleCreateSuccess = (automationId: string) => {
    // Redirect to builder with the new automation ID
    navigate(`/automations/${automationId}/edit`);
  }

  if (automationsError) {
    return (

      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <PauseIcon className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Failed to load automations</h3>
          <p className="text-muted-foreground mb-4">
            {automationsError instanceof Error ? automationsError.message : "Unknown error occurred"}
          </p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>

    );
  }

  return (

    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <BoltIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Automations
              </h1>
              <p className="text-muted-foreground text-lg">
                Create and manage automated message workflows
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleCreateAutomation}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6"
          disabled={automationsLoading}
        >
          <PlusIcon className="h-5 w-5" />
          Create Automation
        </Button>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Filters and Search */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search automations by name, description, or trigger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {automationsLoading ? (
        <div className="grid gap-4">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="bg-card rounded-xl p-6 border border-border animate-pulse"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div>
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
                <Skeleton className="w-8 h-8 rounded" />
              </div>
              <Skeleton className="h-4 w-3/4 mt-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-lg bg-muted flex items-center justify-center mb-4">
            <ClockIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {searchQuery || statusFilter !== "all" ? "No automations found" : "No automations yet"}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Create your first automation to start automating your WhatsApp messages"}
          </p>
          {!(searchQuery || statusFilter !== "all") && (
            <Button
              onClick={handleCreateAutomation}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <PlusIcon className="h-4 w-4" />
              Create Automation
            </Button>
          )}
        </div>
      ) : (
        /* Automations List */
        <div className="grid gap-4">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className="bg-card rounded-xl p-6 border border-border hover:border-border/70 transition-colors cursor-pointer group"
              onClick={() => handleViewAutomation(automation.id)}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="flex gap-4 flex-1">
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-xl">
                    {getIconForTrigger(automation.trigger_type || "manual")}
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-foreground text-lg">
                        {automation.name}
                      </h3>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "inline-flex items-center gap-1",
                          getStatusConfig(automation.status).color
                        )}
                      >
                        {(() => {
                          const Icon = getStatusConfig(automation.status).icon;
                          return Icon && <Icon className="w-3 h-3" />;
                        })()}
                        {getStatusConfig(automation.status).label}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground leading-relaxed">
                      {automation.description || "No description provided"}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">TRIGGER</p>
                        <p className="text-sm font-medium text-foreground capitalize">
                           {(automation.trigger_type || "manual").replace('_', ' ')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">NODES</p>
                        <p className="text-sm font-medium text-foreground">
                          {getNodeCount(automation.flow_data)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">CREATED</p>
                        <p className="text-sm font-medium text-foreground">
                          {formatRelativeTime(automation.created_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">UPDATED</p>
                        <p className="text-sm font-medium text-foreground">
                          {formatRelativeTime(automation.updated_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 lg:flex-col lg:items-end">
                  <div className="flex items-center gap-3">
                    {automation.status !== 'draft' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAutomationStatus(automation.id, automation.status);
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          automation.status === "active"
                            ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                            : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                        )}
                      >
                        {automation.status === "active" ? (
                          <PauseIcon className="h-4 w-4" />
                        ) : (
                          <PlayIcon className="h-4 w-4" />
                        )}
                      </button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAutomation(automation.id);
                      }}
                      className="border-border hover:bg-accent"
                    >
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Edit
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleEditAutomation(automation.id)}>
                          <PencilIcon className="h-4 w-4 mr-2" />
                          Edit Automation
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <ChartBarIcon className="h-4 w-4 mr-2" />
                          View Analytics
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteAutomation(automation)}
                        >
                          <TrashIcon className="h-4 w-4 mr-2" />
                          Delete Automation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} automations
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters(prev => ({
                ...prev,
                page: Math.max((prev.page || 1) - 1, 1)
              }))}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters(prev => ({
                ...prev,
                page: Math.min((prev.page || 1) + 1, pagination.pages)
              }))}
              disabled={pagination.page === pagination.pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <CreateAutomationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>

  );
};

export default Automations;