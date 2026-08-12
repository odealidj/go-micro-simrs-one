import type { RouteObject } from "react-router-dom";
import { AuthLayout } from "./layout/AuthLayout";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";

export const authRoutes: RouteObject[] = [
  {
    element: <AuthLayout />,
    children: [
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <SignupPage />,
      },
    ],
  },
];
