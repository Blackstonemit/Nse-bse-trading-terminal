import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// Lazy loaded pages for performance code-splitting
const Dashboard = lazy(() => import("@/pages/dashboard"));
const SignalsBoard = lazy(() => import("@/pages/signals"));
const MarketFeed = lazy(() => import("@/pages/market"));
const OptionsChain = lazy(() => import("@/pages/options"));
const FuturesFeed = lazy(() => import("@/pages/futures"));
const AnalysisBoard = lazy(() => import("@/pages/analysis"));
const FundamentalAnalysisPage = lazy(() => import("@/pages/fundamentals"));
const WatchlistBoard = lazy(() => import("@/pages/watchlist"));
const BacktestPage = lazy(() => import("@/pages/backtest"));
const SettingsDashboard = lazy(() => import("@/pages/settings"));
const ChartsPage = lazy(() => import("@/pages/charts"));
const BhavcopyPage = lazy(() => import("@/pages/bhavcopy"));
const ScalpingPage = lazy(() => import("@/pages/scalping"));
const PaperTradingPage = lazy(() => import("@/pages/paper-trading"));
const OptionsStrategy = lazy(() => import("@/pages/options-strategy"));
const GlobalMarketsPage = lazy(() => import("@/pages/global-markets"));
const Workspace = lazy(() => import("@/pages/workspace"));
const NewsPage = lazy(() => import("@/pages/news"));
const OrderFlowPage = lazy(() => import("@/pages/orderflow"));
const ScreenerPage = lazy(() => import("@/pages/screener"));
const PennyScreenerPage = lazy(() => import("@/pages/penny-screener"));
const LoginPage = lazy(() => import("@/pages/login"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 60000, // 1 minute
      gcTime: 600000, // 10 minutes cache retention
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const mustRedirectToLogin = !user && location !== "/login";
  const mustRedirectToHome = !!user && location === "/login";

  useEffect(() => {
    if (mustRedirectToLogin) {
      setLocation("/login");
    } else if (mustRedirectToHome) {
      setLocation("/");
    }
  }, [mustRedirectToLogin, mustRedirectToHome, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center font-mono text-xs text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        LOADING SECURE QUANT RUNTIME...
      </div>
    );
  }

  if (mustRedirectToLogin || mustRedirectToHome) {
    return null;
  }

  if (location === "/login") {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/signals" component={SignalsBoard} />
          <Route path="/market" component={MarketFeed} />
          <Route path="/options" component={OptionsChain} />
          <Route path="/futures" component={FuturesFeed} />
          <Route path="/analysis" component={AnalysisBoard} />
          <Route path="/fundamentals" component={FundamentalAnalysisPage} />
          <Route path="/watchlist" component={WatchlistBoard} />
          <Route path="/backtest" component={BacktestPage} />
          <Route path="/charts" component={ChartsPage} />
          <Route path="/bhavcopy" component={BhavcopyPage} />
          <Route path="/scalping" component={ScalpingPage} />
          <Route path="/paper-trading" component={PaperTradingPage} />
          <Route path="/options-strategy" component={OptionsStrategy} />
          <Route path="/global-markets" component={GlobalMarketsPage} />
          <Route path="/workspace" component={Workspace} />
          <Route path="/news" component={NewsPage} />
          <Route path="/orderflow" component={OrderFlowPage} />
          <Route path="/screener" component={ScreenerPage} />
          <Route path="/penny-screener" component={PennyScreenerPage} />
          <Route path="/settings" component={SettingsDashboard} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ThemeProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </ThemeProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
