import { Router as WouterRouter, Route, Switch, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { CustomerAuthProvider, useCustomerAuth } from "@/lib/customerAuth";
import CustomerLayout from "@/components/layout/CustomerLayout";
import CustomerAuthPage from "@/pages/public/CustomerAuthPage";
import CustomerDashboardPage from "@/pages/customer/DashboardPage";
import IndicatorAccessPage from "@/pages/customer/IndicatorAccessPage";
import CustomerSupportPage from "@/pages/customer/SupportPage";
import CustomerAccountPage from "@/pages/customer/AccountPage";

// The INDICATOR CUSTOMER portal.
//
// This app previously served the broker trading-client platform (deposits,
// withdrawals, KYC, MT5). Those pages still exist under src/pages/portal/ but
// are no longer routed — see docs/SESSION-LOG.md. They are left in place rather
// than deleted here so the switch-over is one reviewable change and the
// deletion is another.

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Protected({ children }: { children: React.ReactNode }) {
  const { customer, isLoading } = useCustomerAuth();
  // Render nothing rather than the login page while the stored token is being
  // revalidated — otherwise every refresh flashes "Sign in" at somebody who is
  // already signed in.
  if (isLoading) return null;
  if (!customer) return <Redirect to="/login" />;
  return <CustomerLayout>{children}</CustomerLayout>;
}

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={base}>
          <CustomerAuthProvider>
            <Switch>
              <Route path="/login"><CustomerAuthPage /></Route>
              <Route path="/"><Protected><CustomerDashboardPage /></Protected></Route>
              <Route path="/indicator"><Protected><IndicatorAccessPage /></Protected></Route>
              <Route path="/support"><Protected><CustomerSupportPage /></Protected></Route>
              <Route path="/account"><Protected><CustomerAccountPage /></Protected></Route>
              <Route><Redirect to="/" /></Route>
            </Switch>
          </CustomerAuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
