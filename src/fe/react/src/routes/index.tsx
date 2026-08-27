import { createBrowserRouter, Navigate } from "react-router-dom";
import { authRoutes } from "../features/auth/routes";
import { adminRoutes } from "../features/admin/routes";
import { admisiRoutes } from "../features/registration/routes";
import { dokterRoutes } from "../features/rawat-jalan/routes-dokter";
import { perawatRoutes } from "../features/rawat-jalan/routes-perawat";
import { rekamMedisRoutes } from "../features/medical-record/routes";
import { kasirRoutes } from "../features/billing/routes";
import { apotekerRoutes } from "../features/pharmacy/routes";
import { UnauthorizedPage } from "../features/auth/pages/UnauthorizedPage";

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
  {
    path: "/unauthorized",
    element: <UnauthorizedPage />,
  },
]);

