import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Trips from "./pages/Trips";
import TripDetail from "./pages/TripDetail";
import NotFound from "./pages/NotFound";
import EmergencySOSPage from "./pages/EmergencySOSPage";

const queryClient = new QueryClient();

const ProtectedRoute = ({ session, children }: { session: Session | null; children: React.ReactNode }) => {
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={session ? <Navigate to="/trips" replace /> : <Auth />} />
            <Route path="/trips" element={<ProtectedRoute session={session}><Trips /></ProtectedRoute>} />
            <Route path="/trip/:id" element={<ProtectedRoute session={session}><TripDetail /></ProtectedRoute>} />
            <Route path="/emergency" element={<ProtectedRoute session={session}><EmergencySOSPage /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute session={session}><Auth /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
