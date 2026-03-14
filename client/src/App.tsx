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
import Terms from "@/pages/customer/Terms";
import Privacy from "@/pages/customer/Privacy";
import Login from "@/pages/admin/Login";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminQuoteDetail from "@/pages/admin/QuoteDetail";
import AdminSchedule from "@/pages/admin/Schedule";
import AdminExportPDF from "@/pages/admin/ExportPDF";
import StaffDashboard from "@/pages/staff/Dashboard";
import StaffJobDetail from "@/pages/staff/JobDetail";

import { useAuth } from "@/hooks/use-auth";

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) { setLocation('/admin/login'); return null; }
  if (user.role !== 'admin') { setLocation('/staff'); return null; }
  return <Component />;
}

function StaffRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) {
    setLocation('/staff/login');
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
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        
        {/* Auth Routes */}
        <Route path="/admin/login" component={Login} />
        <Route path="/staff/login" component={Login} />
        
        {/* Admin Routes */}
        <Route path="/admin">
          {() => <AdminRoute component={AdminDashboard} />}
        </Route>
        <Route path="/admin/schedule">
          {() => <AdminRoute component={AdminSchedule} />}
        </Route>
        <Route path="/admin/quotes/:id">
          {() => <AdminRoute component={AdminQuoteDetail} />}
        </Route>
        <Route path="/admin/export">
          {() => <AdminRoute component={AdminExportPDF} />}
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
