import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Components
import { Navbar } from "@/components/layout/Navbar";
import { StaffBottomNav } from "@/components/layout/StaffBottomNav";
import { AdminBottomNav } from "@/components/layout/AdminBottomNav";

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
import AdminStaffManagement from "@/pages/admin/StaffManagement";
import StaffDashboard from "@/pages/staff/Dashboard";
import StaffJobDetail from "@/pages/staff/JobDetail";
import StaffHR from "@/pages/staff/HR";

import { useAuth } from "@/hooks/use-auth";
import { useGpsTracker } from "@/hooks/use-gps-tracker";

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

  // GPS tracker runs across the entire staff session — every page, not just Dashboard
  useGpsTracker(!!user && user.role === "staff");

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) { setLocation('/staff/login'); return null; }
  if (user.role === 'admin') { setLocation('/admin'); return null; }
  return <Component />;
}


function isNativeApp(): boolean {
  // Primary: custom user agent string appended via capacitor.config.ts android.appendUserAgent
  if (navigator.userAgent.includes("TMGStaffApp")) return true;
  // Fallback: Capacitor bridge (works when loading local assets, not remote URLs)
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {}
  try {
    if ((window as any).Capacitor?.isNativePlatform?.()) return true;
  } catch {}
  return false;
}

function NativeRedirect() {
  const [location, setLocation] = useLocation();
  useEffect(() => {
    if (isNativeApp() && (location === "/" || location === "")) {
      setLocation("/staff/login");
    }
  }, [location, setLocation]);
  return null;
}

function Router() {
  return (
    <>
      <NativeRedirect />
      <Navbar />
      <StaffBottomNav />
      <AdminBottomNav />
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
        <Route path="/admin/staff">
          {() => <AdminRoute component={AdminStaffManagement} />}
        </Route>

        {/* Staff Routes */}
        <Route path="/staff">
          {() => <StaffRoute component={StaffDashboard} />}
        </Route>
        <Route path="/staff/jobs/:id">
          {() => <StaffRoute component={StaffJobDetail} />}
        </Route>
        <Route path="/staff/hr">
          {() => <StaffRoute component={StaffHR} />}
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
