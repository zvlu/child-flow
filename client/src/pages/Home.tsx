import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getLoginUrl } from "@/const";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const loginUrl = getLoginUrl();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">ChildFlow</h1>
          <p className="text-lg text-gray-600 mb-8">Modern Head Start Management System</p>
          <p className="text-gray-600 mb-8">Streamlined attendance, health records, family services, and compliance tracking in one intuitive platform.</p>
          <a href={loginUrl}>
            <Button size="lg" className="w-full">
              Sign In with Your Agency ID
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">ChildFlow</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
            <Button variant="outline" onClick={() => window.location.href = loginUrl}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="text-sm font-medium text-muted-foreground">Total Children</div>
            <div className="text-3xl font-bold text-foreground mt-2">--</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="text-sm font-medium text-muted-foreground">Present Today</div>
            <div className="text-3xl font-bold text-foreground mt-2">--</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="text-sm font-medium text-muted-foreground">Staff Members</div>
            <div className="text-3xl font-bold text-foreground mt-2">--</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="text-sm font-medium text-muted-foreground">Pending Actions</div>
            <div className="text-3xl font-bold text-foreground mt-2">0</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <span className="text-2xl mb-2">📋</span>
              <span>Attendance</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <span className="text-2xl mb-2">👶</span>
              <span>Children</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <span className="text-2xl mb-2">❤️</span>
              <span>Health Records</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <span className="text-2xl mb-2">👨‍👩‍👧</span>
              <span>Family Services</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <span className="text-2xl mb-2">📊</span>
              <span>Reports</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <span className="text-2xl mb-2">⚙️</span>
              <span>Settings</span>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
