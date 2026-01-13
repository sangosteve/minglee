// frontend/src/components/contacts/ImportContactsDialog.tsx
import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowUpTrayIcon, XMarkIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { importContactsFromCSV, type CSVContact } from '@/lib/contacts-utils';
import { useCreateContact } from '@/lib/api/contacts';
import { toast } from '@/hooks/use-toast';

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const ImportContactsDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: ImportContactsDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    errors: [] as string[],
  });

  const createContactMutation = useCreateContact();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setProgress({
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      errors: [],
    });

    try {
      await importContactsFromCSV(
        file,
        (newProgress) => {
          setProgress({ ...newProgress });
        },
        async (data) => {
          return await createContactMutation.mutateAsync(data);
        }
      );

      if (progress.failed === 0) {
        toast({
          title: 'Import successful',
          description: `Successfully imported ${progress.success} contacts`,
        });
      } else {
        toast({
          title: 'Import completed with errors',
          description: `${progress.success} imported, ${progress.failed} failed`,
          variant: 'destructive',
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error.message || 'Failed to import contacts',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetDialog = () => {
    setFile(null);
    setProgress({
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      errors: [],
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetDialog();
    }
    onOpenChange(newOpen);
  };

  const progressPercentage = progress.total > 0 
    ? (progress.processed / progress.total) * 100 
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import contacts. The file should contain columns for name and phone at minimum.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <ArrowUpTrayIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                CSV files only
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ArrowUpTrayIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="p-1 hover:bg-secondary rounded"
                >
                  <XMarkIcon className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {isImporting && (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Importing...</span>
                    <span>{progress.processed}/{progress.total}</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>{progress.success} successful</span>
                    </div>
                    <div className="flex items-center gap-2 text-destructive">
                      <ExclamationCircleIcon className="w-4 h-4" />
                      <span>{progress.failed} failed</span>
                    </div>
                  </div>

                  {progress.errors.length > 0 && (
                    <div className="max-h-32 overflow-y-auto">
                      <p className="text-xs font-medium mb-1">Errors:</p>
                      {progress.errors.map((error, index) => (
                        <p key={index} className="text-xs text-destructive">
                          • {error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="text-sm space-y-2">
            <p className="font-medium">CSV Format:</p>
            <div className="bg-secondary/30 p-3 rounded text-xs font-mono">
              name,phone,email,city,state,country,status,tags,note<br/>
              John Doe,+263771234567,john@example.com,Harare,Harare,Zimbabwe,active,"VIP;Customer","Important client"<br/>
              Jane Smith,+263772345678,jane@example.com,Bulawayo,Bulawayo,Zimbabwe,lead,"Prospect","Follow up next week"
            </div>
            <p className="text-xs text-muted-foreground">
              Required: name, phone. Optional: email, city, state, country, status, tags, note
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || isImporting}
            className="gap-2"
          >
            {isImporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              'Import Contacts'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};