// frontend/src/components/layout/Header.tsx
import {
  MagnifyingGlassIcon,
  BellIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { useEffect, useState } from "react";

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuthStore();
  const [currentTime, setCurrentTime] = useState<string>("");
  const [greeting, setGreeting] = useState<string>("Good day");

  // Format the current time and greeting
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      
      // Set greeting based on time of day
      if (hours < 12) {
        setGreeting("Good morning");
      } else if (hours < 18) {
        setGreeting("Good afternoon");
      } else {
        setGreeting("Good evening");
      }
      
      // Format time as HH:MM AM/PM
      const options: Intl.DateTimeFormatOptions = { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      };
      setCurrentTime(now.toLocaleTimeString('en-US', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Get user's first name or fallback
  const getUserName = () => {
    if (!user) return "there";
    
    if (user.name) {
      const nameParts = user.name.split(" ");
      return nameParts[0];
    }
    
    if (user.email) {
      return user.email.split("@")[0];
    }
    
    return "there";
  };

  // Get user's avatar or initials
  const getUserAvatar = () => {
    if (!user) return null;
    
    if (user.avatarUrl) {
      return (
        <img 
          src={user.avatarUrl} 
          alt={user.name || "User"}
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }
    
    // Get initials from name or email
    const getInitials = () => {
      if (user.name) {
        const nameParts = user.name.split(" ");
        if (nameParts.length >= 2) {
          return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
        }
        return user.name[0].toUpperCase();
      }
      
      if (user.email) {
        return user.email[0].toUpperCase();
      }
      
      return "U";
    };

    return (
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <span className="text-sm font-medium text-primary">
          {getInitials()}
        </span>
      </div>
    );
  };

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Left side: User welcome or page title */}
      <div className="flex items-center gap-4">
        {!title ? (
          // Show user welcome when no page title is provided
          <div className="flex items-center gap-3">
            {getUserAvatar()}
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {greeting}, {getUserName()}!
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{currentTime}</span>
                {user?.role && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span className="px-2 py-0.5 bg-secondary rounded text-xs font-medium">
                      {user.role}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Show page title and subtitle when provided
          <div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
      </div>

      {/* Right side: Actions and notifications */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations, contacts, etc..."
            className="w-64 pl-9 pr-4 py-2 text-sm bg-secondary border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Quick Actions - Show only on dashboard */}
        {!title && (
          <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
            <PlusIcon className="w-4 h-4" />
            New Message
          </Button>
        )}

        {/* Help */}
        <Button variant="outline" size="icon" className="hidden sm:flex">
          <QuestionMarkCircleIcon className="w-5 h-5" />
        </Button>
        
        {/* Notifications */}
        <Button variant="outline" size="icon" className="relative">
          <BellIcon className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
            3
          </span>
        </Button>
      </div>
    </header>
  );
}