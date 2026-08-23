import type { RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { DokterLayout } from "./components/DokterLayout";
import { DokterDashboard } from "./pages/DokterDashboard";
import { PoliQueuePage } from "./pages/PoliQueuePage";
import { EncounterPage } from "./pages/EncounterPage";

export const dokterRoutes: RouteObject[] = [
  {
    path: "/dokter",
    element: <ProtectedRoute allowedRoles={["dokter"]} />,
    children: [
      {
        element: <DokterLayout />,
        children: [
          {
            index: true,
            element: <DokterDashboard />,
          },
          {
            path: "antrean",
            element: <PoliQueuePage />,
          },
          {
            path: "encounter/:encounterNo",
            element: <EncounterPage />,
          },
          {
            path: "riwayat",
            // Placeholder — akan diimplementasi kemudian
            element: <DokterDashboard />,
          },
        ],
      },
    ],
  },
];
