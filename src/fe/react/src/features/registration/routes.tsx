import type { RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { AdmisiLayout } from "./components/AdmisiLayout";
import { RegistrationDashboard } from "./pages/RegistrationDashboard";
import { NewRegistrationPage } from "./pages/NewRegistrationPage";
import { QueueManagerPage } from "./pages/QueueManagerPage";
import { DaftarKunjunganPage } from "./pages/DaftarKunjunganPage";
import { JadwalDokterPerawatPage } from "./pages/JadwalDokterPerawatPage";

export const admisiRoutes: RouteObject[] = [
  {
    path: "/admisi",
    element: <ProtectedRoute allowedRoles={["admisi", "admin", "super_admin"]} />,
    children: [
      {
        element: <AdmisiLayout />,
        children: [
          {
            index: true,
            element: <RegistrationDashboard />,
          },
          {
            path: "kunjungan",
            element: <DaftarKunjunganPage />,
          },
          {
            path: "baru",
            element: <NewRegistrationPage />,
          },
          {
            path: "antrean",
            element: <QueueManagerPage />,
          },
          {
            path: "jadwal",
            element: <JadwalDokterPerawatPage />,
          },
        ],
      },
    ],
  },
];

