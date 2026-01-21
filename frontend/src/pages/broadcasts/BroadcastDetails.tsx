// frontend/src/pages/BroadcastDetails.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PauseCircleIcon,
  DocumentDuplicateIcon,
  EllipsisVerticalIcon,
  UsersIcon,
  MegaphoneIcon,
  ChartBarIcon,
  EnvelopeIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  useBroadcast,
  useBroadcastMessages,
  useStartBroadcast,
  usePauseBroadcast,
  useDeleteBroadcast,
  useDuplicateBroadcast,
} from '@/lib/api/broadcasts';

export default function BroadcastDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  // React Query hooks
  const {
    data: broadcastData,
    isLoading: broadcastLoading,
    error: broadcastError,
  } = useBroadcast(id!);
  
  const {
    data: messagesData,
    isLoading: messagesLoading,
  } = useBroadcastMessages(id!, 1, 50);
  
  // Mutations
  const startBroadcastMutation = useStartBroadcast();
  const pauseBroadcastMutation = usePauseBroadcast();
  const deleteBroadcastMutation = useDeleteBroadcast();
  const duplicateBroadcastMutation = useDuplicateBroadcast();
  
  if (!id) {
    navigate('/broadcasts');
    return null;
  }
  
  if (broadcastLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading broadcast details...</p>
        </div>
      </div>
    );
  }
  
  if (broadcastError || !broadcastData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">Broadcast not found</h3>
          <p className="text-muted-foreground mt-2">The broadcast you're looking for doesn't exist.</p>
          <Button className="mt-4" onClick={() => navigate('/broadcasts')}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Broadcasts
          </Button>
        </div>
      </div>
    );
  }
  
  const { broadcast } = broadcastData;
  const messages = messagesData?.messages || [];
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'scheduled':
        return <ClockIcon className="w-5 h-5" />;
      case 'sending':
        return <PaperAirplaneIcon className="w-5 h-5" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5" />;
      case 'paused':
        return <PauseCircleIcon className="w-5 h-5" />;
      default:
        return null;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-crm-success/10 text-crm-success';
      case 'scheduled':
        return 'bg-crm-warning/10 text-crm-warning';
      case 'sending':
        return 'bg-primary/10 text-primary';
      case 'failed':
        return 'bg-destructive/10 text-destructive';
      case 'paused':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };
  
  const handleStartBroadcast = async () => {
    try {
      await startBroadcastMutation.mutateAsync(id!);
      toast.success('Broadcast started successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start broadcast');
    }
  };
  
  const handlePauseBroadcast = async () => {
    try {
      await pauseBroadcastMutation.mutateAsync(id!);
      toast.success('Broadcast paused successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to pause broadcast');
    }
  };
  
  const handleDuplicateBroadcast = async () => {
    try {
      const newName = prompt('Enter a name for the duplicate:', `${broadcast.name} - Copy`);
      if (!newName) return;
      
      await duplicateBroadcastMutation.mutateAsync({ id: id!, name: newName });
      toast.success('Broadcast duplicated successfully');
      navigate('/broadcasts');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to duplicate broadcast');
    }
  };
  
  const handleDeleteBroadcast = async () => {
    if (!window.confirm(`Are you sure you want to delete "${broadcast.name}"?`)) return;
    
    try {
      await deleteBroadcastMutation.mutateAsync(id!);
      toast.success('Broadcast deleted successfully');
      navigate('/broadcasts');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete broadcast');
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/broadcasts')}>
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{broadcast.name}</h1>
              <Badge className={`gap-1 ${getStatusColor(broadcast.status)}`}>
                {getStatusIcon(broadcast.status)}
                {broadcast.status.charAt(0).toUpperCase() + broadcast.status.slice(1)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {broadcast.description || 'No description'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {broadcast.status === 'draft' && (
            <Button className="gap-2" onClick={handleStartBroadcast}>
              <PaperAirplaneIcon className="w-4 h-4" />
              Start Broadcast
            </Button>
          )}
          
          {broadcast.status === 'scheduled' && (
            <Button className="gap-2" onClick={handleStartBroadcast}>
              <PaperAirplaneIcon className="w-4 h-4" />
              Send Now
            </Button>
          )}
          
          {broadcast.status === 'sending' && (
            <Button variant="outline" className="gap-2" onClick={handlePauseBroadcast}>
              <PauseCircleIcon className="w-4 h-4" />
              Pause
            </Button>
          )}
          
          {broadcast.status === 'paused' && (
            <Button className="gap-2" onClick={handleStartBroadcast}>
              <PaperAirplaneIcon className="w-4 h-4" />
              Resume
            </Button>
          )}
          
          <Button variant="outline" className="gap-2" onClick={handleDuplicateBroadcast}>
            <DocumentDuplicateIcon className="w-4 h-4" />
            Duplicate
          </Button>
          
          <Button variant="destructive" className="gap-2" onClick={handleDeleteBroadcast}>
            <TrashIcon className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-4 h-4" />
                Recipients
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{broadcast.audienceCount.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <MegaphoneIcon className="w-4 h-4" />
                Sent
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{broadcast.stats.sent.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <EnvelopeIcon className="w-4 h-4" />
                Delivered
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{broadcast.stats.delivered.toLocaleString()}</div>
            {broadcast.stats.total > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round((broadcast.stats.delivered / broadcast.stats.total) * 100)}% rate
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <EyeIcon className="w-4 h-4" />
                Read
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{broadcast.stats.read.toLocaleString()}</div>
            {broadcast.stats.delivered > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round((broadcast.stats.read / broadcast.stats.delivered) * 100)}% rate
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <XCircleIcon className="w-4 h-4" />
                Failed
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{broadcast.stats.failed.toLocaleString()}</div>
            {broadcast.stats.total > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round((broadcast.stats.failed / broadcast.stats.total) * 100)}% rate
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Broadcast Details */}
            <Card>
              <CardHeader>
                <CardTitle>Broadcast Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                    <p className="text-sm">{formatDate(broadcast.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                    <p className="text-sm">{formatDate(broadcast.updatedAt)}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Schedule</p>
                  <p className="text-sm">
                    {broadcast.scheduledAt 
                      ? `Scheduled for ${formatDate(broadcast.scheduledAt)}`
                      : 'Send immediately'
                    }
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Audience Type</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">
                      {broadcast.audienceType === 'all' ? 'All Contacts' :
                       broadcast.audienceType === 'tags' ? 'By Tags' :
                       broadcast.audienceType === 'contacts' ? 'Specific Contacts' : 'Segments'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      ({broadcast.audienceCount} recipients)
                    </span>
                  </div>
                </div>
                
                {broadcast.template && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Template</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{broadcast.template.category}</Badge>
                      <span className="text-sm">{broadcast.template.name}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <ChartBarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Performance chart will appear here</p>
                    <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Message Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {messagesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No messages found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {message.contact?.name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{message.contact?.name || 'Unknown Contact'}</p>
                            <p className="text-xs text-muted-foreground">{message.contact?.phone}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className={
                            message.status === 'sent' || message.status === 'delivered' ? 'bg-crm-success/10 text-crm-success' :
                            message.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                            'bg-muted'
                          }>
                            {message.status}
                          </Badge>
                          
                          {message.error && (
                            <div className="text-xs text-destructive max-w-[200px] truncate">
                              {message.error}
                            </div>
                          )}
                          
                          <div className="text-xs text-muted-foreground">
                            {message.sentAt ? formatDate(message.sentAt) : 'Pending'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <ChartBarIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Analytics dashboard coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Broadcast Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Danger Zone</h3>
                  <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-destructive">Delete Broadcast</p>
                        <p className="text-sm text-muted-foreground">
                          Once deleted, this broadcast cannot be recovered.
                        </p>
                      </div>
                      <Button variant="destructive" onClick={handleDeleteBroadcast}>
                        <TrashIcon className="w-4 h-4 mr-2" />
                        Delete Broadcast
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}