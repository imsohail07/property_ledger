import React from "react";
import { cn } from "../../lib/utils";

export const Table: React.FC<React.HTMLAttributes<HTMLTableElement>> = ({ className, ...props }) => (
  <div className="w-full overflow-auto rounded-lg border border-border">
    <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, ...props }) => (
  <thead className={cn("[&_tr]:border-b bg-slate-50 dark:bg-slate-900", className)} {...props} />
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, ...props }) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className, ...props }) => (
  <th
    className={cn(
      "h-10 px-4 text-center align-middle font-semibold text-muted-foreground [&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:pl-4 text-xs uppercase tracking-wider",
      className
    )}
    {...props}
  />
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className, ...props }) => (
  <tr
    className={cn(
      "border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, ...props }) => (
  <td
    className={cn(
      "p-4 align-middle [&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:pl-4 text-center",
      className
    )}
    {...props}
  />
);
