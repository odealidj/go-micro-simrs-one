import type { RouteObject } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RegistrationDashboard } from "./pages/RegistrationDashboard";
import { NewRegistrationPage } from "./pages/NewRegistrationPage";
import { QueueManagerPage } from "./pages/QueueManagerPage";
import { DaftarKunjunganPage } from "./pages/DaftarKunjunganPage";

export const registrationRoutes: RouteObject[] = [
  {
    element: <DashboardLayout />,
    children: [
      {
        path: "dashboard",
        element: <RegistrationDashboard />,
      },
      {
        path: "admisi/daftar",
        element: <DaftarKunjunganPage />,
      },
      {
        path: "admisi/baru",
        element: <NewRegistrationPage />,
      },
      {
        path: "admisi/antrean",
        element: <QueueManagerPage />,
      },
    ],
  },
];
