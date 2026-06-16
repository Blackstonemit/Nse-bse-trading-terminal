import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TerminalSquare, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";

export default function LoginPage() {
  const { login, isLoading } = useAuth();

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.href = `${base}/api/auth/google/callback?code=mock_auth_code`;
  }, []);

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-success/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Cyber Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      <div className="w-full max-w-[440px] z-10 transition-all duration-500 animate-in fade-in slide-in-from-bottom-8">
        <Card className="border-primary/20 bg-card/45 backdrop-blur-xl shadow-2xl rounded-md relative overflow-hidden">
          {/* Glass Card Glow Line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
          
          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto bg-primary/10 border border-primary/30 p-3 rounded-md w-12 h-12 flex items-center justify-center mb-4">
              <TerminalSquare className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight font-mono text-white flex items-center justify-center gap-2">
              QUANT TERMINAL <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            </CardTitle>
            <CardDescription className="font-mono text-xs text-muted-foreground mt-2">
              NSE/BSE AI Trading Signals & Analytics Dashboard
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 pb-8">
            <div className="border border-muted-border/40 bg-muted/5 p-4 rounded-sm space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-primary">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>INTEGRATED SUITE</span>
              </div>
              <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
                <li>Real-time Indian market data indexing</li>
                <li>AI Signals (DeepSeek / Qwen / Gemini / Claude)</li>
                <li>Visual Options Strategy chain & payoff grids</li>
                <li>Keyboard-driven Pro Scalping console</li>
                <li>Local SQLite/LibSQL secure storage</li>
              </ul>
            </div>

            <Button
              onClick={login}
              disabled={isLoading}
              size="lg"
              className="w-full font-mono font-bold text-xs bg-primary hover:bg-primary/95 text-white flex items-center justify-center gap-3 h-11 border border-primary-border/20 shadow-md shadow-primary/10 transition-all duration-300 active:scale-[0.98]"
            >
              {isLoading ? (
                <span>INITIALIZING SECURE SESSION...</span>
              ) : (
                <>
                  {/* Google SVG Icon */}
                  <svg className="h-4 w-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>SIGN IN WITH GOOGLE</span>
                </>
              )}
            </Button>

            <Button
              onClick={() => {
                const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                window.location.href = `${base}/api/auth/google/callback?code=mock_auth_code`;
              }}
              variant="outline"
              size="lg"
              className="w-full font-mono font-bold text-xs border border-muted/60 hover:bg-muted/10 text-muted-foreground hover:text-white flex items-center justify-center gap-3 h-11 transition-all duration-300 active:scale-[0.98]"
            >
              <span>CONTINUE WITH MOCK CREDENTIALS</span>
            </Button>

            <div className="flex items-center gap-2 border border-dashed border-muted-border/60 bg-muted/5 p-3 rounded-sm text-[10px] font-mono text-muted-foreground leading-normal">
              <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
              <span>
                To execute local sandbox flows without cloud keys, verify that your Google client IDs are set or proceed via local mock credentials.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
