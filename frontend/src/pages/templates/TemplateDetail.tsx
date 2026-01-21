// frontend/src/pages/templates/TemplateDetail.tsx - UPDATED (Partial - Integration Points)
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  Edit, 
  Copy, 
  Trash2, 
  Send, 
  Globe, 
  Calendar,
  AlertTriangle,
  Info,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { TemplateStatusBadge } from "@/components/templates/TemplateStatusBadge";
import { TemplateCategoryBadge } from "@/components/templates/TemplateCategoryBadge";
import { TemplatePreview } from "@/components/templates/TemplatePreview";
import { format } from "date-fns";
import { toast } from "sonner";
import { 
  useTemplate, 
  useDeleteTemplate,
  useRefreshTemplateStatus,
  type Template 
} from "@/lib/api/templates";
import { Skeleton } from "@/components/ui/skeleton";

const TemplateDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: templateData, isLoading, error, refetch } = useTemplate(id || '');
  const deleteTemplateMutation = useDeleteTemplate();
  const refreshStatusMutation = useRefreshTemplateStatus();

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted rounded"></div>
            <div className="h-24 bg-muted rounded-lg"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-48 bg-muted rounded-lg"></div>
                ))}
              </div>
              <div className="lg:col-span-1">
                <div className="h-96 bg-muted rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !templateData) {
    return (
      <MainLayout>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Template Not Found</h1>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "The template you're looking for doesn't exist."}
            </p>
            <Button onClick={() => navigate('/templates')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const template = templateData;

  const handleDelete = async () => {
    try {
      await deleteTemplateMutation.mutateAsync(template.id);
      toast.success("Template deleted");
      navigate('/templates');
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const handleDuplicate = () => {
    navigate('/templates/create', { 
      state: { 
        duplicateTemplate: template,
        mode: 'duplicate' 
      } 
    });
  };

  const handleRefreshStatus = async () => {
    try {
      const result = await refreshStatusMutation.mutateAsync(template.id);
      if (result.success) {
        toast.success("Status refreshed", {
          description: `Template status: ${result.data.status}`
        });
        refetch();
      } else {
        toast.error("Failed to refresh status", {
          description: result.error
        });
      }
    } catch (error) {
      toast.error("Failed to refresh status");
    }
  };

  const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
  const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
  const footerComponent = template.components?.find((c: any) => c.type === 'FOOTER');
  const buttonsComponent = template.components?.find((c: any) => c.type === 'BUTTONS');

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">
                  {template.name.replace(/_/g, ' ')}
                </h1>
                <TemplateStatusBadge status={template.status} />
                <TemplateCategoryBadge category={template.category} />
                {template.metaTemplateId && (
                  <Badge variant="outline" className="text-xs">
                    Meta ID: {template.metaTemplateId.substring(0, 8)}...
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  {template.language}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {template.createdAt && format(new Date(template.createdAt), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {template.metaTemplateId && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefreshStatus}
                disabled={refreshStatusMutation.isPending}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshStatusMutation.isPending ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
            )}
            {template.status === 'approved' && (
              <Button className="gap-2">
                <Send className="h-4 w-4" />
                Send Message
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(`/templates/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Rejection Alert */}
        {template.status === 'rejected' && template.meta_review_feedback && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Template Rejected</AlertTitle>
            <AlertDescription>{template.meta_review_feedback}</AlertDescription>
          </Alert>
        )}

        {/* Pending Alert */}
        {template.status === 'pending' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Pending Approval</AlertTitle>
            <AlertDescription>
              This template is currently being reviewed by Meta. This usually takes 24-48 hours.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Template Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Template Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Header */}
                {headerComponent && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Header</h4>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      {headerComponent.format === 'TEXT' && (
                        <p className="font-medium">{headerComponent.text}</p>
                      )}
                      {headerComponent.format === 'IMAGE' && (
                        <Badge variant="secondary">Image Header</Badge>
                      )}
                      {headerComponent.format === 'VIDEO' && (
                        <Badge variant="secondary">Video Header</Badge>
                      )}
                      {headerComponent.format === 'DOCUMENT' && (
                        <Badge variant="secondary">Document Header</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Body */}
                {bodyComponent && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Body</h4>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="whitespace-pre-wrap">{bodyComponent.text}</p>
                      {bodyComponent.example?.body_text && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Sample values:</p>
                          <div className="flex flex-wrap gap-2">
                            {bodyComponent.example.body_text[0].map((val, idx) => (
                              <Badge key={idx} variant="outline">
                                {`{{${idx + 1}}}`} = {val}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer */}
                {footerComponent && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Footer</h4>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">{footerComponent.text}</p>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Buttons</h4>
                    <div className="space-y-2">
                      {buttonsComponent.buttons.map((button: any, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="capitalize">{button.type.replace('_', ' ')}</Badge>
                            <span className="font-medium">{button.text}</span>
                          </div>
                          {button.url && (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" />
                              {button.url}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Template Info */}
            <Card>
              <CardHeader>
                <CardTitle>Template Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Template Name</p>
                    <p className="font-medium">{template.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Language</p>
                    <p className="font-medium">{template.language}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium capitalize">{template.category}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Meta Status</p>
                    <p className={`font-medium capitalize ${
                      template.metaStatus === 'APPROVED' ? 'text-green-600' :
                      template.metaStatus === 'PENDING' ? 'text-yellow-600' :
                      template.metaStatus === 'REJECTED' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {template.metaStatus || 'N/A'}
                    </p>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {template.createdAt && format(new Date(template.createdAt), 'PPpp')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium">
                      {template.updatedAt && format(new Date(template.updatedAt), 'PPpp')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <TemplatePreview template={template} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default TemplateDetail;