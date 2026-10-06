import { AppShell } from "@/components/shell/app-shell";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function Dashboard() {
  return (
    <AppShell view="dashboard">
      <DashboardView />
    </AppShell>
  );
}
