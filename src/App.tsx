import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Home from "./pages/Home";
import Onboarding from "./pages/Onboarding";
import DonorSetup from "./pages/DonorSetup";
import DonorProfile from "./pages/DonorProfile";
import BloodRequests from "./pages/BloodRequests";
import RequestDetail from "./pages/RequestDetail";
import DemandForecast from "./pages/DemandForecast";
import AdminDashboard from "./pages/AdminDashboard";
import { NotFoundPage } from "./pages/NotFoundPage";

function ProtectedRoute() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      setAuthenticated(!error && !!data.user);
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<Home />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/donor-setup" element={<DonorSetup />} />
          <Route path="/donors/:id" element={<DonorProfile />} />
          <Route path="/requests" element={<BloodRequests />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/forecast" element={<DemandForecast />} />
        </Route>

        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster position="top-center" richColors closeButton />
    </BrowserRouter>
  );
}
