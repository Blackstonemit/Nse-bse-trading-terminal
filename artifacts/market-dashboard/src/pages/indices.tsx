import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart4, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  TrendingUp, 
  Briefcase,
  Layers,
  Coins
} from "lucide-react";
import { cn } from "@/lib/utils";

type IndexData = {
  symbol: string;
  name: string;
  category: string;
  value: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  dataSource: string;
  timestamp: string;
};

export default function NiftyIndicesPage() {
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "change" | "value">("change");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: indices, isLoading, error } = useQuery<IndexData[]>({
    queryKey: ["market-all-indices"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/all-indices`);
      if (!res.ok) throw new Error("Failed to fetch all indices");
      return res.json();
    },
    refetchInterval: 10000 // refresh every 10s
  });

  const processedIndices = useMemo(() => {
    if (!indices) return [];

    let list = indices;

    // Category filter
    if (activeTab !== "ALL") {
      list = list.filter((idx) => idx.category.toUpperCase() === activeTab.toUpperCase());
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((idx) => 
        idx.name.toLowerCase().includes(q) ||
        idx.symbol.toLowerCase().includes(q) ||
        idx.category.toLowerCase().includes(q)
      );
    }

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
  }, [indices, activeTab, searchQuery, sortBy, sortOrder]);

  const stats = useMemo(() => {
    if (!indices || indices.length === 0) return { advances: 0, declines: 0, total: 0 };
    const advances = indices.filter(i => i.changePercent >= 0).length;
    const declines = indices.length - advances;
    return {
      advances,
      declines,
      total: indices.length
    };
  }, [indices]);

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
            <BarChart4 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight font-mono text-foreground">NIFTY INDEX DIRECTORY</h1>
            <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/30">
              NSE / BSE COMPLETE INDEX DICT
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Browse all broad-based, sectoral, strategy, thematic, and G-Sec/Bond indices in real time.
          </p>
        </div>
      </div>

      {/* Market Breath Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-sm border-muted bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold font-mono text-success">
                {stats.advances}
              </div>
              <p className="text-xs font-bold text-muted-foreground font-mono mt-1">
                ADVANCING INDICES
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-sm border-muted bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold font-mono text-destructive">
                {stats.declines}
              </div>
              <p className="text-xs font-bold text-muted-foreground font-mono mt-1">
                DECLINING INDICES
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-sm border-muted bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold font-mono text-white">
                {Math.round((stats.advances / stats.total) * 100)}%
              </div>
              <p className="text-xs font-bold text-muted-foreground font-mono mt-1">
                ADVANCE-DECLINE RATIO (ADR)
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter and Tab Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto bg-muted/20 border border-muted p-1 rounded-sm">
          <TabsTrigger value="ALL" className="font-mono text-xs px-3 py-1.5 rounded-sm">ALL INDICES</TabsTrigger>
          <TabsTrigger value="Broad-Based" className="font-mono text-xs px-3 py-1.5 rounded-sm">BROAD-BASED</TabsTrigger>
          <TabsTrigger value="Sectoral" className="font-mono text-xs px-3 py-1.5 rounded-sm">SECTORAL</TabsTrigger>
          <TabsTrigger value="Thematic" className="font-mono text-xs px-3 py-1.5 rounded-sm">THEMATIC</TabsTrigger>
          <TabsTrigger value="Strategy" className="font-mono text-xs px-3 py-1.5 rounded-sm">STRATEGY</TabsTrigger>
          <TabsTrigger value="Debt / Bonds" className="font-mono text-xs px-3 py-1.5 rounded-sm">DEBT / BONDS</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Main Table Grid Card */}
      <Card className="rounded-sm border-muted bg-card">
        <div className="p-4 border-b border-muted/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 font-mono text-xs bg-sidebar border-muted text-white"
              placeholder="Filter by name or symbol..."
            />
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="font-mono bg-muted/40 text-muted-foreground border border-muted/50">
              SHOWING: {processedIndices.length} OF {stats.total}
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
              Failed to load indices metrics. Check connectivity.
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
                      INDEX {sortBy === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                    </TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground">CATEGORY</TableHead>
                    <TableHead 
                      className="font-mono text-xs text-muted-foreground text-right cursor-pointer select-none"
                      onClick={() => toggleSort("value")}
                    >
                      VALUE {sortBy === "value" && (sortOrder === "asc" ? "▲" : "▼")}
                    </TableHead>
                    <TableHead 
                      className="font-mono text-xs text-muted-foreground text-right cursor-pointer select-none"
                      onClick={() => toggleSort("change")}
                    >
                      CHANGE % {sortBy === "change" && (sortOrder === "asc" ? "▲" : "▼")}
                    </TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-right">DAY HIGH</TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-right">DAY LOW</TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-center">FEED</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedIndices.map((idx) => {
                    const isBullish = idx.changePercent >= 0;
                    return (
                      <TableRow key={idx.symbol} className="border-muted hover:bg-muted/10">
                        <TableCell className="font-bold text-white">
                          <div>
                            <div className="text-sm font-bold font-mono">{idx.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{idx.symbol}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Badge variant="outline" className="bg-muted/10 text-muted-foreground border-muted/30 uppercase text-[9px]">
                            {idx.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-white">
                          ₹{idx.value.toFixed(2)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono text-sm font-bold",
                          isBullish ? "text-success" : "text-destructive"
                        )}>
                          <div className="flex items-center justify-end gap-1">
                            {isBullish ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {isBullish ? "+" : ""}{idx.changePercent.toFixed(2)}%
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">₹{idx.high.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">₹{idx.low.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-mono">
                          <Badge variant="outline" className={cn(
                            "text-[9px] border-0 px-2 py-0.5",
                            idx.dataSource === "Yahoo" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                          )}>
                            {idx.dataSource}
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
