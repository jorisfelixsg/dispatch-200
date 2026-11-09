import type { Metadata } from "next";
import { TasksScreen } from "@/components/tasks/TasksScreen";

export const metadata: Metadata = { title: "Mes tâches · Dispatch 200 offres" };

export default function Page() {
  return <TasksScreen />;
}
