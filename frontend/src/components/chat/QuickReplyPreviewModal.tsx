import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QuickReplyPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: {
    original: string;
    personalized: string;
    variables: string[];
    availableVariables: Array<{
      name: string;
      description: string;
      value: string;
    }>;
  };
  onSend: () => void;
}

const QuickReplyPreviewModal: React.FC<QuickReplyPreviewModalProps> = ({
  isOpen,
  onClose,
  preview,
  onSend,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quick Reply Preview</DialogTitle>
          <DialogDescription>
            See how variables are replaced with actual values
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original vs Personalized */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Original Template</h3>
              <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                {preview.original}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Personalized Message</h3>
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-sm whitespace-pre-wrap">
                {preview.personalized}
              </div>
            </div>
          </div>

          {/* Variables used */}
          {preview.variables.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Variables Replaced</h3>
              <div className="flex flex-wrap gap-2">
                {preview.variables.map((variable) => (
                  <Badge key={variable} variant="secondary">
                    {variable}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Available variables */}
          <div>
            <h3 className="text-sm font-medium mb-2">Available Variables</h3>
            <ScrollArea className="h-40">
              <div className="space-y-2">
                {preview.availableVariables.map((variable) => (
                  <div key={variable.name} className="flex items-center justify-between text-sm">
                    <div>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                        {variable.name}
                      </code>
                      <span className="ml-2 text-muted-foreground">
                        {variable.description}
                      </span>
                    </div>
                    <span className="text-muted-foreground truncate max-w-[150px]">
                      {variable.value}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onSend}>
              Send Message
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickReplyPreviewModal;