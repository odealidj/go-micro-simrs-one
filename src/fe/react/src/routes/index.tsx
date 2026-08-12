import { createBrowserRouter, Navigate } from "react-router-dom";
import { authRoutes } from "../features/auth/routes";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  ...authRoutes,
]);
