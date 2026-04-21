import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, 
  PieChart, Pie, Cell
} from "recharts";
import { 
  Info, MoreHorizontal, RefreshCw, ChevronDown, 
  Download, FileSpreadsheet, FileText, CalendarDays,
  Settings2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const chronicAbsenceData = [
  { name: "Severe (20+%)", value: 77, color: "#ef4444" },
  { name: "Moderate (10-20%)", value: 114, color: "#f59e0b" },
  { name: "Not (<10%)", value: 144, color: "#22c55e" },
];

const donutData = (completed: number, total: number, color: string) => [
  { name: "Completed", value: completed, color: color },
  { name: "Incomplete", value: total - completed, color: "#f1f5f9" },
];

interface PanelCardProps {
  title: string;
  children: React.ReactNode;
  isEmpty?: boolean;
  isLoading?: boolean;
}

const PanelCard = ({ title, children, isEmpty, isLoading }: PanelCardProps) => (
  <Card className="rounded-2xl border-none shadow-sm bg-white h-[240px] flex flex-col overflow-hidden transition-all hover:shadow-md">
    <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between space-y-0 flex-shrink-0">
      <CardTitle className="text-[13px] font-bold text-slate-800 tracking-tight truncate pr-2">{title}</CardTitle>
      <Info className="h-4 w-4 text-slate-300 cursor-help flex-shrink-0" />
    </CardHeader>
    <CardContent className="flex-1 flex flex-col items-center justify-center p-3 overflow-hidden">
      {isLoading ? (
        <RefreshCw className="h-6 w-6 text-slate-200 animate-spin" />
      ) : isEmpty ? (
        <p className="text-slate-300 text-xs font-medium">No Data</p>
      ) : (
        children
      )}
    </CardContent>
  </Card>
);

const DonutChart = ({ completed, total, color, label, subLabel }: { completed: number, total: number, color: string, label: string, subLabel: string }) => {
  const percentage = Math.round((completed / total) * 100);
  return (
    <div className="flex flex-col items-center w-full h-full justify-center">
      <div className="relative h-28 w-28 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={donutData(completed, total, color)} 
              innerRadius={32} 
              outerRadius={44} 
              paddingAngle={0} 
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              <Cell fill={color} />
              <Cell fill="#f1f5f9" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-800 leading-none">{completed}</span>
          <span className="text-[9px] text-slate-400 text-center leading-tight mt-1 font-medium">
            of {total}<br/>({percentage}%)
          </span>
        </div>
      </div>
      <div className="flex gap-3 mt-3 text-[10px] text-slate-500 flex-wrap justify-center font-medium">
        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> {label}: {completed}</div>
        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-slate-100" /> {subLabel}: {total - completed}</div>
      </div>
    </div>
  );
};

export default function PerformancePanel() {
  const handleAction = (action: string) => {
    toast.success(`${action} initiated`);
  };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden">
      {/* Header - Fixed Height */}
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
              My Performance Panel (Current) <ChevronDown className="h-4 w-4 text-slate-400" />
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Program-wide performance metrics and tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-[11px] text-slate-500">
          <div className="text-right">
            <p className="font-bold text-slate-900">2025 - 2026</p>
            <p className="font-medium text-slate-400">Refreshed Today • 12:30 AM</p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 border-slate-200 bg-white shadow-sm rounded-xl hover:bg-slate-50">
                <MoreHorizontal className="h-5 w-5 text-slate-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel>Panel Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAction("Refresh Data")}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction("Change Program Year")}>
                <CalendarDays className="mr-2 h-4 w-4" /> Change Program Year
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleAction("Export to PDF")}>
                <FileText className="mr-2 h-4 w-4" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction("Export to Excel")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export as Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAction("Panel Settings")}>
                <Settings2 className="mr-2 h-4 w-4" /> Panel Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Grid - Scrollable if needed, but constrained */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1600px] mx-auto">
          
          {/* Row 1 */}
          <PanelCard title="Attendance on Mon 4/20" isEmpty />
          
          <PanelCard title="Chronic Absence">
            <div className="w-full h-full px-2 flex flex-col justify-center">
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chronicAbsenceData} layout="vertical" margin={{ left: -20, right: 15, top: 10, bottom: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b", fontWeight: 500 }} width={90} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
                      {chronicAbsenceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 px-12 mt-[-5px] font-bold">
                <span>0</span><span>100</span><span>200</span>
              </div>
            </div>
          </PanelCard>

          <PanelCard title="Participants with IEP/IFSP">
            <DonutChart completed={43} total={335} color="#166534" label="IEP/IFSP" subLabel="No IEP/IFSP" />
          </PanelCard>

          <PanelCard title="Disability Concerns">
            <DonutChart completed={33} total={335} color="#7c3aed" label="Open Concern" subLabel="No Concern" />
          </PanelCard>

          {/* Row 2 */}
          <PanelCard title="Family Outcomes • Initial Assessment">
            <DonutChart completed={259} total={280} color="#3f6212" label="Completed" subLabel="Incomplete" />
          </PanelCard>

          <PanelCard title="Family Outcomes • Mid-Year Check-In">
            <DonutChart completed={139} total={197} color="#3f6212" label="Completed" subLabel="Incomplete" />
          </PanelCard>

          <PanelCard title="Family Outcomes • End of Year Check-In">
            <DonutChart completed={5} total={248} color="#3f6212" label="Completed" subLabel="Incomplete" />
          </PanelCard>

          <PanelCard title="0 Day Health Requirements">
            <DonutChart completed={208} total={208} color="#3f6212" label="Completed" subLabel="Incomplete" />
          </PanelCard>

          {/* Row 3 */}
          <PanelCard title="45 Day Health Requirements" isLoading />
          
          <PanelCard title="90 Day Health Requirements" isLoading />

          <PanelCard title="Absence Reasons" isEmpty />

          <PanelCard title="Consecutive Unexcused Absence" isEmpty />

        </div>
      </div>
    </div>
  );
}
