import { createBrowserRouter, Navigate } from "react-router-dom";
import { authRoutes } from "../features/auth/routes";
import { adminRoutes } from "../features/admin/routes";
import { admisiRoutes } from "../features/registration/routes";
import { dokterRoutes } from "../features/emr/routes-dokter";
import { perawatRoutes } from "../features/emr/routes-perawat";
import { rekamMedisRoutes } from "../features/emr/routes-rekam-medis";
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

