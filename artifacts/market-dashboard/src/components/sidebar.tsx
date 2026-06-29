import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  Activity, 
  LineChart, 
  BarChart2, 
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
  Coins
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Live Dashboard", icon: Activity },
  { href: "/workspace", label: "Custom Workspace", icon: LayoutGrid },
  { href: "/screener", label: "Multibagger Screener", icon: Rocket },
  { href: "/penny-screener", label: "Penny Stock Screener", icon: Coins },
  { href: "/signals", label: "Signals Board", icon: TerminalSquare },
  { href: "/scalping", label: "5M Scalper", icon: Zap },
  { href: "/paper-trading", label: "Paper Trader", icon: Wallet },
  { href: "/global-markets", label: "Global Exchange", icon: Globe },
  { href: "/market", label: "Market Feed", icon: LineChart },
  { href: "/orderflow", label: "Order Flow", icon: Layers },
  { href: "/options", label: "Options Chain", icon: Layers },
  { href: "/options-strategy", label: "Strategy Builder", icon: Workflow },
  { href: "/futures", label: "Futures", icon: BarChart2 },
  { href: "/analysis", label: "Technical Analysis", icon: TrendingUp },
  { href: "/fundamentals", label: "Fundamentals", icon: BookOpen },
  { href: "/news", label: "Market News", icon: BookOpen },
  { href: "/charts", label: "Charts", icon: CandlestickChart },
  { href: "/backtest", label: "Backtest", icon: FlaskConical },
  { href: "/bhavcopy", label: "Bhavcopy", icon: PackageOpen },
  { href: "/watchlist", label: "Watchlist", icon: List },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border h-screen flex flex-col fixed top-0 left-0 z-20">
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 text-primary font-bold text-lg font-mono">
          <TerminalSquare className="h-5 w-5" />
          <span>TERMINAL</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="block group">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )} />
                  <span className={cn(
                    "transition-transform duration-200",
                    !isActive && "group-hover:translate-x-1"
                  )}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-sidebar-border space-y-3 font-mono">
        {user && (
          <div className="flex items-center gap-3 bg-sidebar-accent/20 p-2 rounded-sm border border-sidebar-border/30">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full border border-primary/20 shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                <UserIcon className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-white truncate leading-tight mb-0.5">{user.name}</div>
              <div className="text-[9px] text-muted-foreground truncate leading-none">{user.email}</div>
            </div>
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0 cursor-pointer"
              title="Log Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="text-[10px] text-muted-foreground/60 space-y-0.5 border-t border-sidebar-border/30 pt-2 flex items-center justify-between">
          <span>SYSTEM: ONLINE</span>
          <span className="text-success">LATENCY: 12ms</span>
        </div>
      </div>
    </div>
  );
}
