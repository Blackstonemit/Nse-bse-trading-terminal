import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { NewsPanel } from "./news-panel";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isNewsOpen, setIsNewsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("news-panel-open");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("news-panel-open", JSON.stringify(isNewsOpen));
    } catch {
      // ignore
    }
  }, [isNewsOpen]);

  return (
    <div className="min-h-screen bg-background text-foreground dark overflow-x-hidden">
      <Sidebar />
      <main
        className={cn(
          "pl-64 min-h-screen transition-all duration-300 ease-in-out",
          isNewsOpen ? "pr-[350px]" : "pr-0"
        )}
      >
        <div className="max-w-[1600px] mx-auto p-6">
          {children}
        </div>
      </main>
      <NewsPanel isOpen={isNewsOpen} onToggle={() => setIsNewsOpen(!isNewsOpen)} />
    </div>
  );
}

