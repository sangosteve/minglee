// frontend/src/components/layout/Sidebar.tsx
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
  UserIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
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

const navigation = [
  { name: "Dashboard", href: "/", icon: HomeIcon },
  { name: "Conversations", href: "/conversations", icon: ChatBubbleLeftRightIcon, badge: 12 },
  { name: "Contacts", href: "/contacts", icon: UsersIcon },
  { name: "Automations", href: "/automations", icon: SparklesIcon },
  { name: "Analytics", href: "/analytics", icon: ChartBarIcon },
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

  const getUserRole = () => {
    if (!user?.role) return "Member";
    return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  };

  return (
    <aside
      className={cn(
        "gradient-sidebar flex flex-col transition-all duration-300 ease-in-out h-screen overflow-hidden z-50",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo Section - Fixed centering */}
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
            "focus:outline-none focus:ring-2 focus:ring-sidebar-foreground/30",
            collapsed ? "" : ""
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
                    {item.badge && (
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
                  <span className="text-sm font-medium text-sidebar-foreground">
                    {getUserInitials()}
                  </span>
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
                <ChevronRightIcon className="w-4 h-4 text-sidebar-muted flex-shrink-0" />
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
                      <UserIcon className="w-5 h-5 text-sidebar-foreground" />
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
                        <ShieldCheckIcon className="w-3 h-3 text-primary" />
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
              <DropdownMenuItem
                onClick={() => navigate("/settings/profile")}
                className="cursor-pointer gap-3 px-4 py-2.5"
              >
                <UserIcon className="w-4 h-4" />
                My Profile
              </DropdownMenuItem>
              
              <DropdownMenuItem
                onClick={() => navigate("/settings")}
                className="cursor-pointer gap-3 px-4 py-2.5"
              >
                <CogIcon className="w-4 h-4" />
                Account Settings
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => {
                  // Navigate to help/support page
                  console.log("Help clicked");
                }}
                className="cursor-pointer gap-3 px-4 py-2.5"
              >
                <InformationCircleIcon className="w-4 h-4" />
                Help & Support
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Logout Button */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer gap-3 px-4 py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                Logout
              </DropdownMenuItem>
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