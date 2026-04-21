import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, 
  PieChart, Pie, Cell, Tooltip
} from "recharts";
import { Info, MoreHorizontal, RefreshCw, ChevronDown } from "lucide-react";

const chronicAbsenceData = [
  { name: "Severe (20+%)", value: 77, color: "#ef4444" },
  { name: "Moderate (10-20%)", value: 114, color: "#f59e0b" },
  { name: "Not (<10%)", value: 144, color: "#22c55e" },
];

const donutData = (completed: number, total: number, color: string) => [
  { name: "Completed", value: completed, color: color },
  { name: "Incomplete", value: total - completed, color: "#e5e7eb" },
];

interface PanelCardProps {
  title: string;
  children: React.ReactNode;
  isEmpty?: boolean;
  isLoading?: boolean;
}

const PanelCard = ({ title, children, isEmpty, isLoading }: PanelCardProps) => (
  <Card className="rounded-none border-none shadow-none bg-white min-h-[200px] flex flex-col">
    <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between space-y-0">
      <CardTitle className="text-[13px] font-medium text-slate-700 tracking-tight">{title}</CardTitle>
      <Info className="h-3.5 w-3.5 text-slate-300 cursor-help" />
    </CardHeader>
    <CardContent className="flex-1 flex flex-col items-center justify-center p-4">
      {isLoading ? (
        <RefreshCw className="h-6 w-6 text-slate-200 animate-spin" />
      ) : isEmpty ? (
        <p className="text-slate-300 text-sm font-medium">No Data</p>
      ) : (
        children
      )}
    </CardContent>
  </Card>
);

const DonutChart = ({ completed, total, color, label, subLabel }: { completed: number, total: number, color: string, label: string, subLabel: string }) => {
  const percentage = Math.round((completed / total) * 100);
  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={donutData(completed, total, color)} 
              innerRadius={32} 
              outerRadius={42} 
              paddingAngle={0} 
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              <Cell fill={color} />
              <Cell fill="#e2e8f0" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-700">{completed}</span>
          <span className="text-[9px] text-slate-400 text-center px-2">completed of<br/>{total} families ({percentage}%)</span>
        </div>
      </div>
      <div className="flex gap-3 mt-3 text-[10px] text-slate-500">
        <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} /> {label}: {completed}</div>
        <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-sm bg-slate-200" /> {subLabel}: {total - completed}</div>
      </div>
    </div>
  );
};

export default function PerformancePanel() {
  return (
    <div className="p-4 space-y-4 bg-[#f8fafc] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-1">
            My Performance Panel (Current) <ChevronDown className="h-4 w-4 text-slate-400" />
          </h1>
          <Info className="h-4 w-4 text-slate-400 cursor-help" />
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <div className="text-right">
            <p className="font-semibold text-slate-400">2025 - 2026</p>
            <p>Refreshed Today • 12:30 AM</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 border border-slate-200 bg-white shadow-sm rounded-md">
            <MoreHorizontal className="h-4 w-4 text-slate-600" />
          </Button>
        </div>
      </div>

      {/* Main Grid - 4 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[1px] bg-slate-200 border border-slate-200 rounded-sm overflow-hidden shadow-sm">
        
        {/* Row 1 */}
        <PanelCard title="Attendance on Mon 4/20" isEmpty />
        
        <PanelCard title="Chronic Absence">
          <div className="w-full h-full px-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chronicAbsenceData} layout="vertical" margin={{ left: -15, right: 10, top: 10, bottom: 10 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} width={85} />
                <Bar dataKey="value" radius={[0, 2, 2, 0]} barSize={18}>
                  {chronicAbsenceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-between text-[9px] text-slate-400 px-10 mt-[-10px]">
              <span>0</span><span>100</span><span>200</span>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Participants with IEP/IFSP">
          <DonutChart completed={43} total={335} color="#166534" label="IEP/IFSP" subLabel="No IEP/IFSP" />
        </PanelCard>

        <PanelCard title="Disability Concerns">
          <DonutChart completed={33} total={335} color="#6d28d9" label="Open Concern" subLabel="No Concern" />
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

        <PanelCard title="Consecutive Unexcused Absence">
           <div className="flex flex-col items-center justify-center w-full h-full">
              <p className="text-slate-300 text-sm font-medium">No Data</p>
           </div>
        </PanelCard>

      </div>
    </div>
  );
}
