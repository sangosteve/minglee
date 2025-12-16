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
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [filters, setFilters] = useState<ContactFilters>({
    page: 1,
    limit: 12,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  // React Query hooks using your existing API
  const { 
    data: contactsData, 
    isLoading: contactsLoading, 
    error: contactsError,
    refetch 
  } = useContacts(filters);

  const { 
    data: analytics, 
    isLoading: analyticsLoading 
  } = useContactAnalytics();

  const deleteContactMutation = useDeleteContact();
  const updateContactMutation = useUpdateContact();
  const updateStatusMutation = useUpdateContactStatus();

  const contacts = contactsData?.contacts || [];
  const pagination = contactsData?.pagination;

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

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsEditContactOpen(true);
  };

  const handleDeleteContact = async (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this contact?")) {
      try {
        await deleteContactMutation.mutateAsync(contactId);
        toast({
          title: "Contact deleted",
          description: "Contact has been deleted successfully.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete contact.",
          variant: "destructive",
        });
      }
    }
  };

  const handleStatusChange = async (contactId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateStatusMutation.mutateAsync({ id: contactId, status: newStatus });
      toast({
        title: "Status updated",
        description: "Contact status has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
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

  // Get tag display name (handle both string and object tags)
  const getTagName = (tag: any): string => {
    if (typeof tag === 'string') return tag;
    if (tag && typeof tag === 'object') {
      return tag.name || tag.id || '';
    }
    return '';
  };

  // Get tag color (handle both string and object tags)
  const getTagColor = (tag: any): string | undefined => {
    if (tag && typeof tag === 'object' && tag.color) {
      return tag.color;
    }
    return undefined;
  };

  // Get tag display
  const getTagDisplay = (tag: any) => {
    const name = getTagName(tag);
    const color = getTagColor(tag);
    
    return {
      name,
      color,
      style: color ? { 
        backgroundColor: `${color}20`, 
        color: color,
        borderColor: `${color}30`
      } : undefined
    };
  };

  if (contactsError) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <XCircleIcon className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Failed to load contacts</h3>
            <p className="text-muted-foreground mb-4">
              {contactsError instanceof Error ? contactsError.message : "Unknown error occurred"}
            </p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <Button variant="outline" size="icon">
            <FunnelIcon className="w-4 h-4" />
          </Button>
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
          <Button 
            className="gap-2" 
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
        onSuccess={() => refetch()}
      />
      
      {/* Edit Contact Sheet */}
      {selectedContact && (
        <EditContactSheet 
          open={isEditContactOpen} 
          onOpenChange={setIsEditContactOpen} 
          contact={selectedContact}
          onSuccess={() => refetch()}
        />
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
          <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? "Try adjusting your search" : "Get started by adding your first contact"}
          </p>
          <Button onClick={() => setIsAddContactOpen(true)}>
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {contacts.map((contact, index) => (
            <div
              key={contact.id}
              onClick={() => handleContactClick(contact)}
              className="bg-card rounded-xl p-5 border border-border hover:shadow-lg hover:border-primary/20 transition-all duration-200 cursor-pointer group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
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
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleContactClick(contact);
                      }}>
                        Edit Contact
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(contact.id, "active", e);
                      }}>
                        Mark as Active
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(contact.id, "inactive", e);
                      }}>
                        Mark as Inactive
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={(e) => handleDeleteContact(contact.id, e)}
                      >
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

              {contact.tags && contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {Array.isArray(contact.tags) && contact.tags.slice(0, 3).map((tag, idx) => {
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
                  {Array.isArray(contact.tags) && contact.tags.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{contact.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {contact.createdAt ? `Added ${formatTimeSince(contact.createdAt)}` : ''}
                </span>
                <span className="text-xs text-muted-foreground">
                  {/* Assuming conversationCount is a field - adjust if needed */}
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
                  onClick={() => handleContactClick(contact)}
                  className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                >
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
                      {Array.isArray(contact.tags) && contact.tags.slice(0, 2).map((tag, idx) => {
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
                      {Array.isArray(contact.tags) && contact.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{contact.tags.length - 2}
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
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleContactClick(contact);
                          }}>
                            Edit Contact
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(contact.id, "active", e);
                          }}>
                            Mark as Active
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(contact.id, "inactive", e);
                          }}>
                            Mark as Inactive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => handleDeleteContact(contact.id, e)}
                          >
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
    </>
  );
};

export default Contacts;