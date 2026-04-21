import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Children from "./pages/Children";
import ChildDetail from "./pages/ChildDetail";
import Attendance from "./pages/Attendance";
import Health from "./pages/Health";
import FamilyServices from "./pages/FamilyServices";
import Staff from "./pages/Staff";
import Reports from "./pages/Reports";
import Enrollment from "./pages/Enrollment";
import Compliance from "./pages/Compliance";
import PerformancePanel from "./pages/PerformancePanel";
import Settings from "./pages/Settings";
import AppLayout from "./components/AppLayout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard">
        {() => (
          <AppLayout>
            <Dashboard />
          </AppLayout>
        )}
      </Route>
      <Route path="/performance">
        {() => (
          <AppLayout>
            <PerformancePanel />
          </AppLayout>
        )}
      </Route>
      <Route path="/children">
        {() => (
          <AppLayout>
            <Children />
          </AppLayout>
        )}
      </Route>
      <Route path="/children/:id">
        {(params: { id: string }) => (
          <AppLayout>
            <ChildDetail id={params.id} />
          </AppLayout>
        )}
      </Route>
      <Route path="/enrollment">
        {() => (
          <AppLayout>
            <Enrollment />
          </AppLayout>
        )}
      </Route>
      <Route path="/attendance">
        {() => (
          <AppLayout>
            <Attendance />
          </AppLayout>
        )}
      </Route>
      <Route path="/health">
        {() => (
          <AppLayout>
            <Health />
          </AppLayout>
        )}
      </Route>
      <Route path="/family-services">
        {() => (
          <AppLayout>
            <FamilyServices />
          </AppLayout>
        )}
      </Route>
      <Route path="/staff">
        {() => (
          <AppLayout>
            <Staff />
          </AppLayout>
        )}
      </Route>
      <Route path="/reports">
        {() => (
          <AppLayout>
            <Reports />
          </AppLayout>
        )}
      </Route>
      <Route path="/compliance">
        {() => (
          <AppLayout>
            <Compliance />
          </AppLayout>
        )}
      </Route>
      <Route path="/settings">
        {() => (
          <AppLayout>
            <Settings />
          </AppLayout>
        )}
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
