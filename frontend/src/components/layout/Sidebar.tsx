import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ChatBubbleLeftRightIcon,
  HomeIcon,
  UsersIcon,
  MegaphoneIcon,
  ChartBarIcon,
  CogIcon,
  SparklesIcon,
  UserGroupIcon,
  TagIcon,
  RocketLaunchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { toast } from "sonner";

const navigation = [
  { name: "Dashboard", href: "/", icon: HomeIcon },
  { name: "Conversations", href: "/conversations", icon: ChatBubbleLeftRightIcon, badge: 12 },
  { name: "Contacts", href: "/contacts", icon: UsersIcon },
  { name: "Broadcasts", href: "/broadcasts", icon: MegaphoneIcon },
  { name: "Campaigns", href: "/campaigns", icon: RocketLaunchIcon },
  { name: "Automations", href: "/automations", icon: SparklesIcon },
  { name: "Teams", href: "/teams", icon: UserGroupIcon },
  { name: "Tags", href: "/tags", icon: TagIcon },
  { name: "Analytics", href: "/analytics", icon: ChartBarIcon },
  { name: "Settings", href: "/settings", icon: CogIcon },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  console.log(user ? `User logged in: ${user.email}` : "No user logged in");

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error: any) {
      toast.error("Logout failed");
      console.error("Logout error:", error);
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return "U";
    
    const nameParts = user.name.split(" ");
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    return user.name[0].toUpperCase();
  };

  // Get user role display
  const getUserRole = () => {
    if (!user) return "User";
    return user.isAdmin ? "Admin" : "User";
  };

  return (
    <aside
      className={cn(
        "gradient-sidebar flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-sidebar-foreground/20 flex items-center justify-center">
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-sidebar-foreground" />
            </div>
            <span className="font-semibold text-lg text-sidebar-foreground">Minglee</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRightIcon className="w-4 h-4 text-sidebar-foreground" />
          ) : (
            <ChevronLeftIcon className="w-4 h-4 text-sidebar-foreground" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-foreground text-sidebar-background"
                      : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )
                }
                end={item.href === "/"}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="flex-1 animate-fade-in">{item.name}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="bg-destructive text-destructive-foreground text-xs font-semibold px-2 py-0.5 rounded-full animate-scale-in">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile & Logout */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {/* User Profile */}
        <div
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors",
            collapsed && "justify-center"
          )}
          title={user?.name || "User Profile"}
        >
          {/* Avatar with user initials */}
          <div className="w-8 h-8 rounded-full bg-sidebar-foreground/20 flex items-center justify-center flex-shrink-0">
            {user?.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt={user.name || "User"}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-sidebar-foreground">
                {getUserInitials()}
              </span>
            )}
          </div>
          
          {/* User details (only shown when sidebar is expanded) */}
          {!collapsed && user && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.name || "User"}
              </p>
              <p className="text-xs text-sidebar-muted truncate">
                 {user.email}
              </p>
            </div>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 p-2 rounded-lg text-sm font-medium transition-all duration-200",
            "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "justify-center"
          )}
          title="Logout"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
          {!collapsed && (
            <span className="flex-1 animate-fade-in text-left">Logout</span>
          )}
        </button>
      </div>
    </aside>
  );
}