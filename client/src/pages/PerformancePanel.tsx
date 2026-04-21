import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, 
  PieChart, Pie, Cell
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
  <Card className="rounded-none border-none shadow-none bg-white h-[220px] flex flex-col overflow-hidden">
    <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between space-y-0 flex-shrink-0">
      <CardTitle className="text-[12px] font-semibold text-slate-700 tracking-tight truncate pr-2">{title}</CardTitle>
      <Info className="h-3.5 w-3.5 text-slate-300 cursor-help flex-shrink-0" />
    </CardHeader>
    <CardContent className="flex-1 flex flex-col items-center justify-center p-2 overflow-hidden">
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
      <div className="relative h-24 w-24 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={donutData(completed, total, color)} 
              innerRadius={28} 
              outerRadius={38} 
              paddingAngle={0} 
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              <Cell fill={color} />
              <Cell fill="#e2e8f0" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-slate-700 leading-none">{completed}</span>
          <span className="text-[8px] text-slate-400 text-center leading-tight mt-0.5">
            of {total}<br/>({percentage}%)
          </span>
        </div>
      </div>
      <div className="flex gap-2 mt-2 text-[9px] text-slate-500 flex-wrap justify-center">
        <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} /> {label}: {completed}</div>
        <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-slate-200" /> {subLabel}: {total - completed}</div>
      </div>
    </div>
  );
};

export default function PerformancePanel() {
  return (
    <div className="h-full flex flex-col bg-[#f1f5f9] overflow-hidden">
      {/* Header - Fixed Height */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-slate-800 flex items-center gap-1">
            My Performance Panel (Current) <ChevronDown className="h-4 w-4 text-slate-400" />
          </h1>
          <Info className="h-4 w-4 text-slate-400 cursor-help" />
        </div>
        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          <div className="text-right">
            <p className="font-bold text-slate-400">2025 - 2026</p>
            <p>Refreshed Today • 12:30 AM</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 border border-slate-200 bg-white shadow-sm rounded-md">
            <MoreHorizontal className="h-4 w-4 text-slate-600" />
          </Button>
        </div>
      </div>

      {/* Main Grid - Scrollable if needed, but constrained */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[1px] bg-slate-200 border border-slate-200 rounded-sm overflow-hidden shadow-sm max-w-[1600px] mx-auto">
          
          {/* Row 1 */}
          <PanelCard title="Attendance on Mon 4/20" isEmpty />
          
          <PanelCard title="Chronic Absence">
            <div className="w-full h-full px-1 flex flex-col justify-center">
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chronicAbsenceData} layout="vertical" margin={{ left: -25, right: 10, top: 5, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#64748b" }} width={85} />
                    <Bar dataKey="value" radius={[0, 2, 2, 0]} barSize={14} isAnimationActive={false}>
                      {chronicAbsenceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between text-[8px] text-slate-400 px-10 mt-[-5px]">
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

          <PanelCard title="Consecutive Unexcused Absence" isEmpty />

        </div>
      </div>
    </div>
  );
}
