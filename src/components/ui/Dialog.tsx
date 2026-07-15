import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, children, className }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      {/* Dialog Content */}
      <div className={cn(
        "relative bg-card text-card-foreground border border-border shadow-2xl rounded-xl w-full max-w-lg p-6 z-10 transition-transform duration-300 scale-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95",
        className
      )}>
        <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button 
            onClick={onClose}
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div>
          {children}
        </div>
      </div>
    </div>
  );
};
