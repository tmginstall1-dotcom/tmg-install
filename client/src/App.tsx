import { Switch, Route, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { Capacitor } from "@capacitor/core";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Navbar } from "@/components/layout/Navbar";
import { StaffBottomNav } from "@/components/layout/StaffBottomNav";
import { AdminBottomNav } from "@/components/layout/AdminBottomNav";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

import Landing from "@/pages/customer/Landing";

const QuoteStatus = lazy(() => import("@/pages/customer/QuoteStatus"));
const EstimateWizard = lazy(() => import("@/pages/customer/Estimate"));
const Terms = lazy(() => import("@/pages/customer/Terms"));
const Privacy = lazy(() => import("@/pages/customer/Privacy"));
const Login = lazy(() => import("@/pages/admin/Login"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminQuoteDetail = lazy(() => import("@/pages/admin/QuoteDetail"));
const AdminSchedule = lazy(() => import("@/pages/admin/Schedule"));
const AdminExportPDF = lazy(() => import("@/pages/admin/ExportPDF"));
const AdminStaffManagement = lazy(() => import("@/pages/admin/StaffManagement"));
const AdminAnalytics = lazy(() => import("@/pages/admin/Analytics"));
const StaffDashboard = lazy(() => import("@/pages/staff/Dashboard"));
const StaffJobDetail = lazy(() => import("@/pages/staff/JobDetail"));
const StaffHR = lazy(() => import("@/pages/staff/HR"));

import { useAuth } from "@/hooks/use-auth";
import { useGpsTracker } from "@/hooks/use-gps-tracker";
import { usePushNotifications, useDeepLinks } from "@/hooks/use-push-notifications";

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin" />
        <span className="text-[10px] font-black tracking-[0.2em] uppercase text-black/30">Loading</span>
      </div>
    </div>
  );
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return <PageLoader />;
  if (!user) { setLocation('/admin/login'); return null; }
  if (user.role !== 'admin') { setLocation('/staff'); return null; }
  return <Component />;
}

function StaffRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useGpsTracker(!!user && user.role === "staff");

  if (isLoading) return <PageLoader />;
  if (!user) { setLocation('/staff/login'); return null; }
  if (user.role === 'admin') { setLocation('/admin'); return null; }
  return <Component />;
}

function isNativeApp(): boolean {
  if (navigator.userAgent.includes("TMGStaffApp")) return true;
  try { if (Capacitor.isNativePlatform()) return true; } catch {}
  try { if ((window as any).Capacitor?.isNativePlatform?.()) return true; } catch {}
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

/** Hides the native splash screen once the app is fully mounted */
function SplashHider() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let mounted = true;
    (async () => {
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        // Brief delay so the first frame renders before hiding
        setTimeout(async () => {
          if (!mounted) return;
          await SplashScreen.hide({ fadeOutDuration: 400 });
        }, 300);
      } catch {
        // SplashScreen not available — ignore
      }
    })();
    return () => { mounted = false; };
  }, []);
  return null;
}

function Router() {
  // Register push notifications + deep link listeners (native only)
  usePushNotifications();
  useDeepLinks();

  return (
    <>
      <NativeRedirect />
      <SplashHider />
      <Navbar />
      <AdminSidebar />
      <StaffBottomNav />
      <AdminBottomNav />
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/estimate" component={EstimateWizard} />
          <Route path="/quotes/:id" component={QuoteStatus} />
          <Route path="/terms" component={Terms} />
          <Route path="/privacy" component={Privacy} />

          <Route path="/admin/login" component={Login} />
          <Route path="/staff/login" component={Login} />

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
          <Route path="/admin/analytics">
            {() => <AdminRoute component={AdminAnalytics} />}
          </Route>

          <Route path="/staff">
            {() => <StaffRoute component={StaffDashboard} />}
          </Route>
          <Route path="/staff/jobs/:id">
            {() => <StaffRoute component={StaffJobDetail} />}
          </Route>
          <Route path="/staff/hr">
            {() => <StaffRoute component={StaffHR} />}
          </Route>

          <Route component={NotFound} />
        </Switch>
      </Suspense>
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
