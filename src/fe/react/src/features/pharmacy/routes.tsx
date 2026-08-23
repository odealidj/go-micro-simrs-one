import type { RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { ApotekerLayout } from "./components/ApotekerLayout";
import { ApotekerDashboard } from "./pages/ApotekerDashboard";
import { ResepPage } from "./pages/ResepPage";

export const apotekerRoutes: RouteObject[] = [
  {
    path: "/apoteker",
    element: <ProtectedRoute allowedRoles={["asisten_apoteker", "admin", "super_admin"]} />,
    children: [
      {
        element: <ApotekerLayout />,
        children: [
          { index: true, element: <ApotekerDashboard /> },
          { path: "resep", element: <ResepPage /> },
          {
            path: "dispense",
            element: <ResepPage />, // Shared page — filter status berbeda
          },
        ],
      },
    ],
  },
];
