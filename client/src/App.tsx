import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Components
import { Navbar } from "@/components/layout/Navbar";

// Pages
import Landing from "@/pages/customer/Landing";
import QuoteStatus from "@/pages/customer/QuoteStatus";
import EstimateWizard from "@/pages/customer/Estimate";
import Login from "@/pages/admin/Login";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminQuoteDetail from "@/pages/admin/QuoteDetail";
import StaffDashboard from "@/pages/staff/Dashboard";
import StaffJobDetail from "@/pages/staff/JobDetail";

import { useAuth } from "@/hooks/use-auth";

// Simple guard components
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || user.role !== 'admin') {
    setLocation('/admin/login');
    return null;
  }
  return <Component />;
}

function StaffRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) {
    setLocation('/admin/login');
    return null;
  }
  return <Component />;
}


function Router() {
  return (
    <>
      <Navbar />
      <Switch>
        {/* Customer Routes */}
        <Route path="/" component={Landing} />
        <Route path="/estimate" component={EstimateWizard} />
        <Route path="/quotes/:id" component={QuoteStatus} />
        
        {/* Auth Route */}
        <Route path="/admin/login" component={Login} />
        
        {/* Admin Routes */}
        <Route path="/admin">
          {() => <AdminRoute component={AdminDashboard} />}
        </Route>
        <Route path="/admin/quotes/:id">
          {() => <AdminRoute component={AdminQuoteDetail} />}
        </Route>

        {/* Staff Routes */}
        <Route path="/staff">
          {() => <StaffRoute component={StaffDashboard} />}
        </Route>
        <Route path="/staff/jobs/:id">
          {() => <StaffRoute component={StaffJobDetail} />}
        </Route>

        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
