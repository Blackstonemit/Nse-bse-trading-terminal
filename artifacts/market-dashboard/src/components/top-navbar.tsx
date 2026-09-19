import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  TrendingUp,
  ChevronDown,
  Activity,
  Layers,
  Sparkles,
  DollarSign,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
  Newspaper,
  Settings2,
  List,
  Target,
  Zap,
  Rocket,
  Flame,
  PieChart,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface DropdownItem {
  href: string;
  label: string;
  desc?: string;
  badge?: string;
  badgeColor?: string;
}

interface TopNavbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isNewsOpen: boolean;
  onToggleNews: () => void;
}

export function TopNavbar({
  isSidebarOpen,
  onToggleSidebar,
  isNewsOpen,
  onToggleNews,
}: TopNavbarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuClick = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const marketsMenu: DropdownItem[] = [
    { href: "/", label: "Live Dashboard", desc: "Real-time quotes, indices & heatmaps" },
    { href: "/conviction-picks", label: "Conviction Picks", desc: "Analyst targets & upside potential", badge: "NEW", badgeColor: "bg-blue-600 text-white" },
    { href: "/volume-shockers", label: "Volume Shockers", desc: "High volume breakout screener", badge: "HOT", badgeColor: "bg-amber-600 text-white" },
    { href: "/market", label: "Market Feed", desc: "Gainers, losers & market depth" },
    { href: "/sectors", label: "Nifty Sectors", desc: "Sector rotation & performance" },
    { href: "/indices", label: "Nifty Indices", desc: "Index constituent trackers" },
    { href: "/global-markets", label: "Global Exchange", desc: "US, European & Asian indices" },
    { href: "/ipo", label: "IPO Watch", desc: "Open, upcoming & listed IPOs + GMP", badge: "NEW", badgeColor: "bg-emerald-600 text-white" },
  ];

  const derivativesMenu: DropdownItem[] = [
    { href: "/oi-tracker", label: "Live OI Tracker", desc: "Multi-strike OI shift, Max Pain & PCR", badge: "PRO", badgeColor: "bg-indigo-600 text-white" },
    { href: "/options", label: "Options Chain", desc: "NSE Option chain with Greeks & IV" },
    { href: "/options-strategy", label: "Strategy Builder", desc: "Multi-leg options payoff builder" },
    { href: "/futures", label: "Futures Feed", desc: "Spot vs Futures basis & rollover" },
    { href: "/orderflow", label: "Order Flow", desc: "Institutional bulk deals & delivery" },
  ];

  const aiMenu: DropdownItem[] = [
    { href: "/ai-assistant", label: "AI Trading Copilot", desc: "Interactive conversational trading desk", badge: "AI", badgeColor: "bg-cyan-600 text-white" },
    { href: "/signals", label: "Autonomous Signals", desc: "AI worker BUY/SELL/EXIT alerts" },
    { href: "/screener", label: "Multibagger Screener", desc: "10x–100x compounding screen" },
    { href: "/penny-screener", label: "Penny Stock Screener", desc: "Turnaround micro-caps under ₹100" },
  ];

  const commoditiesFundsMenu: DropdownItem[] = [
    { href: "/commodities", label: "Gold & Silver Desk", desc: "Live 24K/22K Gold, MCX Silver & Crude", badge: "LIVE", badgeColor: "bg-amber-500 text-black font-bold" },
    { href: "/mutual-funds", label: "Mutual Funds Explorer", desc: "Top funds, NAV lookup & comparison", badge: "NEW", badgeColor: "bg-emerald-600 text-white" },
  ];

  const toolsMenu: DropdownItem[] = [
    { href: "/scalping", label: "5M Scalper Desk", desc: "VWAP bands & momentum scalping" },
    { href: "/workspace", label: "Custom Workspace", desc: "Drag-and-drop multi-monitor setup" },
    { href: "/paper-trading", label: "Paper Trading", desc: "Simulated execution & live P&L" },
    { href: "/charts", label: "Interactive Charts", desc: "TradingView lightweight charts" },
    { href: "/analysis", label: "Technical Analysis", desc: "14+ indicator sweep engine" },
    { href: "/fundamentals", label: "Fundamental Models", desc: "Valuation & financial statements" },
    { href: "/backtest", label: "Backtest Engine", desc: "Quantitative historical testbed" },
    { href: "/bhavcopy", label: "Bhavcopy Analyzer", desc: "Daily NSE delivery analysis" },
  ];

  return (
    <header className="sticky top-8 z-30 w-full bg-slate-950/95 border-b border-border/40 backdrop-blur-md transition-all" ref={navRef}>
      <div className="h-12 px-4 flex items-center justify-between gap-2">
        {/* Left Section: Sidebar Toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4 text-primary" />
            )}
          </button>

          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold shadow-[0_0_12px_rgba(37,99,235,0.4)] transition-transform group-hover:scale-105">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>NSE/BSE</span>
              <span className="text-blue-400 font-mono text-xs">WORKSTATION</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-900/60 text-blue-300 border border-blue-700/50">
                PRO
              </span>
            </span>
          </Link>
        </div>

        {/* Center: Categorized Nav Dropdowns */}
        <nav className="hidden lg:flex items-center gap-1">
          {/* Markets Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick("markets")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                activeMenu === "markets"
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Markets</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {activeMenu === "markets" && (
              <div className="absolute left-0 mt-1 w-64 rounded-lg bg-slate-900 border border-slate-700/80 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                {marketsMenu.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setActiveMenu(null)}
                    className="flex flex-col px-3 py-1.5 hover:bg-slate-800/80 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200 group-hover:text-blue-400">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded", item.badgeColor)}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.desc && (
                      <span className="text-[10.5px] text-slate-400 leading-tight">
                        {item.desc}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Derivatives Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick("derivatives")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                activeMenu === "derivatives"
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Derivatives</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {activeMenu === "derivatives" && (
              <div className="absolute left-0 mt-1 w-64 rounded-lg bg-slate-900 border border-slate-700/80 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                {derivativesMenu.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setActiveMenu(null)}
                    className="flex flex-col px-3 py-1.5 hover:bg-slate-800/80 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200 group-hover:text-indigo-400">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded", item.badgeColor)}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.desc && (
                      <span className="text-[10.5px] text-slate-400 leading-tight">
                        {item.desc}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* AI Trading Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick("ai")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                activeMenu === "ai"
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Trading</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {activeMenu === "ai" && (
              <div className="absolute left-0 mt-1 w-64 rounded-lg bg-slate-900 border border-slate-700/80 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                {aiMenu.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setActiveMenu(null)}
                    className="flex flex-col px-3 py-1.5 hover:bg-slate-800/80 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200 group-hover:text-cyan-400">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded", item.badgeColor)}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.desc && (
                      <span className="text-[10.5px] text-slate-400 leading-tight">
                        {item.desc}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Commodities & Funds Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick("commodities")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                activeMenu === "commodities"
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              <span>Commodities & Funds</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {activeMenu === "commodities" && (
              <div className="absolute left-0 mt-1 w-64 rounded-lg bg-slate-900 border border-slate-700/80 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                {commoditiesFundsMenu.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setActiveMenu(null)}
                    className="flex flex-col px-3 py-1.5 hover:bg-slate-800/80 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200 group-hover:text-amber-400">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded", item.badgeColor)}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.desc && (
                      <span className="text-[10.5px] text-slate-400 leading-tight">
                        {item.desc}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Tools Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick("tools")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                activeMenu === "tools"
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Wrench className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tools</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {activeMenu === "tools" && (
              <div className="absolute left-0 mt-1 w-64 rounded-lg bg-slate-900 border border-slate-700/80 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                {toolsMenu.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setActiveMenu(null)}
                    className="flex flex-col px-3 py-1.5 hover:bg-slate-800/80 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200 group-hover:text-emerald-400">
                        {item.label}
                      </span>
                    </div>
                    {item.desc && (
                      <span className="text-[10.5px] text-slate-400 leading-tight">
                        {item.desc}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/watchlist"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <List className="w-3.5 h-3.5 text-yellow-400" />
            <span>Watchlist</span>
          </Link>
        </nav>

        {/* Right Section: Quick Actions, News Panel Toggle & Settings */}
        <div className="flex items-center gap-2">
          <Link
            href="/ai-assistant"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-medium transition-all"
          >
            <Bot className="w-3.5 h-3.5 text-blue-400" />
            <span>AI Copilot</span>
          </Link>

          <button
            onClick={onToggleNews}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
              isNewsOpen
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            )}
            title="Toggle Live Financial News Stream"
          >
            <Newspaper className="w-3.5 h-3.5" />
            <span className="hidden md:inline">News</span>
          </button>

          <Link
            href="/settings"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Settings & AI Providers"
          >
            <Settings2 className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
