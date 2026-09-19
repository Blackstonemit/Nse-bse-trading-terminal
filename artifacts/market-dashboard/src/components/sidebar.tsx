import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Activity,
  LineChart,
  BarChart2,
  BarChart4,
  Compass,
  Layers,
  TrendingUp,
  List,
  TerminalSquare,
  FlaskConical,
  Settings2,
  CandlestickChart,
  PackageOpen,
  Zap,
  Globe,
  Wallet,
  LogOut,
  User as UserIcon,
  Workflow,
  LayoutGrid,
  BookOpen,
  Rocket,
  Coins,
  Target,
  Flame,
  PieChart,
  Bot,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen?: boolean;
}

interface NavGroup {
  title: string;
  items: {
    href: string;
    label: string;
    icon: any;
    badge?: string;
    badgeColor?: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    title: "MARKETS & DISCOVERY",
    items: [
      { href: "/", label: "Live Dashboard", icon: Activity },
      { href: "/conviction-picks", label: "Conviction Picks", icon: Target, badge: "NEW", badgeColor: "bg-blue-600/80 text-white" },
      { href: "/volume-shockers", label: "Volume Shockers", icon: Flame, badge: "HOT", badgeColor: "bg-amber-600/80 text-white" },
      { href: "/market", label: "Market Feed", icon: LineChart },
      { href: "/sectors", label: "Nifty Sectors", icon: Compass },
      { href: "/indices", label: "Nifty Indices", icon: BarChart4 },
      { href: "/global-markets", label: "Global Exchange", icon: Globe },
      { href: "/ipo", label: "IPO Watch & GMP", icon: Rocket, badge: "NEW", badgeColor: "bg-emerald-600/80 text-white" },
    ],
  },
  {
    title: "DERIVATIVES & F&O",
    items: [
      { href: "/oi-tracker", label: "Live OI Tracker", icon: Layers, badge: "PRO", badgeColor: "bg-indigo-600/80 text-white" },
      { href: "/options", label: "Options Chain", icon: Layers },
      { href: "/options-strategy", label: "Strategy Builder", icon: Workflow },
      { href: "/futures", label: "Futures Feed", icon: BarChart2 },
      { href: "/orderflow", label: "Order Flow", icon: Layers },
    ],
  },
  {
    title: "AI TRADING & SCREENERS",
    items: [
      { href: "/ai-assistant", label: "AI Trading Copilot", icon: Bot, badge: "AI", badgeColor: "bg-cyan-600/80 text-white" },
      { href: "/signals", label: "Signals Board", icon: TerminalSquare },
      { href: "/screener", label: "Multibagger Screener", icon: Rocket },
      { href: "/penny-screener", label: "Penny Screener", icon: Coins },
    ],
  },
  {
    title: "COMMODITIES & FUNDS",
    items: [
      { href: "/commodities", label: "Gold & Silver Desk", icon: DollarSign, badge: "LIVE", badgeColor: "bg-amber-500 text-black font-bold" },
      { href: "/mutual-funds", label: "Mutual Funds", icon: PieChart, badge: "NEW", badgeColor: "bg-emerald-600/80 text-white" },
    ],
  },
  {
    title: "EXECUTION & TOOLS",
    items: [
      { href: "/scalping", label: "5M Scalper", icon: Zap },
      { href: "/workspace", label: "Custom Workspace", icon: LayoutGrid },
      { href: "/paper-trading", label: "Paper Trader", icon: Wallet },
      { href: "/charts", label: "Charts", icon: CandlestickChart },
      { href: "/analysis", label: "Technical Analysis", icon: TrendingUp },
      { href: "/fundamentals", label: "Fundamentals", icon: BookOpen },
      { href: "/backtest", label: "Backtest", icon: FlaskConical },
      { href: "/bhavcopy", label: "Bhavcopy", icon: PackageOpen },
      { href: "/news", label: "Market News", icon: BookOpen },
      { href: "/watchlist", label: "Watchlist", icon: List },
      { href: "/settings", label: "Settings", icon: Settings2 },
    ],
  },
];

export function Sidebar({ isOpen = true }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        "w-60 bg-sidebar/95 backdrop-blur-md border-r border-sidebar-border h-[calc(100vh-5rem)] flex flex-col fixed top-20 left-0 z-20 transition-transform duration-300 ease-in-out",
        !isOpen && "-translate-x-full"
      )}
    >
      <div className="flex-1 overflow-y-auto py-3 px-2 no-scrollbar space-y-4">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="px-2.5 text-[10px] font-mono tracking-wider font-semibold text-slate-500 uppercase">
              {group.title}
            </div>
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href} className="block group">
                    <div
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-150",
                        isActive
                          ? "bg-blue-600/15 text-blue-400 font-semibold border border-blue-500/30"
                          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <item.icon
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                            isActive ? "text-blue-400 scale-110" : "group-hover:scale-110"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={cn("text-[8.5px] font-bold px-1.5 py-0.2 rounded shrink-0", item.badgeColor)}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {user && (
        <div className="p-3 border-t border-sidebar-border font-mono bg-slate-950/40">
          <div className="flex items-center gap-2.5 bg-sidebar-accent/20 p-2 rounded border border-sidebar-border/30">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-6 h-6 rounded-full border border-blue-500/30 shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                <UserIcon className="h-3 w-3 text-blue-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-slate-200 truncate leading-tight">
                {user.name}
              </div>
              <div className="text-[9.5px] text-slate-500 truncate leading-none mt-0.5">
                {user.email}
              </div>
            </div>
            <button
              onClick={logout}
              className="text-slate-500 hover:text-rose-400 transition-colors shrink-0 cursor-pointer p-1"
              title="Log Out"
            >
              <LogOut className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
