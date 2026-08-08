import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClientAuthProvider, useClientAuth } from "@/lib/clientAuth";
import { PortalLayout } from "@/components/layout/PortalLayout";

import SignupPage from "@/pages/public/SignupPage";
import VerifyEmailPage from "@/pages/public/VerifyEmailPage";
import SetPasswordPage from "@/pages/public/SetPasswordPage";
import LoginPage from "@/pages/public/LoginPage";

import DashboardPage from "@/pages/portal/DashboardPage";
import DepositPage from "@/pages/portal/DepositPage";
import WithdrawPage from "@/pages/portal/WithdrawPage";
import TransferPage from "@/pages/portal/TransferPage";
import TradingAccountsPage from "@/pages/portal/TradingAccountsPage";
import TransactionsPage from "@/pages/portal/TransactionsPage";
import VerificationPage from "@/pages/portal/VerificationPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// Everything under PortalLayout requires a logged-in client.
function Protected({ children }: { children: React.ReactNode }) {
  const { client, isLoading } = useClientAuth();
  if (isLoading) return null;
  if (!client) return <Redirect to="/login" />;
  return <PortalLayout>{children}</PortalLayout>;
}

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={base}>
          <ClientAuthProvider>
            <Switch>
              <Route path="/signup"><SignupPage /></Route>
              <Route path="/verify"><VerifyEmailPage /></Route>
              <Route path="/set-password"><SetPasswordPage /></Route>
              <Route path="/login"><LoginPage /></Route>
              <Route path="/"><Protected><DashboardPage /></Protected></Route>
              <Route path="/deposit"><Protected><DepositPage /></Protected></Route>
              <Route path="/withdraw"><Protected><WithdrawPage /></Protected></Route>
              <Route path="/transfer"><Protected><TransferPage /></Protected></Route>
              <Route path="/accounts"><Protected><TradingAccountsPage /></Protected></Route>
              <Route path="/history"><Protected><TransactionsPage /></Protected></Route>
              <Route path="/verification"><Protected><VerificationPage /></Protected></Route>
              <Route><Redirect to="/" /></Route>
            </Switch>
          </ClientAuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
