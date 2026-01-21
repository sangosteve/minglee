// frontend/src/pages/Broadcasts.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MegaphoneIcon,
  PlusIcon,
  PaperAirplaneIcon,
  ClockIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XCircleIcon,
  PauseCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

// Import the new hooks
import {
  useBroadcasts,
  useBroadcastStats,
  useDeleteBroadcast,
  useStartBroadcast,
  usePauseBroadcast,
  useDuplicateBroadcast,
  Broadcast,
} from '@/lib/api/broadcasts';
import { useApprovedTemplates } from '@/lib/api/templates';
import { useContacts } from '@/lib/api/contacts';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'sent':
      return 'bg-crm-success/10 text-crm-success border-crm-success/20';
    case 'scheduled':
      return 'bg-crm-warning/10 text-crm-warning border-crm-warning/20';
    case 'draft':
      return 'bg-muted text-muted-foreground border-border';
    case 'sending':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'failed':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'paused':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'sent':
      return <CheckCircleIcon className="w-4 h-4" />;
    case 'scheduled':
      return <ClockIcon className="w-4 h-4" />;
    case 'sending':
      return <PaperAirplaneIcon className="w-4 h-4" />;
    case 'failed':
      return <XCircleIcon className="w-4 h-4" />;
    case 'paused':
      return <PauseCircleIcon className="w-4 h-4" />;
    default:
      return null;
  }
};

