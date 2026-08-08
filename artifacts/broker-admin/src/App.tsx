import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminAuthProvider, useAdminAuth } from "@/lib/adminAuth";
import { AdminLayout } from "@/components/layout/AdminLayout";

import LoginPage from "@/pages/LoginPage";
import OverviewPage from "@/pages/OverviewPage";
import ClientsPage from "@/pages/ClientsPage";
import ClientDetailPage from "@/pages/ClientDetailPage";
import TransactionsPage from "@/pages/TransactionsPage";
import TradingAccountsPage from "@/pages/TradingAccountsPage";
import SettingsPage from "@/pages/SettingsPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Protected({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAdminAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  return <AdminLayout>{children}</AdminLayout>;
}

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={base}>
          <AdminAuthProvider>
            <Switch>
              <Route path="/login"><LoginPage /></Route>
              <Route path="/"><Protected><OverviewPage /></Protected></Route>
              <Route path="/clients"><Protected><ClientsPage /></Protected></Route>
              <Route path="/clients/:id">
                {(params) => <Protected><ClientDetailPage id={Number(params.id)} /></Protected>}
              </Route>
              <Route path="/transactions"><Protected><TransactionsPage /></Protected></Route>
              <Route path="/accounts"><Protected><TradingAccountsPage /></Protected></Route>
              <Route path="/settings"><Protected><SettingsPage /></Protected></Route>
              <Route><Redirect to="/" /></Route>
            </Switch>
          </AdminAuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
