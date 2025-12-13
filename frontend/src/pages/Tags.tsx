import { MainLayout } from "@/components/layout/MainLayout";
import {
  TagIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const tags = [
  { id: 1, name: "VIP Customer", color: "#f59e0b", contacts: 156, category: "Priority" },
  { id: 2, name: "New Lead", color: "#10b981", contacts: 342, category: "Status" },
  { id: 3, name: "Hot Prospect", color: "#ef4444", contacts: 89, category: "Priority" },
  { id: 4, name: "Qualified", color: "#6366f1", contacts: 234, category: "Status" },
  { id: 5, name: "Enterprise", color: "#8b5cf6", contacts: 67, category: "Segment" },
  { id: 6, name: "Small Business", color: "#06b6d4", contacts: 445, category: "Segment" },
  { id: 7, name: "Churned", color: "#64748b", contacts: 123, category: "Status" },
  { id: 8, name: "Newsletter", color: "#ec4899", contacts: 1234, category: "Interest" },
  { id: 9, name: "Product Interest", color: "#14b8a6", contacts: 567, category: "Interest" },
  { id: 10, name: "Support Required", color: "#f97316", contacts: 45, category: "Action" },
  { id: 11, name: "Follow Up", color: "#84cc16", contacts: 189, category: "Action" },
  { id: 12, name: "Partner", color: "#a855f7", contacts: 23, category: "Relationship" },
];

const categories = [
  { name: "Priority", count: 2 },
  { name: "Status", count: 3 },
  { name: "Segment", count: 2 },
  { name: "Interest", count: 2 },
  { name: "Action", count: 2 },
  { name: "Relationship", count: 1 },
];

const recentlyUsed = tags.slice(0, 5);

export default function Tags() {
  const totalContacts = tags.reduce((sum, t) => sum + t.contacts, 0);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tags</h1>
            <p className="text-muted-foreground mt-1">
              Organize and segment your contacts with tags
            </p>
          </div>
          <Button className="gap-2">
            <PlusIcon className="w-4 h-4" />
            Create Tag
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TagIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{tags.length}</p>
                <p className="text-sm text-muted-foreground">Total Tags</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-success/10">
                <UsersIcon className="w-5 h-5 text-crm-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {totalContacts.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Tagged Contacts</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-warning/10">
                <FolderIcon className="w-5 h-5 text-crm-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{categories.length}</p>
                <p className="text-sm text-muted-foreground">Categories</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tags Grid */}
          <div className="lg:col-span-3 card-gradient rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">All Tags</h2>
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search tags..." className="pl-9 w-64" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <h3 className="font-medium text-foreground">{tag.name}</h3>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <EllipsisVerticalIcon className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <PencilIcon className="w-4 h-4 mr-2" />
                          Edit Tag
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <UsersIcon className="w-4 h-4 mr-2" />
                          View Contacts
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <TrashIcon className="w-4 h-4 mr-2" />
                          Delete Tag
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {tag.category}
                    </Badge>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <UsersIcon className="w-3.5 h-3.5" />
                      {tag.contacts.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Categories */}
            <div className="card-gradient rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">Categories</h2>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <PlusIcon className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.name}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-background/50 transition-colors cursor-pointer"
                  >
                    <span className="text-sm text-foreground">{category.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {category.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Recently Used */}
            <div className="card-gradient rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-4">Recently Used</h2>
              <div className="space-y-2">
                {recentlyUsed.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-background/50 transition-colors cursor-pointer"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm text-foreground flex-1">{tag.name}</span>
                    <span className="text-xs text-muted-foreground">{tag.contacts}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card-gradient rounded-xl p-6">
              <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FolderIcon className="w-4 h-4" />
                  Manage Categories
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <TagIcon className="w-4 h-4" />
                  Bulk Tag Contacts
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <TrashIcon className="w-4 h-4" />
                  Clean Unused Tags
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
