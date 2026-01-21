// frontend/src/pages/templates/Templates.tsx - UPDATED
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Filter, 
  LayoutGrid, 
  List, 
  CheckCircle, 
  Clock, 
  XCircle,
  FileText,
  ChevronDown
} from "lucide-react";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  useTemplates, 
  useSyncWhatsAppTemplates, 
  useDeleteTemplate,
  type Template,
  type TemplateStatus 
} from "@/lib/api/templates";
import { Skeleton } from "@/components/ui/skeleton";

const Templates = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TemplateStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSyncing, setIsSyncing] = useState(false);

  // Use React Query hooks
  const { 
    data: templatesResponse, 
    isLoading, 
    error, 
    refetch 
  } = useTemplates({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    search: searchQuery || undefined,
  });

  const syncTemplatesMutation = useSyncWhatsAppTemplates();
  const deleteTemplateMutation = useDeleteTemplate();

  const templates = templatesResponse?.data || [];
  const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean)));

  const handleSyncWithMeta = async () => {
    setIsSyncing(true);
    try {
      const result = await syncTemplatesMutation.mutateAsync();
      if (result.success) {
        toast.success("Templates synced successfully", {
          description: `${result.count || 0} templates synced from WhatsApp`
        });
        refetch();
      } else {
        toast.error("Failed to sync templates", {
          description: result.error
        });
      }
    } catch (error) {
      toast.error("Sync failed", {
        description: "An unexpected error occurred"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplateMutation.mutateAsync(id);
      toast.success("Template deleted");
      refetch();
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const handleDuplicate = (template: Template) => {
    // Navigate to create page with template data for duplication
    navigate('/templates/create', { 
      state: { 
        duplicateTemplate: template,
        mode: 'duplicate' 
      } 
    });
  };

  const handleEdit = (id: string) => {
    navigate(`/templates/${id}/edit`);
  };

  const handleView = (id: string) => {
    navigate(`/templates/${id}`);
  };

  const handleSend = (id: string) => {
    navigate(`/templates/${id}/send`);
  };

  const statusCounts = {
    all: templates.length,
    approved: templates.filter(t => t.status === 'approved').length,
    pending: templates.filter(t => t.status === 'pending').length,
    rejected: templates.filter(t => t.status === 'rejected').length,
    disabled: templates.filter(t => t.status === 'disabled').length,
  };

  if (error) {
    return (
     
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Error Loading Templates</h1>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Failed to load templates"}
            </p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      
    );
  }

  return (

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Message Templates</h1>
            <p className="text-muted-foreground mt-1">
              Manage your WhatsApp message templates approved by Meta
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={handleSyncWithMeta}
              disabled={isSyncing || syncTemplatesMutation.isPending}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing || syncTemplatesMutation.isPending ? 'Syncing...' : 'Sync with Meta'}
            </Button>
            <Button onClick={() => navigate('/templates/create')} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </div>
        </div>

        {/* Stats Cards - Show loading skeletons */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('all')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{statusCounts.all}</p>
                    <p className="text-sm text-muted-foreground">Total Templates</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('approved')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{statusCounts.approved}</p>
                    <p className="text-sm text-muted-foreground">Approved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('pending')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-100">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{statusCounts.pending}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('rejected')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{statusCounts.rejected}</p>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as TemplateStatus | 'all')}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
                <TabsTrigger value="disabled">Disabled</TabsTrigger>
              </TabsList>
            </Tabs>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Category
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCategoryFilter('all')}>
                  All Categories
                </DropdownMenuItem>
                {categories.map(category => (
                  <DropdownMenuItem 
                    key={category} 
                    onClick={() => setCategoryFilter(category)}
                  >
                    {category}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center border rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Templates Grid/List - Show loading skeletons */}
        {isLoading ? (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
            : 'space-y-3'
          }>
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-20 w-full mb-4" />
                  <div className="flex justify-between">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No templates found</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                  ? "Try adjusting your filters or search query"
                  : "Create your first WhatsApp message template to get started"}
              </p>
              <Button onClick={() => navigate('/templates/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
            : 'space-y-3'
          }>
            {templates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onView={() => handleView(template.id)}
                onEdit={() => handleEdit(template.id)}
                onDelete={() => handleDelete(template.id)}
                onDuplicate={() => handleDuplicate(template)}
                onSend={() => handleSend(template.id)}
              />
            ))}
          </div>
        )}
      </div>
   
  );
};

export default Templates;