import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, CheckCircle2, Clock, CheckSquare, Filter } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "sonner";

export const Route = createFileRoute("/nurse/tasks")({ component: TasksPage });

interface NurseTask {
  id: number;
  title: string;
  time: string;
  category: "vitals" | "medication" | "handover" | "general";
  completed: boolean;
}

const initialTasks: NurseTask[] = [
  { id: 1, title: "08:00 AM Vitals Round — All Assigned Patients", time: "08:00 AM", category: "vitals", completed: true },
  { id: 2, title: "Administer IV Labetalol 10mg (Bed A-05 Lakshmi Prabha)", time: "09:30 AM", category: "medication", completed: false },
  { id: 3, title: "Bedside SpO2 & Respiratory Monitoring Round", time: "11:00 AM", category: "vitals", completed: false },
  { id: 4, title: "12:00 PM Blood Glucose Check & Insulin Log", time: "12:00 PM", category: "vitals", completed: false },
  { id: 5, title: "Verify Doctor Escalation Email Delivery for RED Risk Patients", time: "01:30 PM", category: "general", completed: false },
  { id: 6, title: "Prepare SBAR Clinical Shift Handover Report for Evening Shift", time: "03:30 PM", category: "handover", completed: false },
];

function TasksPage() {
  const [taskList, setTaskList] = useState<NurseTask[]>(initialTasks);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const toggleTask = (id: number) => {
    setTaskList(prev => prev.map(t => {
      if (t.id === id) {
        const updated = !t.completed;
        toast.success(updated ? "Task marked complete!" : "Task marked pending.");
        return { ...t, completed: updated };
      }
      return t;
    }));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: NurseTask = {
      id: Date.now(),
      title: newTaskTitle.trim(),
      time: newTaskTime || "Scheduled",
      category: "general",
      completed: false
    };
    setTaskList(prev => [newTask, ...prev]);
    setNewTaskTitle("");
    setNewTaskTime("");
    setShowAdd(false);
    toast.success("New shift task added!");
  };

  const filteredTasks = taskList.filter(t => {
    if (filter === "pending") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  const completedCount = taskList.filter(t => t.completed).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader 
          title="Clinical Shift Checklist" 
          hint={`${completedCount} of ${taskList.length} tasks completed for active shift`} 
        />
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95 transition"
        >
          <Plus className="h-4 w-4" /> Add Custom Task
        </button>
      </div>

      {/* Add Task Modal / Drawer */}
      {showAdd && (
        <Card className="p-5 border-2 border-primary/20 bg-primary/5">
          <form onSubmit={handleAddTask} className="space-y-3">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" /> Add New Shift Duty Task
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Task description (e.g., Check IV Drip Bed 4)"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                required
                className="sm:col-span-2 rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="text"
                placeholder="Scheduled time (e.g., 02:00 PM)"
                value={newTaskTime}
                onChange={e => setNewTaskTime(e.target.value)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-slate-600 font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold shadow-sm">Save Task</button>
            </div>
          </form>
        </Card>
      )}

      {/* Filter Tabs */}
      <Card className="p-3 flex items-center gap-2">
        <span className="text-xs font-bold text-slate-500 px-2 flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" /> Filter Tasks:
        </span>
        {[
          { id: "all", label: `All (${taskList.length})` },
          { id: "pending", label: `Pending (${taskList.length - completedCount})` },
          { id: "completed", label: `Completed (${completedCount})` }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              filter === f.id ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </Card>

      {/* Task List */}
      <Card className="p-4">
        <ul className="divide-y divide-border">
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No tasks in this view.</div>
          ) : (
            filteredTasks.map(t => (
              <li key={t.id} className="flex items-center justify-between py-3.5 px-2 hover:bg-slate-50 rounded-xl transition">
                <div className="flex items-center gap-3.5">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => toggleTask(t.id)}
                    className="h-5 w-5 rounded border-slate-300 accent-primary cursor-pointer"
                  />
                  <div>
                    <div className={`text-sm font-semibold transition ${t.completed ? "line-through text-slate-400" : "text-slate-800"}`}>
                      {t.title}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" /> {t.time}
                    </div>
                  </div>
                </div>
                <StatusPill tone={t.completed ? "success" : "warning"}>
                  {t.completed ? "Completed" : "Pending"}
                </StatusPill>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}