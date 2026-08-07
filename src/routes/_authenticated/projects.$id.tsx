import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectLayout,
});

function ProjectLayout() {
  return <Outlet />;
}