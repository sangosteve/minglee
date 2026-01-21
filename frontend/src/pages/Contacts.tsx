// frontend/src/pages/Contacts.tsx
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  FunnelIcon,
  EllipsisHorizontalIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import {
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AddContactSheet } from "@/components/contacts/AddContactSheet";
import { EditContactSheet } from "@/components/contacts/EditContactSheet";
import { ImportContactsDialog } from "@/components/contacts/ImportContactsDialog";
import { ExportContactsDialog } from "@/components/contacts/ExportContactsDialog";
import { 
  useContacts, 
  useContactAnalytics, 
  useDeleteContact,
  useUpdateContact,
  useUpdateContactStatus,
  type Contact,
  type ContactFilters
} from "@/lib/api/contacts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useTags } from '@/lib/api/tags';
import { useTagsStore } from '@/stores/tags.store';
import { ContactFilter } from "@/components/contacts/ContactFilter";
import { useContactsStore } from '@/stores/contacts.store';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Status configuration
const statusConfig = {
  active: { 
    label: "Active", 
    color: "bg-success/10 text-success border-success/20",
    icon: CheckCircleIcon 
  },
  inactive: { 
    label: "Inactive", 
    color: "bg-muted text-muted-foreground border-muted",
    icon: XCircleIcon 
  },
  lead: { 
    label: "Lead", 
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icon: UserGroupIcon 
  },
  customer: { 
    label: "Customer", 
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    icon: UserGroupIcon 
  },
};

