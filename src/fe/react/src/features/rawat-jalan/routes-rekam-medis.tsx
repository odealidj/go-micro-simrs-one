import type { RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { RekamMedisLayout } from "./components/RekamMedisLayout";
import { RekamMedisDashboard } from "./pages/RekamMedisDashboard";

export const rekamMedisRoutes: RouteObject[] = [
  {
    path: "/rekam-medis",
    element: <ProtectedRoute allowedRoles={["rekam_medis", "admin", "super_admin"]} />,
    children: [
      {
        element: <RekamMedisLayout />,
        children: [
          { index: true, element: <RekamMedisDashboard /> },
          { path: "cari", element: <RekamMedisDashboard /> },
          { path: "detail", element: <RekamMedisDashboard /> },
          { path: "icd10-pending", element: <RekamMedisDashboard /> },
        ],
      },
    ],
  },
];
