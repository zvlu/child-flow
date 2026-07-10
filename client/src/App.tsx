import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Children from "./pages/Children";
import DataImport from "./pages/DataImport";
import Kiosk from "./pages/Kiosk";
import ChildDetail from "./pages/ChildDetail";
import DailyReports from "./pages/DailyReports";
import LessonPlanning from "./pages/LessonPlanning";
import Portfolios from "./pages/Portfolios";
import Subsidies from "./pages/Subsidies";
import GlossaryPage from "./pages/GlossaryPage";
import Attendance from "./pages/Attendance";
import ChronicAbsence from "./pages/ChronicAbsence";
import FamilyPartnership from "./pages/FamilyPartnership";
import PolicyCouncil from "./pages/PolicyCouncil";
import DisabilityServices from "./pages/DisabilityServices";
import GrantBudget from "./pages/GrantBudget";
import ClassroomQuality from "./pages/ClassroomQuality";
import Health from "./pages/Health";
import HealthDeadlines from "./pages/HealthDeadlines";
import FamilyServices from "./pages/FamilyServices";
import Staff from "./pages/Staff";
import Reports from "./pages/Reports";
import Enrollment from "./pages/Enrollment";
import Compliance from "./pages/Compliance";
import PerformancePanel from "./pages/PerformancePanel";
import Communication from "./pages/Communication";
import Settings from "./pages/Settings";
import ClassroomDashboard from "./pages/ClassroomDashboard";
import Calendar from "./pages/Calendar";
import { DocumentManagement } from "./pages/DocumentManagement";
import { BulkActionCenter } from "./pages/BulkActionCenter";
import { AIInsights } from "./pages/AIInsights";
import { Billing } from "./pages/Billing";
import { ParentPortal } from "./pages/ParentPortal";
import { DigitalDocuments } from "./pages/DigitalDocuments";
import { MealPlanning } from "./pages/MealPlanning";
import { StaffOperations } from "./pages/StaffOperations";
import { ReportBuilder } from "./pages/ReportBuilder";
import { ActionQueue } from "./pages/ActionQueue";
import InKind from "./pages/InKind";
import Assessments from "./pages/Assessments";
import OrgAdmin from "./pages/OrgAdmin";
import RequestProgram from "./pages/RequestProgram";
import SignIn from "./pages/SignIn";
import AppLayout from "./components/AppLayout";
import ModuleGate from "./components/ModuleGate";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/request-program" component={RequestProgram} />
      <Route path="/signin" component={SignIn} />
      {/* Kiosk runs chromeless — it's the tablet at the classroom door. */}
      <Route path="/kiosk" component={Kiosk} />
      <Route path="/dashboard">
        {() => (
          <AppLayout>
            <Dashboard />
          </AppLayout>
        )}
      </Route>
      <Route path="/classrooms">
        {() => (
          <AppLayout>
            <ClassroomDashboard />
          </AppLayout>
        )}
      </Route>
      <Route path="/calendar">
        {() => (
          <AppLayout>
            <Calendar />
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
      <Route path="/data-import">
        {() => (
          <AppLayout>
            <DataImport />
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
      <Route path="/daily-reports">
        {() => (
          <AppLayout>
            <DailyReports />
          </AppLayout>
        )}
      </Route>
      <Route path="/lesson-planning">
        {() => (
          <AppLayout>
            <LessonPlanning />
          </AppLayout>
        )}
      </Route>
      <Route path="/portfolios">
        {() => (
          <AppLayout>
            <Portfolios />
          </AppLayout>
        )}
      </Route>
      <Route path="/subsidies">
        {() => (
          <AppLayout>
            <Subsidies />
          </AppLayout>
        )}
      </Route>
      <Route path="/glossary">
        {() => (
          <AppLayout>
            <GlossaryPage />
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
      <Route path="/in-kind">
        {() => (
          <AppLayout>
            <ModuleGate module="head_start">
              <InKind />
            </ModuleGate>
          </AppLayout>
        )}
      </Route>
      <Route path="/assessments">
        {() => (
          <AppLayout>
            <Assessments />
          </AppLayout>
        )}
      </Route>
      <Route path="/org-admin">
        {() => (
          <AppLayout>
            <OrgAdmin />
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
      <Route path="/chronic-absence">
        {() => (
          <AppLayout>
            <ModuleGate module="head_start">
              <ChronicAbsence />
            </ModuleGate>
          </AppLayout>
        )}
      </Route>
      <Route path="/family-partnership">
        {() => (
          <AppLayout>
            <ModuleGate module="head_start">
              <FamilyPartnership />
            </ModuleGate>
          </AppLayout>
        )}
      </Route>
      <Route path="/policy-council">
        {() => (
          <AppLayout>
            <ModuleGate module="head_start">
              <PolicyCouncil />
            </ModuleGate>
          </AppLayout>
        )}
      </Route>
      <Route path="/disability-services">
        {() => (
          <AppLayout>
            <ModuleGate module="head_start">
              <DisabilityServices />
            </ModuleGate>
          </AppLayout>
        )}
      </Route>
      <Route path="/grant-budget">
        {() => (
          <AppLayout>
            <ModuleGate module="head_start">
              <GrantBudget />
            </ModuleGate>
          </AppLayout>
        )}
      </Route>
      <Route path="/classroom-quality">
        {() => (
          <AppLayout>
            <ModuleGate module="head_start">
              <ClassroomQuality />
            </ModuleGate>
          </AppLayout>
        )}
      </Route>
      <Route path="/communication">
        {() => (
          <AppLayout>
            <Communication />
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
      <Route path="/health-deadlines">
        {() => (
          <AppLayout>
            <ModuleGate module="head_start">
              <HealthDeadlines />
            </ModuleGate>
          </AppLayout>
        )}
      </Route>
      <Route path="/family-services">
        {() => (
          <AppLayout>
            <ModuleGate module="head_start">
              <FamilyServices />
            </ModuleGate>
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
            <ModuleGate module="head_start">
              <Compliance />
            </ModuleGate>
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
      <Route path="/documents">
        {() => (
          <AppLayout>
            <DocumentManagement />
          </AppLayout>
        )}
      </Route>
      <Route path="/bulk-actions">
        {() => (
          <AppLayout>
            <BulkActionCenter />
          </AppLayout>
        )}
      </Route>
      <Route path="/ai-insights">
        {() => (
          <AppLayout>
            <AIInsights />
          </AppLayout>
        )}
      </Route>
      <Route path="/billing">
        {() => (
          <AppLayout>
            <Billing />
          </AppLayout>
        )}
      </Route>
      <Route path="/parent-portal">
        {() => (
          <AppLayout>
            <ParentPortal />
          </AppLayout>
        )}
      </Route>
      <Route path="/digital-documents">
        {() => (
          <AppLayout>
            <DigitalDocuments />
          </AppLayout>
        )}
      </Route>
      <Route path="/meal-planning">
        {() => (
          <AppLayout>
            <MealPlanning />
          </AppLayout>
        )}
      </Route>
      <Route path="/staff-operations">
        {() => (
          <AppLayout>
            <StaffOperations />
          </AppLayout>
        )}
      </Route>
      <Route path="/report-builder">
        {() => (
          <AppLayout>
            <ReportBuilder />
          </AppLayout>
        )}
      </Route>
      <Route path="/action-queue">
        {() => (
          <AppLayout>
            <ActionQueue />
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
          <ConfirmProvider>
            <Toaster richColors position="top-right" />
            <Router />
          </ConfirmProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
