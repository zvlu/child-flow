import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight,
  Clock, MapPin, Users, AlertCircle, Edit, Trash2, MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  eventType: "holiday" | "school_event" | "parent_event" | "staff_training" | "deadline" | "other";
  startDate: Date;
  endDate?: Date;
  location?: string;
  allDay: boolean;
  color: string;
}

const mockEvents: CalendarEvent[] = [
  {
    id: 1,
    title: "Labor Day - No School",
    description: "Holiday - Center Closed",
    eventType: "holiday",
    startDate: new Date(2025, 8, 1),
    allDay: true,
    color: "#ef4444",
  },
  {
    id: 2,
    title: "Fall Parent Conference",
    description: "Individual parent-teacher conferences",
    eventType: "parent_event",
    startDate: new Date(2025, 8, 15),
    endDate: new Date(2025, 8, 17),
    location: "Classrooms",
    allDay: false,
    color: "#f59e0b",
  },
  {
    id: 3,
    title: "Staff Training Day",
    description: "Professional development training",
    eventType: "staff_training",
    startDate: new Date(2025, 8, 20),
    allDay: true,
    color: "#8b5cf6",
  },
  {
    id: 4,
    title: "PIR Submission Deadline",
    description: "Federal reporting deadline",
    eventType: "deadline",
    startDate: new Date(2025, 9, 1),
    allDay: true,
    color: "#dc2626",
  },
  {
    id: 5,
    title: "Fall Festival",
    description: "Family fun day with games and activities",
    eventType: "school_event",
    startDate: new Date(2025, 9, 10),
    location: "Playground",
    allDay: false,
    color: "#10b981",
  },
];

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 8, 1)); // September 2025
  const [events, setEvents] = useState<CalendarEvent[]>(mockEvents);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "holiday":
        return "bg-red-100 text-red-700 border-red-200";
      case "school_event":
        return "bg-green-100 text-green-700 border-green-200";
      case "parent_event":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "staff_training":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "deadline":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  const getEventTypeLabel = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const calendarDays = [];

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const getEventsForDay = (day: number) => {
    return events.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getFullYear() === currentDate.getFullYear() &&
        eventDate.getMonth() === currentDate.getMonth() &&
        eventDate.getDate() === day
      );
    });
  };

  return (
    <div className="p-6 space-y-6 bg-[#FBF6EE] min-h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Program Calendar</h1>
            <p className="text-sm text-slate-500 font-medium">Track school events, holidays, and important dates</p>
          </div>
        </div>
        <Button className="rounded-full gap-2 shadow-md hover:shadow-lg transition-all font-bold">
          <Plus className="h-4 w-4" /> New Event
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-slate-900">
                  {months[currentDate.getMonth()]} {currentDate.getFullYear()}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevMonth}
                    className="rounded-lg h-9 w-9 hover:bg-slate-200 transition-all"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextMonth}
                    className="rounded-lg h-9 w-9 hover:bg-slate-200 transition-all"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {daysOfWeek.map((day) => (
                  <div key={day} className="text-center font-bold text-slate-600 text-sm uppercase tracking-widest py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  const dayEvents = day ? getEventsForDay(day) : [];
                  const isToday =
                    day &&
                    new Date().getDate() === day &&
                    new Date().getMonth() === currentDate.getMonth() &&
                    new Date().getFullYear() === currentDate.getFullYear();

                  return (
                    <div
                      key={index}
                      className={`rounded-2xl border-2 min-h-[120px] p-2 transition-all ${
                        day
                          ? isToday
                            ? "border-primary bg-primary/5"
                            : "border-slate-200 hover:border-primary/30 hover:bg-slate-50"
                          : "border-transparent bg-slate-50"
                      }`}
                    >
                      {day && (
                        <div className="space-y-1">
                          <p className={`font-bold text-sm ${isToday ? "text-primary" : "text-slate-700"}`}>
                            {day}
                          </p>
                          <div className="space-y-1">
                            {dayEvents.slice(0, 2).map((event) => (
                              <div
                                key={event.id}
                                className={`text-[10px] font-bold px-2 py-1 rounded-lg truncate ${getEventTypeColor(event.eventType)}`}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-[9px] font-bold text-slate-500 px-2">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events Sidebar */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50 pb-3">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Upcoming Events
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {events
                .filter((event) => event.startDate >= currentDate)
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                .slice(0, 8)
                .map((event) => (
                  <div key={event.id} className="p-3 rounded-2xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition-all group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm group-hover:text-primary transition-colors">
                          {event.title}
                        </p>
                        <Badge className={`${getEventTypeColor(event.eventType)} rounded-full text-[10px] font-bold mt-1`}>
                          {getEventTypeLabel(event.eventType)}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg h-7 w-7 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl">
                          <DropdownMenuItem className="rounded-lg font-bold gap-2">
                            <Edit className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg font-bold gap-2 text-red-600">
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-1 text-[11px] font-bold text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="h-3 w-3" />
                        {event.startDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" /> {event.location}
                        </div>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-[10px] text-slate-600 font-medium mt-2 line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>
                ))}

              {events.filter((event) => event.startDate >= currentDate).length === 0 && (
                <div className="py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 font-bold">No upcoming events</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-widest">Event Types</CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-2">
              {[
                { type: "holiday", label: "Holiday" },
                { type: "school_event", label: "School Event" },
                { type: "parent_event", label: "Parent Event" },
                { type: "staff_training", label: "Staff Training" },
                { type: "deadline", label: "Deadline" },
              ].map((item) => (
                <div key={item.type} className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${item.type === "holiday" ? "bg-red-500" : item.type === "school_event" ? "bg-green-500" : item.type === "parent_event" ? "bg-amber-500" : item.type === "staff_training" ? "bg-purple-500" : "bg-red-500"}`} />
                  <span className="text-sm font-bold text-slate-600">{item.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