const Contacts = () => {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isEditContactOpen, setIsEditContactOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [filters, setFilters] = useState<ContactFilters>({
    page: 1,
    limit: 12,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  // Alert dialog states
  const [deleteAlert, setDeleteAlert] = useState<{
    isOpen: boolean;
    contact: Contact | null;
    isBulk: boolean;
    contactIds?: string[];
  }>({
    isOpen: false,
    contact: null,
    isBulk: false,
  });

  // Contacts store for selection management
  const {
    selectedContactIds,
    toggleContactSelection,
    selectAllContacts,
    clearSelection,
    importProgress,
  } = useContactsStore();

  // React Query hooks
  const { 
    data: contactsData, 
    isLoading: contactsLoading, 
    error: contactsError,
    refetch 
  } = useContacts(filters);

  console.log("Contacts Data:", contactsData);

  const { data: tagsData, isLoading: tagsLoading } = useTags();
  const { data: analytics, isLoading: analyticsLoading } = useContactAnalytics();
  const deleteContactMutation = useDeleteContact();
  const updateContactMutation = useUpdateContact();
  const updateStatusMutation = useUpdateContactStatus();

  const contacts = contactsData?.contacts || [];
  const pagination = contactsData?.pagination;

  // Populate Zustand store when tags are loaded
  const { setSelectTags, getTagById, getTagNameById } = useTagsStore();
  useEffect(() => {
    if (tagsData && tagsData.length > 0) {
      setSelectTags(tagsData);
    }
  }, [tagsData, setSelectTags]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ 
        ...prev, 
        search: searchQuery || undefined, 
        page: 1 
      }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Clear selection when filters change
  useEffect(() => {
    clearSelection();
  }, [filters, clearSelection]);

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsEditContactOpen(true);
  };

  const showDeleteConfirmation = (contact: Contact) => {
    setDeleteAlert({
      isOpen: true,
      contact,
      isBulk: false,
    });
  };

  const showBulkDeleteConfirmation = () => {
    if (selectedContactIds.length === 0) return;
    
    setDeleteAlert({
      isOpen: true,
      contact: null,
      isBulk: true,
      contactIds: selectedContactIds,
    });
  };

  const handleDeleteContact = async () => {
    if (!deleteAlert.contact) return;

    try {
      await deleteContactMutation.mutateAsync(deleteAlert.contact.id);
      toast({
        title: "🗑️ Contact Deleted",
        description: `"${deleteAlert.contact.name || 'Contact'}" has been deleted successfully.`,
        className: "border-orange-500 bg-orange-50 dark:bg-orange-950/30",
      });
      // Remove from selection if it was selected
      if (selectedContactIds.includes(deleteAlert.contact.id)) {
        toggleContactSelection(deleteAlert.contact.id);
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to delete contact.",
        variant: "destructive",
      });
    } finally {
      setDeleteAlert({ isOpen: false, contact: null, isBulk: false });
    }
  };

  const handleBulkDelete = async () => {
    if (!deleteAlert.contactIds || deleteAlert.contactIds.length === 0) return;
    
    try {
      const deletePromises = deleteAlert.contactIds.map(id => 
        deleteContactMutation.mutateAsync(id)
      );
      
      await Promise.all(deletePromises);
      
      toast({
        title: `🗑️ ${deleteAlert.contactIds.length} Contact${deleteAlert.contactIds.length !== 1 ? 's' : ''} Deleted`,
        description: `Successfully deleted ${deleteAlert.contactIds.length} contact${deleteAlert.contactIds.length !== 1 ? 's' : ''}.`,
        className: "border-orange-500 bg-orange-50 dark:bg-orange-950/30",
      });
      
      clearSelection();
      refetch();
    } catch (error: any) {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to delete contacts",
        variant: "destructive",
      });
    } finally {
      setDeleteAlert({ isOpen: false, contact: null, isBulk: false });
    }
  };

  const handleStatusChange = async (contactId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateStatusMutation.mutateAsync({ id: contactId, status: newStatus });
      toast({
        title: "🔄 Status Updated",
        description: "Contact status has been updated successfully.",
        className: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
      });
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to update contact status.",
        variant: "destructive",
      });
    }
  };

  // Format location
  const formatLocation = (contact: Contact) => {
    const parts = [];
    if (contact.city) parts.push(contact.city);
    if (contact.state) parts.push(contact.state);
    if (contact.country) parts.push(contact.country);
    return parts.length > 0 ? parts.join(", ") : "Location not set";
  };

  // Get initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Format time since last contact
  const formatTimeSince = (dateString?: string) => {
    if (!dateString) return "Never contacted";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Get tag display (using Zustand store)
  const getTagDisplay = (tag: any) => {
    // If it's a UUID string, get from Zustand store
    if (typeof tag === 'string') {
      const storeTag = getTagById(tag);
      if (storeTag) {
        return {
          name: storeTag.label,
          color: storeTag.color,
          style: storeTag.color ? { 
            backgroundColor: `${storeTag.color}20`, 
            color: storeTag.color,
            borderColor: `${storeTag.color}30`
          } : undefined
        };
      }
      // Fallback: show formatted ID
      return {
        name: getTagNameById(tag),
        style: undefined
      };
    }
    
    // If it's an object
    if (tag && typeof tag === 'object') {
      const name = tag.name || tag.label || '';
      const color = tag.color;
      
      return {
        name,
        color,
        style: color ? { 
          backgroundColor: `${color}20`, 
          color: color,
          borderColor: `${color}30`
        } : undefined
      };
    }
    
    return {
      name: '',
      style: undefined
    };
  };

  if (contactsError) {
    return (
 
        <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <XCircleIcon className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Failed to load contacts</h3>
              <p className="text-muted-foreground mb-4">
                {contactsError instanceof Error ? contactsError.message : "Unknown error occurred"}
              </p>
              <Button onClick={() => refetch()} className="gap-2">
                <ArrowPathIcon className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        </div>
 
    );
  }

  return (
    
      <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-1">
            {selectedContactIds.length > 0 && (
              <div className="flex items-center gap-3 mr-4">
                <span className="text-sm font-medium text-foreground">
                  {selectedContactIds.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  className="gap-2 border-border hover:bg-secondary"
                >
                  Clear
                </Button>
              </div>
            )}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm"
              />
            </div>
            <ContactFilter
              filters={filters}
              onFilterChange={setFilters}
              availableTags={tagsData || []}
              isLoading={tagsLoading}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-secondary rounded-lg p-1">
              <button
                onClick={() => setView("grid")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  view === "grid" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Grid
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  view === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                List
              </button>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 border-border hover:bg-secondary">
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Import/Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                <DropdownMenuItem 
                  onClick={() => setIsImportDialogOpen(true)} 
                  className="gap-2 cursor-pointer text-foreground hover:bg-accent"
                >
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  Import
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setIsExportDialogOpen(true)} 
                  className="gap-2 cursor-pointer text-foreground hover:bg-accent"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Export
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" 
              onClick={() => setIsAddContactOpen(true)}
              disabled={contactsLoading}
            >
              <PlusIcon className="w-4 h-4" />
              Add Contact
            </Button>
          </div>
        </div>

        {/* Add Contact Sheet */}
        <AddContactSheet 
          open={isAddContactOpen} 
          onOpenChange={setIsAddContactOpen}
          onSuccess={() => {
            refetch();
            toast({
              title: "✅ Contact Added",
              description: "Contact has been added successfully.",
              className: "border-green-500 bg-green-50 dark:bg-green-950/30",
            });
          }}
        />
        
        {/* Edit Contact Sheet */}
        {selectedContact && (
          <EditContactSheet 
            open={isEditContactOpen} 
            onOpenChange={setIsEditContactOpen} 
            contact={selectedContact}
            onSuccess={() => {
              refetch();
              toast({
                title: "✅ Contact Updated",
                description: "Contact has been updated successfully.",
                className: "border-green-500 bg-green-50 dark:bg-green-950/30",
              });
            }}
          />
        )}
        
        <ImportContactsDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onSuccess={() => {
            refetch();
            clearSelection();
            toast({
              title: "✅ Import Successful",
              description: "Contacts have been imported successfully.",
              className: "border-green-500 bg-green-50 dark:bg-green-950/30",
            });
          }}
        />
        
        <ExportContactsDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
        />

        {/* Bulk Actions Toolbar */}
        {selectedContactIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-lg px-4 py-3 z-50 animate-in slide-in-from-bottom-5 duration-200">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  className="rounded-none"
                  checked={selectedContactIds.length === contacts.length && contacts.length > 0}
                  onCheckedChange={() => {
                    if (selectedContactIds.length === contacts.length) {
                      clearSelection();
                    } else {
                      selectAllContacts(contacts.map(c => c.id));
                    }
                  }}
                />
                <span className="text-sm font-medium text-foreground">
                  {selectedContactIds.length} contact{selectedContactIds.length !== 1 ? 's' : ''} selected
                </span>
              </div>

              <div className="h-4 w-px bg-border" />

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-border hover:bg-accent"
                  onClick={() => setIsExportDialogOpen(true)}
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Export
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-border hover:bg-accent">
                      <EllipsisHorizontalIcon className="w-4 h-4" />
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                    <DropdownMenuItem 
                      onClick={() => {}} 
                      className="gap-2 cursor-pointer text-foreground hover:bg-accent"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      Mark as Active
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {}} 
                      className="gap-2 cursor-pointer text-foreground hover:bg-accent"
                    >
                      <XCircleIcon className="w-4 h-4" />
                      Mark as Inactive
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={showBulkDeleteConfirmation}
                      className="gap-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Delete selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="hover:bg-secondary"
                >
                  <XMarkIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Import Progress Indicator */}
        {importProgress && importProgress.total > 0 && (
          <div className="mb-6 bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <ArrowUpTrayIcon className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Importing contacts</p>
                  <p className="text-sm text-muted-foreground">
                    {importProgress.processed}/{importProgress.total} processed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-success font-medium">
                  ✓ {importProgress.success} successful
                </span>
                <span className="text-sm text-destructive font-medium">
                  ✗ {importProgress.failed} failed
                </span>
              </div>
            </div>
            <Progress 
              value={(importProgress.processed / importProgress.total) * 100} 
              className="h-2"
            />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-sm text-muted-foreground">Total Contacts</p>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {analytics?.totalContacts || 0}
              </p>
            )}
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-sm text-muted-foreground">Active</p>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-success">
                {analytics?.byStatus?.find(s => s.status === 'active')?.count || 0}
              </p>
            )}
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-sm text-muted-foreground">VIP Contacts</p>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-primary">
                {analytics?.byTag?.find(t => t.tag === 'VIP')?.count || 0}
              </p>
            )}
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-sm text-muted-foreground">New This Week</p>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-blue-500">
                {analytics?.newThisWeek || 0}
              </p>
            )}
          </div>
        </div>

        {/* Loading State */}
        {contactsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, index) => (
              <div
                key={index}
                className="bg-card rounded-xl p-5 border border-border animate-pulse"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="w-6 h-6 rounded" />
                </div>
                <div className="space-y-2 mb-4">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="h-6 w-3/4 mb-4" />
                <div className="flex justify-between pt-3 border-t border-border">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <UserGroupIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">No contacts found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Try adjusting your search" : "Get started by adding your first contact"}
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={() => setIsAddContactOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
              <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="border-border hover:bg-secondary">
                <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </div>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {contacts.map((contact, index) => (
              <div
                key={contact.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                    e.stopPropagation();
                    return;
                  }
                  handleContactClick(contact);
                }}
                className="bg-card rounded-xl p-5 border border-border hover:shadow-lg hover:border-primary/20 transition-all duration-200 cursor-pointer group relative"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Selection checkbox */}
                <div className="absolute top-4 right-4 z-10">
                  <Checkbox
                    checked={selectedContactIds.includes(contact.id)}
                    onCheckedChange={() => toggleContactSelection(contact.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-none"
                  />
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-semibold text-primary">
                        {getInitials(contact.name)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {contact.name || "Unnamed Contact"}
                      </h3>
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
                        statusConfig[contact.status as keyof typeof statusConfig]?.color || "bg-muted text-muted-foreground border-border"
                      )}>
                        {(() => {
                          const Icon = statusConfig[contact.status as keyof typeof statusConfig]?.icon;
                          return Icon ? (
                            <>
                              <Icon className="w-3 h-3" />
                              {statusConfig[contact.status as keyof typeof statusConfig]?.label}
                            </>
                          ) : contact.status;
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="p-1 hover:bg-secondary rounded">
                          <EllipsisHorizontalIcon className="w-5 h-5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContactClick(contact);
                          }}
                          className="gap-2 cursor-pointer text-foreground hover:bg-accent"
                        >
                          <PencilIcon className="w-4 h-4" />
                          Edit Contact
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(contact.id, "active", e);
                          }}
                          className="gap-2 cursor-pointer text-foreground hover:bg-accent"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                          Mark as Active
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(contact.id, "inactive", e);
                          }}
                          className="gap-2 cursor-pointer text-foreground hover:bg-accent"
                        >
                          <XCircleIcon className="w-4 h-4" />
                          Mark as Inactive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="gap-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            showDeleteConfirmation(contact);
                          }}
                        >
                          <TrashIcon className="w-4 h-4" />
                          Delete Contact
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <EnvelopeIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{contact.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <PhoneIcon className="w-4 h-4 flex-shrink-0" />
                    <span>{contact.phone || "No phone"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPinIcon className="w-4 h-4 flex-shrink-0" />
                    <span>{formatLocation(contact)}</span>
                  </div>
                  {contact.lastContactedAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ChatBubbleLeftRightIcon className="w-4 h-4 flex-shrink-0" />
                      <span>Last: {formatTimeSince(contact.lastContactedAt)}</span>
                    </div>
                  )}
                </div>

                {(((Array.isArray(contact.tags) && contact.tags.length > 0) || (Array.isArray(contact.tagIds) && contact.tagIds.length > 0))) && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {((Array.isArray(contact.tags) && contact.tags.length > 0) ? contact.tags : contact.tagIds).slice(0, 3).map((tag, idx) => {
                      // Show skeleton if tags are still loading
                      if (tagsLoading) {
                        return (
                          <Skeleton key={idx} className="h-6 w-16 rounded-full" />
                        );
                      }
                      
                      const tagDisplay = getTagDisplay(tag);
                      if (!tagDisplay.name) return null;
                      
                      return (
                        <Badge
                          key={idx}
                          variant="secondary"
                          style={tagDisplay.style}
                          className="text-xs border"
                        >
                          {tagDisplay.name}
                        </Badge>
                      );
                    })}
                    {!tagsLoading && (((Array.isArray(contact.tags) && contact.tags.length > 3) ? contact.tags.length - 3 : 0) || ((Array.isArray(contact.tagIds) && contact.tagIds.length > 3) ? contact.tagIds.length - 3 : 0)) > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        +{ (Array.isArray(contact.tags) && contact.tags.length > 3) ? contact.tags.length - 3 : (Array.isArray(contact.tagIds) && contact.tagIds.length > 3 ? contact.tagIds.length - 3 : 0) }
                      </Badge>
                    )}
                  </div>
                )} 

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {contact.createdAt ? `Added ${formatTimeSince(contact.createdAt)}` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(contact as any).conversationCount || 0} chats
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">
                    <Checkbox
                      checked={selectedContactIds.length === contacts.length && contacts.length > 0}
                      onCheckedChange={() => {
                        if (selectedContactIds.length === contacts.length) {
                          clearSelection();
                        } else {
                          selectAllContacts(contacts.map(c => c.id));
                        }
                      }}
                      className="rounded-none"
                    />
                  </th>
                  <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact</th>
                  <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Email</th>
                  <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Phone</th>
                  <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Location</th>
                  <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</th>
                  <th className="text-left py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right py-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        return;
                      }
                      handleContactClick(contact);
                    }}
                    className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedContactIds.includes(contact.id)}
                        onCheckedChange={() => toggleContactSelection(contact.id)}
                        className="rounded-none"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {getInitials(contact.name)}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">
                            {contact.name || "Unnamed Contact"}
                          </span>
                          {contact.lastContactedAt && (
                            <div className="text-xs text-muted-foreground">
                              Last contact: {formatTimeSince(contact.lastContactedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground hidden md:table-cell">
                      {contact.email || "—"}
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground hidden lg:table-cell">
                      {contact.phone || "—"}
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground hidden xl:table-cell">
                      {formatLocation(contact)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1">
                        {((Array.isArray(contact.tags) && contact.tags.length > 0) ? contact.tags : (Array.isArray(contact.tagIds) ? contact.tagIds : [])).slice(0, 2).map((tag, idx) => {
                          // Show skeleton if tags are still loading
                          if (tagsLoading) {
                            return (
                              <Skeleton key={idx} className="h-6 w-16 rounded-full" />
                            );
                          }
                          
                          const tagDisplay = getTagDisplay(tag);
                          if (!tagDisplay.name) return null;
                          
                          return (
                            <Badge
                              key={idx}
                              variant="secondary"
                              style={tagDisplay.style}
                              className="text-xs border"
                            >
                              {tagDisplay.name}
                            </Badge>
                          );
                        })}
                        {!tagsLoading && (((Array.isArray(contact.tags) && contact.tags.length > 2) ? contact.tags.length - 2 : 0) || ((Array.isArray(contact.tagIds) && contact.tagIds.length > 2) ? contact.tagIds.length - 2 : 0)) > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            +{ (Array.isArray(contact.tags) && contact.tags.length > 2) ? contact.tags.length - 2 : (Array.isArray(contact.tagIds) && contact.tagIds.length > 2 ? contact.tagIds.length - 2 : 0) }
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={cn(
                        "text-xs font-medium px-2 py-1 rounded-full border inline-flex items-center gap-1",
                        statusConfig[contact.status as keyof typeof statusConfig]?.color || "bg-muted text-muted-foreground border-border"
                      )}>
                        {(() => {
                          const Icon = statusConfig[contact.status as keyof typeof statusConfig]?.icon;
                          return Icon ? (
                            <>
                              <Icon className="w-3 h-3" />
                              {statusConfig[contact.status as keyof typeof statusConfig]?.label}
                            </>
                          ) : contact.status;
                        })()}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="p-1.5 hover:bg-secondary rounded transition-colors">
                              <EllipsisHorizontalIcon className="w-5 h-5 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContactClick(contact);
                              }}
                              className="gap-2 cursor-pointer text-foreground hover:bg-accent"
                            >
                              <PencilIcon className="w-4 h-4" />
                              Edit Contact
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(contact.id, "active", e);
                              }}
                              className="gap-2 cursor-pointer text-foreground hover:bg-accent"
                            >
                              <CheckCircleIcon className="w-4 h-4" />
                              Mark as Active
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(contact.id, "inactive", e);
                              }}
                              className="gap-2 cursor-pointer text-foreground hover:bg-accent"
                            >
                              <XCircleIcon className="w-4 h-4" />
                              Mark as Inactive
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="gap-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                showDeleteConfirmation(contact);
                              }}
                            >
                              <TrashIcon className="w-4 h-4" />
                              Delete Contact
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} contacts
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
                className="border-border hover:bg-secondary"
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
                className="border-border hover:bg-secondary"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Alert Dialogs */}
        {/* Single Contact Delete Dialog */}
        <AlertDialog open={deleteAlert.isOpen && !deleteAlert.isBulk} onOpenChange={(open) => !open && setDeleteAlert({ isOpen: false, contact: null, isBulk: false })}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground flex items-center gap-2">
                <TrashIcon className="h-5 w-5 text-destructive" />
                Delete Contact
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Are you sure you want to delete "{deleteAlert.contact?.name || 'this contact'}"?
                <span className="block mt-2 text-destructive/80 font-medium">
                  This action cannot be undone and all associated data will be permanently removed.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border hover:bg-secondary text-foreground">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteContact}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Contact
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Dialog */}
        <AlertDialog open={deleteAlert.isOpen && deleteAlert.isBulk} onOpenChange={(open) => !open && setDeleteAlert({ isOpen: false, contact: null, isBulk: false })}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground flex items-center gap-2">
                <TrashIcon className="h-5 w-5 text-destructive" />
                Delete {deleteAlert.contactIds?.length} Contact{deleteAlert.contactIds && deleteAlert.contactIds.length > 1 ? 's' : ''}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Are you sure you want to delete {deleteAlert.contactIds?.length} selected contact{deleteAlert.contactIds && deleteAlert.contactIds.length > 1 ? 's' : ''}?
                <span className="block mt-2 text-destructive/80 font-medium">
                  This action cannot be undone and all associated data will be permanently removed.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border hover:bg-secondary text-foreground">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete {deleteAlert.contactIds?.length} Contact{deleteAlert.contactIds && deleteAlert.contactIds.length > 1 ? 's' : ''}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    
  );
};

// Add missing imports at the top
import { TrashIcon, PencilIcon } from "@heroicons/react/24/outline";

export default Contacts;