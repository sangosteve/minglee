// frontend/src/components/layout/Sidebar.tsx
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home07Icon,
  ChatIcon,
  Contact01Icon,
  ChartDownIcon,
  AlgorithmIcon,
  Settings01Icon,
  UserIcon,
  CheckmarkBadge03Icon,
  AlertCircleIcon,
  Logout01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { toast } from "sonner";
import { useUnreadCount } from "@/lib/api/conversations";
import React from "react";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  // Get the actual unread count
  const { data: unreadCount = 0, isLoading: isLoadingUnread } = useUnreadCount();

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

  const getUserRole = () => {
    if (!user?.role) return "Member";
    return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  };

  // Navigation with Hugeicons
  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home07Icon },
    { 
      name: "Conversations", 
      href: "/conversations", 
      icon: ChatIcon, 
      badge: unreadCount > 0 ? unreadCount : undefined 
    },
    { name: "Contacts", href: "/contacts", icon: Contact01Icon },
    { name: "Automations", href: "/automations", icon: AlgorithmIcon  },
    { name: "Analytics", href: "/analytics", icon: ChartDownIcon },
  ];

  // User dropdown icons
  const userDropdownIcons = [
    { name: "My Profile", icon: UserIcon, onClick: () => navigate("/settings/profile") },
    { name: "Account Settings", icon: Settings01Icon, onClick: () => navigate("/settings") },
    { name: "Help & Support", icon: AlertCircleIcon, onClick: () => console.log("Help clicked") },
    { name: "Logout", icon: Logout01Icon, onClick: handleLogout, destructive: true },
  ];

  return (
    <aside
      className={cn(
        "gradient-sidebar flex flex-col transition-all duration-300 ease-in-out h-screen overflow-hidden z-50",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className={cn(
        "flex h-16 items-center border-b border-sidebar-border shrink-0",
        collapsed ? "justify-center" : "justify-between px-4"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2 animate-fade-in">
            <img src="/MingleeLogo.svg" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-semibold text-lg text-sidebar-foreground">Minglee</span>
          </div>
        )}
        
        {/* Collapse/Expand Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors shrink-0",
            "focus:outline-none focus:ring-2 focus:ring-sidebar-foreground/30"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <img 
              src="/MingleeLogo.svg" 
              alt="Logo" 
              className="w-8 h-8 object-contain"
            />
          ) : (
            <HugeiconsIcon 
              icon={ArrowLeft01Icon} 
              size={16}
              color="currentColor"
              strokeWidth={1.5}
              className="text-sidebar-foreground"
            />
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
                      <HugeiconsIcon 
                        icon={item.icon} 
                        size={20}
                        color="currentColor"
                        strokeWidth={1.5}
                        className="flex-shrink-0"
                      />
                      {item.badge && !isLoadingUnread && (
                        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-semibold h-4 min-w-4 flex items-center justify-center px-1 rounded-full">
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      )}
                    </div>
                  </NavLink>
                  {/* Tooltip */}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg pointer-events-none">
                    {item.name}
                    {item.badge && !isLoadingUnread && (
                      <span className="ml-2 bg-destructive text-destructive-foreground text-xs font-semibold h-4 min-w-4 inline-flex items-center justify-center px-1 rounded-full">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
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
                    <HugeiconsIcon 
                      icon={item.icon} 
                      size={20}
                      color="currentColor"
                      strokeWidth={1.5}
                    />
                    {item.badge && !isLoadingUnread && (
                      <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-semibold h-4 min-w-4 flex items-center justify-center px-1 rounded-full">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.badge && !isLoadingUnread && (
                    <span className="text-xs font-medium text-destructive">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile with Dropdown Menu */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded-lg transition-colors",
                "hover:bg-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-foreground/30",
                collapsed ? "justify-center" : ""
              )}
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-sidebar-foreground/20 flex items-center justify-center flex-shrink-0 relative">
                {user?.avatarUrl ? (
                  <img 
                    src={user.avatarUrl} 
                    alt={user.name || "User"}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <HugeiconsIcon 
                    icon={UserIcon} 
                    size={16}
                    color="currentColor"
                    strokeWidth={1.5}
                    className="text-sidebar-foreground"
                  />
                )}
                {/* Online indicator */}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-sidebar-background"></div>
              </div>
              
              {!collapsed && user && (
                <div className="flex-1 min-w-0 overflow-hidden text-left">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user.name || "User"}
                  </p>
                  <p className="text-xs text-sidebar-muted truncate">
                    {getUserRole()}
                  </p>
                </div>
              )}

              {/* Chevron icon when sidebar is expanded */}
              {!collapsed && (
                <HugeiconsIcon 
                  icon={ArrowRight01Icon} 
                  size={16}
                  color="currentColor"
                  strokeWidth={1.5}
                  className="text-sidebar-muted flex-shrink-0"
                />
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent 
            align={collapsed ? "start" : "end"}
            alignOffset={collapsed ? 10 : -10}
            side={collapsed ? "right" : "top"}
            sideOffset={10}
            className="w-64 bg-card border-border shadow-lg"
          >
            {/* User Info */}
            <DropdownMenuLabel className="p-0">
              <div className="p-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sidebar-foreground/20 flex items-center justify-center flex-shrink-0">
                    {user?.avatarUrl ? (
                      <img 
                        src={user.avatarUrl} 
                        alt={user.name || "User"}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <HugeiconsIcon 
                        icon={UserIcon} 
                        size={20}
                        color="currentColor"
                        strokeWidth={1.5}
                        className="text-sidebar-foreground"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user?.name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email || "No email"}
                    </p>
                    {user?.role && (
                      <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-primary/10 rounded-full">
                        <HugeiconsIcon 
                          icon={CheckmarkBadge03Icon} 
                          size={12}
                          color="currentColor"
                          strokeWidth={1.5}
                          className="text-primary"
                        />
                        <span className="text-xs font-medium text-primary">
                          {getUserRole()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>

            {/* Menu Items */}
            <div className="py-1">
              {userDropdownIcons.map((menuItem, index) => (
                <React.Fragment key={menuItem.name}>
                  {index === 2 && <DropdownMenuSeparator />}
                  {index === 2 && <DropdownMenuSeparator />}
                  
                  <DropdownMenuItem
                    onClick={menuItem.onClick}
                    className={cn(
                      "cursor-pointer gap-3 px-4 py-2.5",
                      menuItem.destructive && "text-destructive focus:text-destructive focus:bg-destructive/10"
                    )}
                  >
                    <HugeiconsIcon 
                      icon={menuItem.icon} 
                      size={16}
                      color="currentColor"
                      strokeWidth={1.5}
                      className={menuItem.destructive ? "text-destructive" : ""}
                    />
                    {menuItem.name}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </div>

            {/* Footer with version info */}
            <div className="px-4 py-2.5 border-t border-border bg-muted/30">
              <p className="text-xs text-muted-foreground text-center">
                Minglee v1.0.0
              </p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tooltip for collapsed sidebar (hover only) */}
        {collapsed && (
          <div className="relative group">
            <div className="absolute left-full bottom-0 mb-2 ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg pointer-events-none">
              <div className="font-medium">{user?.name || "User"}</div>
              <div className="text-gray-300 text-xs">{user?.email}</div>
              <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-4 border-l-0 border-r-4 border-r-gray-900 border-transparent"></div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}