export default function Broadcasts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // React Query hooks
  const {
    data: broadcastsData,
    isLoading: broadcastsLoading,
    refetch: refetchBroadcasts,
  } = useBroadcasts({
    search: debouncedSearch,
    status: filterStatus === 'all' ? undefined : filterStatus,
    limit: 10,
    page: 1,
  });
  
  const {
    data: stats,
    isLoading: statsLoading,
  } = useBroadcastStats();
  
  const {
    data: approvedTemplates,
    isLoading: templatesLoading,
  } = useApprovedTemplates();

  // Get contacts count for "All Contacts" audience calculation
  const { data: contactsData } = useContacts({
    limit: 1,
    page: 1,
  });
  
  // Mutations
  const deleteBroadcastMutation = useDeleteBroadcast();
  const startBroadcastMutation = useStartBroadcast();
  const pauseBroadcastMutation = usePauseBroadcast();
  const duplicateBroadcastMutation = useDuplicateBroadcast();
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search]);
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const getStatusMessage = (broadcast: Broadcast) => {
    switch (broadcast.status) {
      case 'scheduled':
        return `Scheduled for ${formatDateTime(broadcast.scheduledAt)}`;
      case 'sent':
        return `Sent on ${formatDateTime(broadcast.sentAt)}`;
      case 'sending':
        return `Sending... ${broadcast.stats.sent}/${broadcast.stats.total} sent`;
      case 'failed':
        return 'Failed to send';
      case 'paused':
        return 'Paused';
      case 'draft':
        return 'Not scheduled';
      default:
        return '';
    }
  };
  
  const handleDeleteBroadcast = async (broadcastId: string, broadcastName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${broadcastName}"?`)) return;
    
    try {
      await deleteBroadcastMutation.mutateAsync(broadcastId);
      toast.success('Broadcast deleted successfully');
    } catch (error: any) {
      console.error('Error deleting broadcast:', error);
      toast.error(error.response?.data?.error || 'Failed to delete broadcast');
    }
  };
  
  const handleStartBroadcast = async (broadcastId: string) => {
    try {
      await startBroadcastMutation.mutateAsync(broadcastId);
      toast.success('Broadcast started successfully');
    } catch (error: any) {
      console.error('Error starting broadcast:', error);
      toast.error(error.response?.data?.error || 'Failed to start broadcast');
    }
  };
  
  const handlePauseBroadcast = async (broadcastId: string) => {
    try {
      await pauseBroadcastMutation.mutateAsync(broadcastId);
      toast.success('Broadcast paused successfully');
    } catch (error: any) {
      console.error('Error pausing broadcast:', error);
      toast.error(error.response?.data?.error || 'Failed to pause broadcast');
    }
  };
  
  const handleDuplicateBroadcast = async (broadcastId: string, broadcastName: string) => {
    try {
      const newName = prompt('Enter a name for the duplicate:', `${broadcastName} - Copy`);
      if (!newName) return;
      
      await duplicateBroadcastMutation.mutateAsync({ id: broadcastId, name: newName });
      toast.success('Broadcast duplicated successfully');
    } catch (error: any) {
      console.error('Error duplicating broadcast:', error);
      toast.error(error.response?.data?.error || 'Failed to duplicate broadcast');
    }
  };
  
  const handleSearch = (value: string) => {
    setSearch(value);
  };
  
  const handleFilter = (status: string) => {
    setFilterStatus(status);
  };
  
  // Get top templates for the sidebar
  const topTemplates = approvedTemplates?.slice(0, 4).map((template, index) => ({
    id: template.id,
    name: template.name,
    category: template.category || 'General',
    uses: Math.floor(Math.random() * 300) + 50, // Placeholder - replace with actual stats
  })) || [];
  
  if (broadcastsLoading && !broadcastsData) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        
        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }
  
  const broadcasts = broadcastsData?.broadcasts || [];
  const pagination = broadcastsData?.pagination;
  const totalContactsCount = contactsData?.pagination?.total || 0;
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Broadcasts</h1>
          <p className="text-muted-foreground mt-1">
            Send bulk messages to your contacts
          </p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/broadcasts/create')}>
          <PlusIcon className="w-4 h-4" />
          New Broadcast
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MegaphoneIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
              <p className="text-sm text-muted-foreground">Total Broadcasts</p>
            </div>
          </div>
        </div>
        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-crm-success/10">
              <CheckCircleIcon className="w-5 h-5 text-crm-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats?.byStatus?.find(s => s.status === 'sent')?.count || 0}
              </p>
              <p className="text-sm text-muted-foreground">Sent</p>
            </div>
          </div>
        </div>
        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-crm-warning/10">
              <ClockIcon className="w-5 h-5 text-crm-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats?.byStatus?.find(s => s.status === 'scheduled')?.count || 0}
              </p>
              <p className="text-sm text-muted-foreground">Scheduled</p>
            </div>
          </div>
        </div>
        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <DocumentDuplicateIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats?.byStatus?.find(s => s.status === 'draft')?.count || 0}
              </p>
              <p className="text-sm text-muted-foreground">Drafts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Broadcasts List */}
        <div className="lg:col-span-2 card-gradient rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Broadcasts</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search broadcasts..." 
                  className="pl-9 w-48" 
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <FunnelIcon className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleFilter('all')}>
                    All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFilter('draft')}>
                    Drafts
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFilter('scheduled')}>
                    Scheduled
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFilter('sending')}>
                    Sending
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFilter('sent')}>
                    Sent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFilter('failed')}>
                    Failed
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFilter('paused')}>
                    Paused
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetchBroadcasts()}
                disabled={broadcastsLoading}
              >
                <ArrowPathIcon className={`w-4 h-4 ${broadcastsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {broadcasts.length === 0 ? (
              <div className="text-center py-8">
                <MegaphoneIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-foreground">No broadcasts yet</h3>
                <p className="text-muted-foreground mt-1">
                  {search || filterStatus !== 'all' 
                    ? 'No broadcasts match your search criteria'
                    : 'Create your first broadcast to start sending messages'
                  }
                </p>
                {!search && filterStatus === 'all' && (
                  <Button className="mt-4" onClick={() => navigate('/broadcasts/create')}>
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Create Broadcast
                  </Button>
                )}
              </div>
            ) : (
              <>
                {broadcasts.map((broadcast) => (
                  <div
                    key={broadcast.id}
                    className="p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground hover:text-primary cursor-pointer"
                              onClick={() => navigate(`/broadcasts/${broadcast.id}`)}>
                            {broadcast.name}
                          </h3>
                          <Badge variant="outline" className={getStatusColor(broadcast.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(broadcast.status)}
                              {broadcast.status}
                            </span>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getStatusMessage(broadcast)}
                        </p>
                        
                        {broadcast.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
                            {broadcast.description}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <EllipsisVerticalIcon className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => navigate(`/broadcasts/${broadcast.id}`)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/broadcasts/create?duplicate=${broadcast.id}`)}>
                            Duplicate
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          {broadcast.status === 'draft' && (
                            <DropdownMenuItem 
                              onClick={() => handleStartBroadcast(broadcast.id)}
                              className="text-primary"
                            >
                              <PaperAirplaneIcon className="w-4 h-4 mr-2" />
                              Start Now
                            </DropdownMenuItem>
                          )}
                          
                          {broadcast.status === 'scheduled' && (
                            <DropdownMenuItem 
                              onClick={() => handleStartBroadcast(broadcast.id)}
                              className="text-primary"
                            >
                              <PaperAirplaneIcon className="w-4 h-4 mr-2" />
                              Send Now
                            </DropdownMenuItem>
                          )}
                          
                          {broadcast.status === 'sending' && (
                            <DropdownMenuItem 
                              onClick={() => handlePauseBroadcast(broadcast.id)}
                              className="text-amber-600"
                            >
                              <PauseCircleIcon className="w-4 h-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          )}
                          
                          {broadcast.status === 'paused' && (
                            <DropdownMenuItem 
                              onClick={() => handleStartBroadcast(broadcast.id)}
                              className="text-primary"
                            >
                              <PaperAirplaneIcon className="w-4 h-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            onClick={() => handleDuplicateBroadcast(broadcast.id, broadcast.name)}
                            className="text-muted-foreground"
                          >
                            <DocumentDuplicateIcon className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem 
                            onClick={() => handleDeleteBroadcast(broadcast.id, broadcast.name)}
                            className="text-destructive"
                          >
                            <XCircleIcon className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {broadcast.status !== 'draft' && (
                      <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border/50">
                        <div>
                          <p className="text-xs text-muted-foreground">Recipients</p>
                          <p className="font-medium text-foreground">
                            {broadcast.audienceCount.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Sent</p>
                          <p className="font-medium text-foreground">
                            {broadcast.stats.sent.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Delivered</p>
                          <p className="font-medium text-foreground">
                            {broadcast.stats.delivered.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Read</p>
                          <p className="font-medium text-foreground">
                            {broadcast.stats.read.toLocaleString()}
                          </p>
                        </div>
                        {broadcast.stats.delivered > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground">Read Rate</p>
                            <p className="font-medium text-crm-success">
                              {((broadcast.stats.read / broadcast.stats.delivered) * 100).toFixed(1)}%
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <p className="text-sm text-muted-foreground">
                      Showing {broadcasts.length} of {pagination.total} broadcasts
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === 1}
                        onClick={() => {
                          // Handle previous page
                        }}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === pagination.pages}
                        onClick={() => {
                          // Handle next page
                        }}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Templates Sidebar */}
        <div className="card-gradient rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Message Templates</h2>
            <Button variant="outline" size="sm" onClick={() => navigate('/templates')}>
              <PlusIcon className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>

          <div className="space-y-3">
            {templatesLoading ? (
              [...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))
            ) : topTemplates.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No approved templates yet</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => navigate('/templates')}
                >
                  Create Template
                </Button>
              </div>
            ) : (
              topTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50 cursor-pointer group"
                  onClick={() => navigate(`/templates/${template.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {template.category}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {template.uses} uses
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}