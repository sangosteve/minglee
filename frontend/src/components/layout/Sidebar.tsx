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
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

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

  const getUserInitials = () => {
    if (!user?.name) return "U";
    
    const nameParts = user.name.split(" ");
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    return user.name[0].toUpperCase();
  };

  return (
    <aside
      className={cn(
        "gradient-sidebar flex flex-col transition-all duration-300 ease-in-out relative h-screen overflow-hidden",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border shrink-0">
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
          className={cn(
            "p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors shrink-0",
            collapsed ? "mx-auto" : ""
          )}
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
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              {collapsed ? (
                <div className="relative group">
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center justify-center px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-sidebar-foreground text-sidebar-background"
                          : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )
                    }
                    end={item.href === "/"}
                    title={item.name}
                  >
                    <div className="relative">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {item.badge && (
                        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-semibold h-4 min-w-4 flex items-center justify-center px-1 rounded-full">
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      )}
                    </div>
                  </NavLink>
                  {/* Tooltip */}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg pointer-events-none">
                    {item.name}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-4 border-l-0 border-r-4 border-r-gray-900 border-transparent"></div>
                  </div>
                </div>
              ) : (
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
                  <div className="relative shrink-0">
                    <item.icon className="w-5 h-5" />
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-semibold h-4 min-w-4 flex items-center justify-center px-1 rounded-full">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="flex-1 truncate">{item.name}</span>
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile & Logout */}
      <div className="border-t border-sidebar-border p-3 space-y-2 shrink-0">
        {/* User Profile with Tooltip */}
        <div className="relative group">
          <div
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-default",
              collapsed ? "justify-center" : ""
            )}
          >
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
            
            {!collapsed && user && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user.name || "User"}
                </p>
                <p className="text-xs text-sidebar-muted truncate">
                  {user.email}
                </p>
              </div>
            )}
          </div>
          
          {collapsed && user && (
            <div className="absolute left-full bottom-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg pointer-events-none">
              <div className="font-medium">{user.name || "User"}</div>
              <div className="text-gray-300 text-xs">{user.email}</div>
              <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-4 border-l-0 border-r-4 border-r-gray-900 border-transparent"></div>
            </div>
          )}
        </div>

        {/* Logout Button with Tooltip */}
        <div className="relative group">
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 p-2 rounded-lg text-sm font-medium transition-all duration-200",
              "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "justify-center" : ""
            )}
            title={collapsed ? "Logout" : ""}
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="flex-1 text-left truncate">Logout</span>
            )}
          </button>
          
          {collapsed && (
            <div className="absolute left-full bottom-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg pointer-events-none">
              Logout
              <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-4 border-l-0 border-r-4 border-r-gray-900 border-transparent"></div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}