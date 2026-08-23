import type { RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { KasirLayout } from "./components/KasirLayout";
import { KasirDashboard } from "./pages/KasirDashboard";
import { BillingQueuePage } from "./pages/BillingQueuePage";
import { InvoicePage } from "./pages/InvoicePage";
import { PaymentPage } from "./pages/PaymentPage";

export const kasirRoutes: RouteObject[] = [
  {
    path: "/kasir",
    element: <ProtectedRoute allowedRoles={["kasir", "admin", "super_admin"]} />,
    children: [
      {
        element: <KasirLayout />,
        children: [
          { index: true, element: <KasirDashboard /> },
          { path: "antrean", element: <BillingQueuePage /> },
          { path: "invoice", element: <InvoicePage /> },
          { path: "bayar", element: <PaymentPage /> },
          { path: "bayar/:encounterNo", element: <PaymentPage /> },
          {
            path: "laporan",
            element: <KasirDashboard />,
          },
        ],
      },
    ],
  },
];
