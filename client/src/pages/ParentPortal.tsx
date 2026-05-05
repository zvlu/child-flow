import { useState } from "react";
import { Heart, MessageSquare, Camera, Apple, Moon, Droplet, Activity, Bell } from "lucide-react";

export function ParentPortal() {
  const [activities, setActivities] = useState([
    { id: 1, type: "meal", time: "12:30 PM", description: "Enjoyed a healthy lunch: chicken, broccoli, and rice", icon: Apple },
    { id: 2, type: "nap", time: "1:00 PM", description: "Took a 2-hour nap after lunch", icon: Moon },
    { id: 3, type: "activity", time: "3:00 PM", description: "Participated in art class - painted a beautiful picture!", icon: Activity },
    { id: 4, type: "diaper", time: "3:30 PM", description: "Diaper changed", icon: Droplet },
    { id: 5, type: "note", time: "4:00 PM", description: "Had a great day! Made new friends during playtime.", icon: MessageSquare },
  ]);

  const [notifications, setNotifications] = useState([
    { id: 1, message: "Emma's immunization is due next week. Please schedule an appointment.", type: "alert", read: false },
    { id: 2, message: "Parent-teacher conference scheduled for Feb 15 at 2:00 PM", type: "announcement", read: true },
    { id: 3, message: "New photos from today's field trip are now available!", type: "photo", read: false },
  ]);

  const getActivityIcon = (type: string) => {
    const icons = {
      meal: Apple,
      nap: Moon,
      diaper: Droplet,
      activity: Activity,
      note: MessageSquare,
    };
    return icons[type as keyof typeof icons] || Activity;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Emma's Day</h1>
          <p className="text-slate-600">Monday, January 20, 2025</p>
        </div>

        {/* Notifications */}
        {notifications.some(n => !n.read) && (
          <div className="mb-6 space-y-3">
            {notifications.filter(n => !n.read).map((notif) => (
              <div key={notif.id} className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">{notif.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Today's Activities */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Today's Activities</h2>
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              return (
                <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-slate-200 last:border-0">
                  <div className="bg-teal-100 rounded-xl p-3 flex-shrink-0">
                    <Icon className="w-6 h-6 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600">{activity.time}</p>
                    <p className="text-slate-900 font-medium mt-1">{activity.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <Apple className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-slate-600">Meals Today</p>
                <p className="text-xl font-bold text-slate-900">3</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <Moon className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-xs text-slate-600">Nap Time</p>
                <p className="text-xl font-bold text-slate-900">2 hrs</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-xs text-slate-600">Mood</p>
                <p className="text-xl font-bold text-slate-900">Happy 😊</p>
              </div>
            </div>
          </div>
        </div>

        {/* Message Teacher */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Message Teacher</h3>
          <div className="space-y-3">
            <textarea placeholder="Send a message to your child's teacher..." className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" rows={3} />
            <button className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-xl transition-colors font-medium">Send Message</button>
          </div>
        </div>

        {/* Gallery Link */}
        <div className="mt-6 bg-gradient-to-r from-teal-50 to-blue-50 rounded-2xl border border-teal-200 p-6 text-center">
          <Camera className="w-8 h-8 text-teal-600 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">Photo Gallery</h3>
          <p className="text-slate-600 mb-4">View photos and videos from today's activities</p>
          <button className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-xl transition-colors font-medium">View Gallery</button>
        </div>
      </div>
    </div>
  );
}
