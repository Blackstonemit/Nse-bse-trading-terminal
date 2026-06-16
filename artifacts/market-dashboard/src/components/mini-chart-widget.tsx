import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";

export default function MiniChartWidget({ symbol }: { symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  // Fetch quotes history from API - query 5d period to ensure weekend data is available
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-chart", symbol],
    queryFn: async () => {
      const res = await fetch(`${base}/api/market/history?symbol=${encodeURIComponent(symbol)}&interval=5m&period=5d`);
      if (!res.ok) throw new Error();
      return res.json();
    },
    staleTime: 15000,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!chartContainerRef.current || !data?.candles || data.candles.length === 0) return;

    chartInstance.current?.remove();
    chartInstance.current = null;

    const chart = createChart(chartContainerRef.current, {
      layout: { 
        background: { type: ColorType.Solid, color: "transparent" }, 
        textColor: "#666666",
        fontSize: 9,
        fontFamily: "monospace",
      },
      grid: { 
        vertLines: { color: "#151515" }, 
        horzLines: { color: "#151515" } 
      },
      width: chartContainerRef.current.clientWidth || 300,
      height: 280,
      timeScale: {
        borderColor: "#151515",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "#151515",
      },
    });
    chartInstance.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const ohlc = data.candles
      .filter((c: any) => c && c.close > 0)
      .map((c: any) => ({
        time: (Math.floor(new Date(c.timestamp).getTime() / 1000) + 19800),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
      .sort((a: any, b: any) => a.time - b.time);

    series.setData(ohlc);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.resize(chartContainerRef.current.clientWidth, 280);
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      chartInstance.current?.remove();
      chartInstance.current = null;
      resizeObserver.disconnect();
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center font-mono text-[10px] text-muted-foreground animate-pulse">
        LOADING DATA FEED FOR {symbol}...
      </div>
    );
  }

  if (!data?.candles || data.candles.length === 0) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center font-mono text-[10px] text-yellow-500/80 p-4 text-center">
        <span>NO RECENT TICKER DATA FOUND</span>
        <span className="text-[8px] text-muted-foreground mt-1">Market may be closed or symbol is inactive</span>
      </div>
    );
  }

  return (
    <div className="relative p-1">
      <div ref={chartContainerRef} className="w-full h-[300px] bg-transparent" />
    </div>
  );
}
