import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

export default function Home() {
  const { loading, isAuthenticated } = useAuth();
  const loginUrl = getLoginUrl();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-green-100 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <div className="mb-6 inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-primary text-white text-4xl font-bold shadow-lg">
          CF
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">ChildFlow</h1>
        <p className="text-xl text-gray-600 mb-8 font-medium">Modern Head Start Management System</p>
        <p className="text-gray-600 mb-10 text-lg leading-relaxed">
          The superior alternative to ChildPlus. Streamlined attendance, health records, 
          family services, and compliance tracking in one intuitive, high-performance platform.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/dashboard">
            <Button size="lg" className="px-8 py-6 text-lg rounded-xl shadow-md hover:shadow-lg transition-all gap-2">
              Enter Dashboard <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          
          {!isAuthenticated && loginUrl !== "/dashboard" && (
            <a href={loginUrl}>
              <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-xl bg-white/50 backdrop-blur-sm">
                Sign In with Agency ID
              </Button>
            </a>
          )}
        </div>
        
        <div className="mt-16 grid grid-cols-3 gap-8 text-sm text-gray-500 font-medium">
          <div>
            <p className="text-primary text-xl font-bold mb-1">100%</p>
            <p>PIR Compliant</p>
          </div>
          <div>
            <p className="text-primary text-xl font-bold mb-1">Real-time</p>
            <p>Analytics</p>
          </div>
          <div>
            <p className="text-primary text-xl font-bold mb-1">Secure</p>
            <p>Data Storage</p>
          </div>
        </div>
      </div>
    </div>
  );
}
