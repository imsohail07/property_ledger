import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Building, LogOut } from "lucide-react";
import { Button } from "./ui/Button";

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  // Force light theme by removing dark class from document element
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  const getInitials = () => {
    if (!user?.displayName) return "L";
    return user.displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div className="flex items-center space-x-2 text-primary">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Building className="h-6 w-6" />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            RentLedger
          </span>
        </div>

        {/* User Info, Logout */}
        <div className="flex items-center space-x-4">
          
          {/* Landlord Profile */}
          <div className="hidden sm:flex items-center space-x-2 border-r border-border pr-4 h-8">
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs">
              {getInitials()}
            </div>
            <div className="text-left leading-none">
              <p className="text-sm font-semibold">{user?.displayName || "Landlord"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Logout Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="flex items-center space-x-1.5 border-slate-200 rounded-xl shadow-sm text-xs font-semibold"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
