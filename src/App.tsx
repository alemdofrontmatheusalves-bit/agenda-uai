import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { OrganizationProvider } from "@/lib/organization-context";
import ProtectedRoute from "@/components/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import Clients from "./pages/Clients";
import ClientForm from "./pages/ClientForm";
import Professionals from "./pages/Professionals";
import ProfessionalForm from "./pages/ProfessionalForm";
import Services from "./pages/Services";
import ServiceForm from "./pages/ServiceForm";
import Appointments from "./pages/Appointments";
import AppointmentForm from "./pages/AppointmentForm";
import Inventory from "./pages/Inventory";
import ClientFinances from "./pages/ClientFinances";
import Settings from "./pages/Settings";
import Team from "./pages/Team";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              
              {/* Onboarding - requires auth but not organization */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute requireOrganization={false}>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />
              
              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <AnalyticsDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients"
                element={
                  <ProtectedRoute>
                    <Clients />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients/new"
                element={
                  <ProtectedRoute>
                    <ClientForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients/:id/edit"
                element={
                  <ProtectedRoute>
                    <ClientForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/professionals"
                element={
                  <ProtectedRoute>
                    <Professionals />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/professionals/new"
                element={
                  <ProtectedRoute>
                    <ProfessionalForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/professionals/:id/edit"
                element={
                  <ProtectedRoute>
                    <ProfessionalForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/services"
                element={
                  <ProtectedRoute>
                    <Services />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/services/new"
                element={
                  <ProtectedRoute>
                    <ServiceForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/services/:id/edit"
                element={
                  <ProtectedRoute>
                    <ServiceForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/appointments"
                element={
                  <ProtectedRoute>
                    <Appointments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/appointments/new"
                element={
                  <ProtectedRoute>
                    <AppointmentForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/appointments/:id/edit"
                element={
                  <ProtectedRoute>
                    <AppointmentForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute>
                    <Inventory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finances"
                element={
                  <ProtectedRoute>
                    <ClientFinances />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/team"
                element={
                  <ProtectedRoute>
                    <Team />
                  </ProtectedRoute>
                }
              />
              
              {/* Public invite route */}
              <Route path="/invite/:token" element={<AcceptInvite />} />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
