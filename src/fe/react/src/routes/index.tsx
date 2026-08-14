import { createBrowserRouter, Navigate } from "react-router-dom";
import { authRoutes } from "../features/auth/routes";
import { registrationRoutes } from "../features/registration/routes";
import { adminRoutes } from "../features/admin/routes";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  ...authRoutes,
  ...registrationRoutes,
  ...adminRoutes,
]);
