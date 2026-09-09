import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  component: ReportLayout,
});

function ReportLayout() {
  return <Outlet />;
}
