import type { RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { PerawatLayout } from "./components/PerawatLayout";
import { PerawatDashboard } from "./pages/PerawatDashboard";
import { PoliQueuePage } from "./pages/PoliQueuePage";
import { TriagePage } from "./pages/TriagePage";
import { EncounterPage } from "./pages/EncounterPage";

export const perawatRoutes: RouteObject[] = [
  {
    path: "/rawat-jalan/perawat",
    element: <ProtectedRoute allowedRoles={["perawat"]} />,
    children: [
      {
        element: <PerawatLayout />,
        children: [
          {
            index: true,
            element: <PerawatDashboard />,
          },
          {
            path: "antrean",
            element: <PoliQueuePage />,
          },
          {
            path: "triage",
            element: <TriagePage />,
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
