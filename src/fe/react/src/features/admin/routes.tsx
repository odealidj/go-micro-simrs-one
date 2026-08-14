import type { RouteObject } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { AdminDashboard } from "./pages/AdminDashboard";
import { UserManagement } from "./pages/UserManagement";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { RolePage } from "./pages/master/RolePage";
import { DokterPage } from "./pages/master/DokterPage";
import { PerawatPage } from "./pages/master/PerawatPage";
import { PoliklinikPage } from "./pages/master/PoliklinikPage";
import { AssignDokterPoliPage } from "./pages/master/AssignDokterPoliPage";
import { AssignPerawatPoliPage } from "./pages/master/AssignPerawatPoliPage";
import { KBMPage } from "./pages/master/KBMPage";
import { AssignKBMPoliPage } from "./pages/master/AssignKBMPoliPage";
import { TindakanPage } from "./pages/master/TindakanPage";
import { AssignTindakanPoliPage } from "./pages/master/AssignTindakanPoliPage";
import { ICD10Page } from "./pages/master/ICD10Page";
import { AssignICD10PoliPage } from "./pages/master/AssignICD10PoliPage";
import { ObatPage } from "./pages/master/ObatPage";
import { AssignObatPoliPage } from "./pages/master/AssignObatPoliPage";

export const adminRoutes: RouteObject[] = [
  {
    path: "/admin",
    element: <ProtectedRoute allowedRoles={["admin"]} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <AdminDashboard />,
          },
          {
            path: "users",
            element: <UserManagement />,
          },
          { path: "master/role", element: <RolePage /> },
          { path: "master/dokter", element: <DokterPage /> },
          { path: "master/perawat", element: <PerawatPage /> },
          { path: "master/poliklinik", element: <PoliklinikPage /> },
          { path: "master/assign-dokter", element: <AssignDokterPoliPage /> },
          { path: "master/assign-perawat", element: <AssignPerawatPoliPage /> },
          { path: "master/kbm", element: <KBMPage /> },
          { path: "master/assign-kbm", element: <AssignKBMPoliPage /> },
          { path: "master/tindakan", element: <TindakanPage /> },
          { path: "master/assign-tindakan", element: <AssignTindakanPoliPage /> },
          { path: "master/icd10", element: <ICD10Page /> },
          { path: "master/assign-icd10", element: <AssignICD10PoliPage /> },
          { path: "master/obat", element: <ObatPage /> },
          { path: "master/assign-obat", element: <AssignObatPoliPage /> },
        ],
      },
    ],
  },
];
