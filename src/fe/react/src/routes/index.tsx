import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import { authRoutes } from "../features/auth/routes";
import { adminRoutes } from "../features/admin/routes";
import { admisiRoutes } from "../features/registration/routes";
import { dokterRoutes } from "../features/rawat-jalan/routes-dokter";
import { perawatRoutes } from "../features/rawat-jalan/routes-perawat";
import { rekamMedisRoutes } from "../features/medical-record/routes";
import { kasirRoutes } from "../features/billing/routes";
import { apotekerRoutes } from "../features/pharmacy/routes";
import { UnauthorizedPage } from "../features/auth/pages/UnauthorizedPage";

function RedirectDokterEncounter() {
  const { encounterNo } = useParams();
  return <Navigate to={`/rawat-jalan/dokter/encounter/${encounterNo}`} replace />;
}

function RedirectPerawatEncounter() {
  const { encounterNo } = useParams();
  return <Navigate to={`/rawat-jalan/perawat/encounter/${encounterNo}`} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  ...authRoutes,
  ...adminRoutes,
  ...admisiRoutes,
  ...dokterRoutes,
  ...perawatRoutes,
  ...rekamMedisRoutes,
  ...kasirRoutes,
  ...apotekerRoutes,
  // Fallback / alias compatibility routes
  {
    path: "/dokter/encounter/:encounterNo",
    element: <RedirectDokterEncounter />,
  },
  {
    path: "/perawat/encounter/:encounterNo",
    element: <RedirectPerawatEncounter />,
  },
  {
    path: "/dokter/*",
    element: <Navigate to="/rawat-jalan/dokter" replace />,
  },
  {
    path: "/perawat/*",
    element: <Navigate to="/rawat-jalan/perawat" replace />,
  },
  {
    path: "/unauthorized",
    element: <UnauthorizedPage />,
  },
]);

