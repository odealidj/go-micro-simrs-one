import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./lib/AuthContext";
import { router } from "./routes";

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="simrs-ui-theme">
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
