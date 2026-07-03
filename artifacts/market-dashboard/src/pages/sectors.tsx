import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Compass, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  Activity,
  Layers,
  Percent
} from "lucide-react";
import { cn } from "@/lib/utils";

type SectorData = {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  dataSource: string;
  timestamp: string;
};

export default function NiftySectorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "change" | "value">("change");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: sectors, isLoading, error } = useQuery<SectorData[]>({
    queryKey: ["market-sectors"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/sectors`);
      if (!res.ok) throw new Error("Failed to fetch sector data");
      return res.json();
    },
    refetchInterval: 10000 // refresh every 10s
  });

  const processedSectors = useMemo(() => {
    if (!sectors) return [];
    
    // Filter
    let list = sectors.filter((s) => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort
    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortBy === "name") {
        return sortOrder === "asc" 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (sortBy === "change") {
        valA = a.changePercent;
        valB = b.changePercent;
      } else if (sortBy === "value") {
        valA = a.value;
        valB = b.value;
      }
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    return list;
  }, [sectors, searchQuery, sortBy, sortOrder]);

  const stats = useMemo(() => {
    if (!sectors || sectors.length === 0) return { top: null, worst: null, avgChange: 0 };
    const sorted = [...sectors].sort((a, b) => b.changePercent - a.changePercent);
    const sum = sectors.reduce((acc, curr) => acc + curr.changePercent, 0);
    return {
      top: sorted[0],
      worst: sorted[sorted.length - 1],
      avgChange: sum / sectors.length
    };
  }, [sectors]);

  const toggleSort = (field: "name" | "change" | "value") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight font-mono text-foreground">NIFTY SECTOR TRACKER</h1>
            <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/30">
              NSE SECTORAL INDEXES
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Real-time sectoral heat, performance indicators, and structural rotation metrics.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-bold tracking-wider font-mono text-muted-foreground">TOP PERFORMER</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold font-mono text-white truncate">
                {stats.top?.name || "N/A"}
              </div>
              <p className="text-xs font-bold text-success font-mono mt-0.5">
                +{stats.top?.changePercent.toFixed(2)}% (₹{stats.top?.value.toFixed(2)})
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-bold tracking-wider font-mono text-muted-foreground">WORST PERFORMER</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold font-mono text-white truncate">
                {stats.worst?.name || "N/A"}
              </div>
              <p className="text-xs font-bold text-destructive font-mono mt-0.5">
                {stats.worst?.changePercent.toFixed(2)}% (₹{stats.worst?.value.toFixed(2)})
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-bold tracking-wider font-mono text-muted-foreground">AVERAGE SECTOR RETURN</CardTitle>
              <TrendingUp className={cn("h-4 w-4", stats.avgChange >= 0 ? "text-success" : "text-destructive")} />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold font-mono text-white">
                {stats.avgChange >= 0 ? "+" : ""}{stats.avgChange.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Composite Sector Performance
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Grid / Table Card */}
      <Card className="rounded-sm border-muted bg-card">
        <div className="p-4 border-b border-muted/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 font-mono text-xs bg-sidebar border-muted text-white"
              placeholder="Search Nifty sectors..."
            />
          </div>
          <div className="flex gap-2 text-xs font-mono text-muted-foreground">
            <Badge variant="secondary" className="font-mono bg-muted/40 text-muted-foreground border border-muted/50">
              TOTAL: {processedSectors.length}
            </Badge>
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center text-destructive font-mono text-xs">
              Failed to load sector metrics. Check connectivity.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-muted hover:bg-transparent">
                    <TableHead 
                      className="font-mono text-xs text-muted-foreground cursor-pointer select-none"
                      onClick={() => toggleSort("name")}
                    >
                      SECTOR INDEX {sortBy === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                    </TableHead>
                    <TableHead 
                      className="font-mono text-xs text-muted-foreground text-right cursor-pointer select-none"
                      onClick={() => toggleSort("value")}
                    >
                      INDEX VALUE {sortBy === "value" && (sortOrder === "asc" ? "▲" : "▼")}
                    </TableHead>
                    <TableHead 
                      className="font-mono text-xs text-muted-foreground text-right cursor-pointer select-none"
                      onClick={() => toggleSort("change")}
                    >
                      NET CHG % {sortBy === "change" && (sortOrder === "asc" ? "▲" : "▼")}
                    </TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-right">DAY HIGH</TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-right">DAY LOW</TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-center">TREND SPARK</TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-center">FEED</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedSectors.map((sector) => {
                    const isBullish = sector.changePercent >= 0;
                    return (
                      <TableRow key={sector.symbol} className="border-muted hover:bg-muted/10">
                        <TableCell className="font-bold text-white">
                          <div>
                            <div className="text-sm font-bold font-mono">{sector.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{sector.symbol}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-white">
                          ₹{sector.value.toFixed(2)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono text-sm font-bold",
                          isBullish ? "text-success" : "text-destructive"
                        )}>
                          <div className="flex items-center justify-end gap-1">
                            {isBullish ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {isBullish ? "+" : ""}{sector.changePercent.toFixed(2)}%
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">₹{sector.high.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">₹{sector.low.toFixed(2)}</TableCell>
                        <TableCell className="text-center py-2">
                          <div className="inline-block w-20 h-6">
                            {/* Simple beautiful SVG Sparkline based on change value */}
                            <svg className="w-full h-full" viewBox="0 0 100 30">
                              <path
                                d={isBullish 
                                  ? "M 5 25 Q 25 15 50 18 T 95 5" 
                                  : "M 5 5 Q 25 18 50 15 T 95 25"
                                }
                                fill="none"
                                stroke={isBullish ? "#22c55e" : "#ef4444"}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          <Badge variant="outline" className={cn(
                            "text-[9px] border-0 px-2 py-0.5",
                            sector.dataSource === "Yahoo" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                          )}>
                            {sector.dataSource}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
