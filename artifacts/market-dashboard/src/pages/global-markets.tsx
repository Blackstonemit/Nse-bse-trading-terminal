import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Globe, ArrowUpRight, ArrowDownRight, Clock, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type GlobalIndex = {
  id: string;
  symbol: string;
  name: string;
  region: string;
  country: string;
  openTime: string;
  closeTime: string;
  timezone: string;
  price: number;
  change: number;
  changePercent: number;
  status: "OPEN" | "CLOSED" | "PRE_MARKET";
  timestamp: string;
};

export default function GlobalMarketsPage() {
  const { data: indices = [], isLoading, refetch } = useQuery<GlobalIndex[]>({
    queryKey: ["/api/market/global"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/global`);
      if (!res.ok) throw new Error("Failed to fetch global indices");
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30s manually fallback
  });

  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh } = useLiveRefresh({
    onRefresh: refetch,
  });

  const fmt = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getTimeInTimezone = (tz: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(new Date());
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-sm border border-primary/20 text-primary">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">GLOBAL EXCHANGE</h1>
            <p className="text-xs text-muted-foreground font-mono">
              Live tracking of major international indices and market operating hours.
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <LiveRefreshBar
            isMarketOpen={isMarketOpen}
            isPreOpen={isPreOpen}
            lastUpdatedIST={lastUpdatedIST}
            countdown={countdown}
            onRefresh={refresh}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-sm border border-muted bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-mono text-xs">REGION</TableHead>
                <TableHead className="font-mono text-xs">INDEX</TableHead>
                <TableHead className="font-mono text-xs text-right">VALUE</TableHead>
                <TableHead className="font-mono text-xs text-right">CHANGE</TableHead>
                <TableHead className="font-mono text-xs text-center">STATUS</TableHead>
                <TableHead className="font-mono text-xs text-right">LOCAL TIME</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indices.map((idx) => {
                const isUp = idx.change >= 0;
                return (
                  <TableRow key={idx.id} className="group hover:bg-muted/10 transition-colors">
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-muted">
                        {idx.region.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold font-mono text-sm tracking-tight">{idx.name}</span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                          <MapPin className="h-3 w-3" />
                          {idx.country} ({idx.symbol})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold font-mono text-sm tabular-nums">
                        {fmt(idx.price)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={cn(
                        "flex items-center justify-end gap-1 text-xs font-mono font-medium",
                        isUp ? "text-green-400" : "text-red-400"
                      )}>
                        {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        <span>{isUp ? "+" : ""}{fmt(idx.change)}</span>
                        <span>({isUp ? "+" : ""}{idx.changePercent.toFixed(2)}%)</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={idx.status === "OPEN" ? "default" : idx.status === "PRE_MARKET" ? "outline" : "secondary"}
                        className={cn(
                          "text-[9px] font-mono mx-auto",
                          idx.status === "OPEN" ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/30" :
                          idx.status === "PRE_MARKET" ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" :
                          "opacity-60"
                        )}>
                        {idx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs font-mono flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {getTimeInTimezone(idx.timezone)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {idx.openTime} - {idx.closeTime}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
