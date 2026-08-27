import type { RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PoliQueuePage } from "./pages/PoliQueuePage";
import { EncounterPage } from "./pages/EncounterPage";
import { Navigate } from "react-router-dom";

export const emrRoutes: RouteObject[] = [
  {
    path: "/emr",
    element: <ProtectedRoute allowedRoles={["dokter", "perawat"]} />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/emr/queue" replace />,
          },
          {
            path: "queue",
            element: <PoliQueuePage />,
          },
          {
            path: "encounter/:encounterNo",
            element: <EncounterPage />,
          },
        ],
      },
    ],
  },
];
