import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F1F6F2] to-green-100 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <div className="mb-6 inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-primary text-white text-4xl font-bold shadow-lg">
          S
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">Sprout</h1>
        <p className="text-xl text-gray-600 mb-8 font-medium">Modern Head Start Management System</p>
        <p className="text-gray-600 mb-10 text-lg leading-relaxed">
          The superior alternative to ChildPlus. Streamlined attendance, health records, 
          family services, and compliance tracking in one intuitive, high-performance platform.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/dashboard">
            <Button size="lg" className="px-12 py-7 text-xl rounded-xl shadow-md hover:shadow-lg transition-all gap-2 bg-primary hover:bg-primary/90">
              Get Started <ArrowRight className="h-6 w-6" />
            </Button>
          </Link>
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
