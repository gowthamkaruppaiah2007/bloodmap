import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/useNotifications";
import { useEmergencyAlerts } from "@/hooks/useEmergencyAlerts";
import EmergencyRequestOverlay from "@/components/EmergencyRequestOverlay";

import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Home from "./pages/Home";
import Onboarding from "./pages/Onboarding";
import DonorSetup from "./pages/DonorSetup";
import DonorProfile from "./pages/DonorProfile";
import BloodRequests from "./pages/BloodRequests";
import RequestDetail from "./pages/RequestDetail";
import DemandForecast from "./pages/DemandForecast";
import UserProfile from "./pages/UserProfile";
import AdminDashboard from "./pages/AdminDashboard";
import { NotFoundPage } from "./pages/NotFoundPage";

function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading BloodMap AI...</p>
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/auth" replace />;

  return <Outlet />;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (session) return <Navigate to="/home" replace />;

  return <>{children}</>;
}

function RootRedirect() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  return <Navigate to={session ? "/home" : "/auth"} replace />;
}

function AppContent() {
  useNotifications();
  const { activeEmergencyRequest, setActiveEmergencyRequest, donorCoords } = useEmergencyAlerts();

  return (
    <BrowserRouter>
      {activeEmergencyRequest && (
        <EmergencyRequestOverlay
          request={activeEmergencyRequest}
          donorCoords={donorCoords}
          onClose={() => setActiveEmergencyRequest(null)}
        />
      )}

      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/auth"
          element={
            <PublicOnlyRoute>
              <AuthPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<Home />} />
          <Route path="/profile" element={<UserProfile />} />
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

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
