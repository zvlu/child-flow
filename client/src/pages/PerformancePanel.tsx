import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, 
  PieChart, Pie, Cell, CartesianGrid
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

const donutData = (completed: number, total: number, color: string) => [
  { name: "Completed", value: completed, color: color },
  { name: "Incomplete", value: Math.max(0, total - completed), color: "#f1f5f9" },
];

const incomeStatusData = [
  { name: "P", value: 127, color: "#22c55e" },
  { name: "E", value: 31, color: "#f59e0b" },
  { name: "M", value: 6, color: "#ef4444" },
  { name: "O", value: 5, color: "#8b5cf6" },
  { name: "H", value: 3, color: "#f97316" },
];

interface PanelCardProps {
  title: string;
  children?: React.ReactNode;
  isEmpty?: boolean;
  isLoading?: boolean;
  emptyText?: string;
}

const PanelCard = ({ title, children, isEmpty, isLoading, emptyText = "No Data" }: PanelCardProps) => (
  <Card className="rounded-2xl border-none shadow-sm bg-white h-[260px] flex flex-col overflow-hidden transition-all hover:shadow-md">
    <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between space-y-0 flex-shrink-0">
      <CardTitle className="text-[12px] font-bold text-slate-800 tracking-tight truncate pr-2 uppercase">{title}</CardTitle>
      <Info className="h-3.5 w-3.5 text-slate-300 cursor-help flex-shrink-0" />
    </CardHeader>
    <CardContent className="flex-1 flex flex-col items-center justify-center p-3 overflow-hidden">
      {isLoading ? (
        <RefreshCw className="h-6 w-6 text-slate-200 animate-spin" />
      ) : isEmpty ? (
        <p className="text-slate-300 text-[11px] font-medium text-center px-4 leading-relaxed">{emptyText}</p>
      ) : (
        children
      )}
    </CardContent>
  </Card>
);

const DonutChart = ({ completed, total, color, label, subLabel }: { completed: number, total: number, color: string, label: string, subLabel: string }) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
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
      <div className="flex gap-3 mt-3 text-[9px] text-slate-500 flex-wrap justify-center font-medium">
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
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
              My Performance Panel (Current) <ChevronDown className="h-4 w-4 text-slate-400" />
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Comprehensive program performance tracking</p>
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1600px] mx-auto">
          
          {/* Section: Education */}
          <PanelCard title="Individualized Curriculum" isEmpty emptyText="No Individualized Curriculum have been completed." />
          
          <PanelCard title="Parent Conferences">
            <div className="w-full h-full flex flex-col justify-center">
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{name: '1st', val: 145}, {name: '2nd', val: 0}, {name: '3rd', val: 0}, {name: '4th', val: 0}]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <Bar dataKey="val" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-center gap-3 text-[9px] text-slate-400 font-bold">
                <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> 1st: 145 (82%)</span>
              </div>
            </div>
          </PanelCard>

          <PanelCard title="45 Day Education Requirements">
            <DonutChart completed={167} total={176} color="#166534" label="Completed" subLabel="Incomplete" />
          </PanelCard>

          <PanelCard title="Education Requirements Past Due">
            <p className="text-slate-300 text-[11px] font-medium text-center px-4 leading-relaxed">No participants at this location have past due or expired Education Requirements.</p>
          </PanelCard>

          {/* Section: Enrollment */}
          <PanelCard title="45 Day Education Events Needing Follow-Up">
            <DonutChart completed={0} total={22} color="#ef4444" label="Closed" subLabel="Not Closed" />
          </PanelCard>

          <PanelCard title="Drops">
            <div className="w-full h-full flex flex-col justify-center">
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{name: '30d', val: 0}, {name: 'YTD', val: 37}]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <Bar dataKey="val" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-center gap-3 text-[9px] text-slate-400 font-bold">
                <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-blue-300" /> YTD: 37/213 (17%)</span>
              </div>
            </div>
          </PanelCard>

          <PanelCard title="Enrollment">
            <DonutChart completed={176} total={176} color="#166534" label="Enrolled" subLabel="Vacancies" />
          </PanelCard>

          <PanelCard title="Enrollment Potential">
            <div className="flex flex-col items-center w-full h-full justify-center">
              <div className="relative h-28 w-28 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={[{v: 0, c: '#166534'}, {v: 25, c: '#3b82f6'}, {v: 15, c: '#93c5fd'}, {v: 136, c: '#f1f5f9'}]} 
                      innerRadius={32} outerRadius={44} paddingAngle={0} dataKey="v" startAngle={90} endAngle={-270} isAnimationActive={false}
                    >
                      {[{v: 0, c: '#166534'}, {v: 25, c: '#3b82f6'}, {v: 15, c: '#93c5fd'}, {v: 136, c: '#f1f5f9'}].map((e, i) => <Cell key={i} fill={e.c} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold text-slate-800 leading-none">40</span>
                  <span className="text-[9px] text-slate-400 text-center leading-tight mt-1 font-medium">of 176<br/>(23%)</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3 text-[8px] text-slate-500 flex-wrap justify-center font-bold">
                <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Waitlisted: 25</div>
                <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-blue-300" /> New: 15</div>
              </div>
            </div>
          </PanelCard>

          {/* Section: Health */}
          <PanelCard title="Income Status">
            <div className="w-full h-full flex flex-col justify-center">
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={incomeStatusData} innerRadius={0} outerRadius={40} dataKey="value" isAnimationActive={false}>
                      {incomeStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 px-4 text-[8px] text-slate-500 font-bold">
                {incomeStatusData.map(e => (
                  <div key={e.name} className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full" style={{backgroundColor: e.color}} />
                    {e.name}: {e.value} ({Math.round(e.value/202*100)}%)
                  </div>
                ))}
              </div>
            </div>
          </PanelCard>

          <PanelCard title="0 Day Health Requirements">
            <DonutChart completed={96} total={96} color="#166534" label="Completed" subLabel="Incomplete" />
          </PanelCard>

          <PanelCard title="45 Day Health Requirements">
            <DonutChart completed={165} total={176} color="#166534" label="Completed" subLabel="Incomplete" />
          </PanelCard>

          <PanelCard title="90 Day Health Requirements">
            <DonutChart completed={79} total={176} color="#166534" label="Completed" subLabel="Incomplete" />
          </PanelCard>

          {/* Section: Medical/Dental */}
          <PanelCard title="Medical Home">
            <DonutChart completed={12} total={176} color="#166534" label="Medical Home" subLabel="No Medical Home" />
          </PanelCard>

          <PanelCard title="Dental Home">
            <DonutChart completed={12} total={176} color="#166534" label="Dental Home" subLabel="No Dental Home" />
          </PanelCard>

          <PanelCard title="Health Coverage">
            <DonutChart completed={122} total={176} color="#166534" label="Health Coverage" subLabel="No Coverage" />
          </PanelCard>

          <PanelCard title="Immunization Status">
            <div className="w-full h-full flex flex-col justify-center">
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{v: 41, c: '#166534'}, {v: 135, c: '#f1f5f9'}]} innerRadius={0} outerRadius={40} dataKey="v" isAnimationActive={false}>
                      <Cell fill="#166534" /><Cell fill="#f1f5f9" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-col items-center gap-1 text-[8px] text-slate-500 font-bold">
                <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-green-800" /> C: 41 (23%)</div>
                <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-slate-100" /> Blank: 135 (77%)</div>
              </div>
            </div>
          </PanelCard>

        </div>
      </div>
    </div>
  );
}
