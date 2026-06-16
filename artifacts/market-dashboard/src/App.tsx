import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import Dashboard from "@/pages/dashboard";
import SignalsBoard from "@/pages/signals";
import MarketFeed from "@/pages/market";
import OptionsChain from "@/pages/options";
import FuturesFeed from "@/pages/futures";
import AnalysisBoard from "@/pages/analysis";
import WatchlistBoard from "@/pages/watchlist";
import BacktestPage from "@/pages/backtest";
import SettingsDashboard from "@/pages/settings";
import ChartsPage from "@/pages/charts";
import BhavcopyPage from "@/pages/bhavcopy";
import ScalpingPage from "@/pages/scalping";
import PaperTradingPage from "@/pages/paper-trading";
import OptionsStrategy from "@/pages/options-strategy";
import Workspace from "@/pages/workspace";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center font-mono text-xs text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        LOADING SECURE QUANT RUNTIME...
      </div>
    );
  }

  if (!user && location !== "/login") {
    setLocation("/login");
    return null;
  }

  if (user && location === "/login") {
    setLocation("/");
    return null;
  }

  if (location === "/login") {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/signals" component={SignalsBoard} />
        <Route path="/market" component={MarketFeed} />
        <Route path="/options" component={OptionsChain} />
        <Route path="/futures" component={FuturesFeed} />
        <Route path="/analysis" component={AnalysisBoard} />
        <Route path="/watchlist" component={WatchlistBoard} />
        <Route path="/backtest" component={BacktestPage} />
        <Route path="/charts" component={ChartsPage} />
        <Route path="/bhavcopy" component={BhavcopyPage} />
        <Route path="/scalping" component={ScalpingPage} />
        <Route path="/paper-trading" component={PaperTradingPage} />
        <Route path="/options-strategy" component={OptionsStrategy} />
        <Route path="/workspace" component={Workspace} />
        <Route path="/settings" component={SettingsDashboard} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
