import type { RouteObject } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RegistrationDashboard } from "./pages/RegistrationDashboard";
import { NewRegistrationPage } from "./pages/NewRegistrationPage";
import { QueueManagerPage } from "./pages/QueueManagerPage";

export const registrationRoutes: RouteObject[] = [
  {
    element: <DashboardLayout />,
    children: [
      {
        path: "dashboard",
        element: <RegistrationDashboard />,
      },
      {
        path: "registration/new",
        element: <NewRegistrationPage />,
      },
      {
        path: "registration/queue",
        element: <QueueManagerPage />,
      },
    ],
  },
];
