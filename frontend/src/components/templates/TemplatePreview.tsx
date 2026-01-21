// frontend/src/components/templates/TemplatePreview.tsx
import { Template } from "@/lib/api/templates";
import { Image, FileText, Video, Link, Copy, Phone, MessageSquare, Globe, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface TemplatePreviewProps {
  template: Template;
  className?: string;
  showDetails?: boolean;
}

export function TemplatePreview({ template, className = "", showDetails = false }: TemplatePreviewProps) {
  // Use lowercase type matching for consistency
  const headerComponent = template.components?.find(c => c.type.toLowerCase() === 'header');
  const bodyComponent = template.components?.find(c => c.type.toLowerCase() === 'body');
  const footerComponent = template.components?.find(c => c.type.toLowerCase() === 'footer');
  const buttonsComponent = template.components?.find(c => c.type.toLowerCase() === 'buttons');

  // Extract variables from text and replace with sample values
  const renderBodyText = (text: string = '') => {
    if (!text) return '';
    
    let rendered = text;
    
    // Replace variables with sample values if available
    if (bodyComponent?.example?.body_text) {
      bodyComponent.example.body_text[0]?.forEach((val: string, idx: number) => {
        const placeholder = `{{${idx + 1}}}`;
        rendered = rendered.replace(placeholder, val || `[${idx + 1}]`);
      });
    }
    
    // Replace any remaining variables with placeholders
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '[variable]');
    
    return rendered;
  };

  const renderHeaderText = (text: string = '') => {
    if (!text) return '';
    
    let rendered = text;
    
    // Replace header variables with sample values
    if (headerComponent?.example?.header_text?.[0]) {
      rendered = rendered.replace('{{1}}', headerComponent.example.header_text[0] || '[value]');
    }
    
    // Replace any remaining variables
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '[variable]');
    
    return rendered;
  };

  // Get header display based on format - UPDATED FOR BETTER MEDIA PREVIEW
  const renderHeaderPreview = () => {
    if (!headerComponent) return null;

    const format = headerComponent.format?.toLowerCase() || 'text';
    const mediaUrl = headerComponent.example?.header_handle?.[0];

    switch (format) {
      case 'image':
        return (
          <div className="relative">
            {mediaUrl ? (
              // Show actual uploaded image in preview
              <div className="h-40 bg-gray-100 overflow-hidden">
                <img 
                  src={mediaUrl} 
                  alt="Header preview" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://via.placeholder.com/400x200?text=Image+Header';
                  }}
                />
              </div>
            ) : (
              // Show placeholder when no image uploaded
              <div className="h-32 bg-gradient-to-br from-blue-50 to-purple-50 flex flex-col items-center justify-center p-4">
                <Image className="h-10 w-10 text-blue-400 mb-2" />
                <p className="text-sm text-muted-foreground text-center">Image Header</p>
                <p className="text-xs text-muted-foreground mt-1">No image uploaded</p>
              </div>
            )}
          </div>
        );
      
      case 'video':
        return (
          <div className="relative">
            {mediaUrl ? (
              // Show video thumbnail/preview
              <div className="h-32 bg-gradient-to-br from-orange-50 to-red-50 flex flex-col items-center justify-center p-4 relative">
                <div className="absolute inset-0 bg-black/10" />
                <div className="relative z-10 flex flex-col items-center">
                  <Video className="h-10 w-10 text-white mb-2" />
                  <p className="text-sm text-white font-medium">Video Header</p>
                  <p className="text-xs text-white/80 mt-1">Click to play</p>
                </div>
                {headerComponent.example?.header_handle?.[0] && (
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-xs text-white/90 truncate bg-black/50 p-1 rounded">
                      {headerComponent.example.header_handle[0].split('/').pop()}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Show placeholder when no video uploaded
              <div className="h-32 bg-gradient-to-br from-orange-50 to-red-50 flex flex-col items-center justify-center p-4">
                <Video className="h-10 w-10 text-orange-400 mb-2" />
                <p className="text-sm text-muted-foreground text-center">Video Header</p>
                <p className="text-xs text-muted-foreground mt-1">No video uploaded</p>
              </div>
            )}
          </div>
        );
      
      case 'document':
        return (
          <div className="h-16 bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center gap-3 p-4">
            <FileText className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-sm font-medium">Document Header</p>
              {mediaUrl ? (
                <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {mediaUrl.split('/').pop() || 'Uploaded document'}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No document uploaded</p>
              )}
            </div>
          </div>
        );
      
      case 'text':
        return headerComponent.text ? (
          <div className="p-3 bg-gradient-to-r from-gray-50 to-gray-100">
            <p className="font-semibold text-sm text-gray-800">
              {renderHeaderText(headerComponent.text)}
            </p>
          </div>
        ) : null;
      
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Template Status Badge */}
      {showDetails && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={
                template.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' :
                template.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                template.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                'bg-gray-100 text-gray-700 border-gray-200'
              }
            >
              {template.status}
            </Badge>
            {template.category && (
              <Badge variant="outline" className="capitalize">
                {template.category.toLowerCase()}
              </Badge>
            )}
          </div>
          {template.metaTemplateId && (
            <Badge variant="outline" className="text-xs">
              Meta: {template.metaTemplateId.substring(0, 8)}...
            </Badge>
          )}
        </div>
      )}

      {/* WhatsApp-style message bubble */}
      <div className="bg-[#e5ddd5] rounded-lg p-4">
        <div className="bg-white rounded-lg shadow-sm max-w-[280px] mx-auto overflow-hidden">
          {/* Header - Now properly shows different header types */}
          {headerComponent && renderHeaderPreview() && (
            <div className="border-b border-border/50">
              {renderHeaderPreview()}
            </div>
          )}

          {/* Body */}
          {bodyComponent?.text && (
            <div className="p-3">
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {renderBodyText(bodyComponent.text)}
              </p>
              
              {/* Show variables if any */}
              {bodyComponent.example?.body_text && bodyComponent.example.body_text[0]?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2">Variables:</p>
                  <div className="flex flex-wrap gap-1">
                    {bodyComponent.example.body_text[0]?.map((val: string, idx: number) => (
                      <span 
                        key={idx} 
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                      >
                        <span className="font-mono">{"{{" + (idx + 1) + "}}"}</span>
                        <span className="text-blue-500">→</span>
                        <span className="truncate max-w-[80px]">{val || `[${idx + 1}]`}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {footerComponent?.text && (
            <div className="px-3 pb-2">
              <p className="text-xs text-gray-500 italic">{footerComponent.text}</p>
            </div>
          )}

          {/* Timestamp */}
          <div className="px-3 pb-2 flex justify-end">
            <span className="text-[10px] text-gray-400">10:30 AM • WhatsApp</span>
          </div>

          {/* Buttons */}
          {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
            <div className="border-t border-gray-100">
              {buttonsComponent.buttons.map((button: any, idx: number) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-2 p-3 text-blue-600 text-sm font-medium border-b border-gray-100 last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  {button.type === 'URL' && <Link className="h-4 w-4" />}
                  {button.type === 'PHONE_NUMBER' && <Phone className="h-4 w-4" />}
                  {button.type === 'QUICK_REPLY' && <MessageSquare className="h-4 w-4" />}
                  <span className="flex-1">{button.text}</span>
                  
                  {button.type === 'URL' && button.url && (
                    <span className="text-xs text-gray-500 truncate max-w-[80px]">
                      {button.url.replace(/^https?:\/\//, '')}
                    </span>
                  )}
                  {button.type === 'PHONE_NUMBER' && button.phone_number && (
                    <span className="text-xs text-gray-500">{button.phone_number}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Template Details (optional) */}
      {showDetails && (
        <div className="space-y-3 pt-4 border-t">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Globe className="h-3 w-3" />
                <span>Language</span>
              </div>
              <p className="font-medium text-sm">{template.language}</p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="h-3 w-3" />
                <span>Created</span>
              </div>
              <p className="font-medium text-sm">
                {template.createdAt && format(new Date(template.createdAt), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          
          {template.metaStatus && (
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Meta Status</p>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={
                    template.metaStatus === 'APPROVED' ? 'bg-green-100 text-green-700 border-green-200' :
                    template.metaStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                    template.metaStatus === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' :
                    'bg-gray-100 text-gray-700 border-gray-200'
                  }
                >
                  {template.metaStatus}
                </Badge>
                {template.quality_rating && (
                  <Badge variant="outline" className="capitalize">
                    Quality: {template.quality_rating.toLowerCase()}
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          {template.meta_review_feedback && (
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Review Feedback</p>
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{template.meta_review_feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}