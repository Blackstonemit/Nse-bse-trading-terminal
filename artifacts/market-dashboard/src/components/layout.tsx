import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { NewsPanel } from "./news-panel";
import { LiveTickerRibbon } from "./live-ticker-ribbon";
import { TopNavbar } from "./top-navbar";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar-open");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [isNewsOpen, setIsNewsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("news-panel-open");
      return saved !== null ? JSON.parse(saved) : false; // Default closed for clean workspace
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("sidebar-open", JSON.stringify(isSidebarOpen));
    } catch {
      // ignore
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    try {
      localStorage.setItem("news-panel-open", JSON.stringify(isNewsOpen));
    } catch {
      // ignore
    }
  }, [isNewsOpen]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
      {/* 1. MarketEasy Live Ticker Ribbon */}
      <LiveTickerRibbon />

      {/* 2. Categorized Megamenu Header */}
      <TopNavbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isNewsOpen={isNewsOpen}
        onToggleNews={() => setIsNewsOpen(!isNewsOpen)}
      />

      <div className="flex-1 flex relative">
        {/* 3. Collapsible Workstation Sidebar */}
        <Sidebar isOpen={isSidebarOpen} />

        {/* 4. Main Content Area with Adaptive Padding */}
        <main
          className={cn(
            "flex-1 min-w-0 transition-all duration-300 ease-in-out min-h-[calc(100vh-5rem)]",
            isSidebarOpen ? "pl-60" : "pl-0",
            isNewsOpen ? "pr-[350px]" : "pr-0"
          )}
        >
          <div className="max-w-[1700px] mx-auto p-4 md:p-6">
            {children}
          </div>
        </main>

        {/* 5. Slide-out Financial News Stream */}
        <NewsPanel isOpen={isNewsOpen} onToggle={() => setIsNewsOpen(!isNewsOpen)} />
      </div>
    </div>
  );
}
