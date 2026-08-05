import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import GoldCursor from "@/components/GoldCursor";

// Public Pages
import LandingPage from "@/pages/public/LandingPage";
import LoginPage from "@/pages/public/LoginPage";
import ForgotPasswordPage from "@/pages/public/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/public/ResetPasswordPage";

// Admin Pages
import AdminOverview from "@/pages/admin/Overview";
import AdminApplications from "@/pages/admin/Applications";
import AdminAffiliates from "@/pages/admin/Affiliates";
import AdminCommissions from "@/pages/admin/Commissions";
import AdminPayouts from "@/pages/admin/Payouts";
import AdminMemberships from "@/pages/admin/Memberships";
import AdminAnalytics from "@/pages/admin/Analytics";
import AdminAuditLogs from "@/pages/admin/AuditLogs";
import AdminEmailLogs from "@/pages/admin/EmailLogs";
import AdminAffiliateDetail from "@/pages/admin/AffiliateDetail";
import AdminCustomers from "@/pages/admin/Customers";
import AdminFinance from "@/pages/admin/Finance";
import AdminCustomerDetail from "@/pages/admin/CustomerDetail";
import AdminSupportTickets from "@/pages/admin/SupportTickets";

// Affiliate Pages
import AffiliateDashboard from "@/pages/affiliate/Dashboard";
import AffiliateLinks from "@/pages/affiliate/Links";
import AffiliateCustomers from "@/pages/affiliate/Customers";
import AffiliateCommissions from "@/pages/affiliate/Commissions";
import AffiliatePayouts from "@/pages/affiliate/Payouts";
import AffiliateAnalytics from "@/pages/affiliate/Analytics";
import AffiliateProfile from "@/pages/affiliate/Profile";
import AffiliateResources from "@/pages/affiliate/Resources";
import AffiliateSupport from "@/pages/affiliate/Support";
import AffiliateSecurity from "@/pages/affiliate/Security";

import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, ...rest }: any) {
  return (
    <Route {...rest}>
      {() => (
        <AppLayout>
          <Component />
        </AppLayout>
      )}
    </Route>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/apply" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />

      {/* Admin Routes */}
      <ProtectedRoute path="/admin" component={AdminOverview} />
      <ProtectedRoute path="/admin/applications" component={AdminApplications} />
      <ProtectedRoute path="/admin/affiliates" component={AdminAffiliates} />
      <ProtectedRoute path="/admin/affiliates/:id" component={AdminAffiliateDetail} />
      <ProtectedRoute path="/admin/commissions" component={AdminCommissions} />
      <ProtectedRoute path="/admin/payouts" component={AdminPayouts} />
      <ProtectedRoute path="/admin/memberships" component={AdminMemberships} />
      <ProtectedRoute path="/admin/analytics" component={AdminAnalytics} />
      <ProtectedRoute path="/admin/customers" component={AdminCustomers} />
      <ProtectedRoute path="/admin/finance" component={AdminFinance} />
      <ProtectedRoute path="/admin/memberships/:id/detail" component={AdminCustomerDetail} />
      <ProtectedRoute path="/admin/audit-logs" component={AdminAuditLogs} />
      <ProtectedRoute path="/admin/email-logs" component={AdminEmailLogs} />
      <ProtectedRoute path="/admin/support-tickets" component={AdminSupportTickets} />

      {/* Affiliate Routes */}
      <ProtectedRoute path="/dashboard" component={AffiliateDashboard} />
      <ProtectedRoute path="/dashboard/links" component={AffiliateLinks} />
      <ProtectedRoute path="/dashboard/customers" component={AffiliateCustomers} />
      <ProtectedRoute path="/dashboard/commissions" component={AffiliateCommissions} />
      <ProtectedRoute path="/dashboard/payouts" component={AffiliatePayouts} />
      <ProtectedRoute path="/dashboard/analytics" component={AffiliateAnalytics} />
      <ProtectedRoute path="/dashboard/resources" component={AffiliateResources} />
      <ProtectedRoute path="/dashboard/support" component={AffiliateSupport} />
      <ProtectedRoute path="/dashboard/profile" component={AffiliateProfile} />
      <ProtectedRoute path="/dashboard/security" component={AffiliateSecurity} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
            <GoldCursor />
          </TooltipProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
