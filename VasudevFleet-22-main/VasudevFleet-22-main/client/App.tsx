import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useState, type ReactNode } from "react";
import { auth } from "./firebase";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import TripsPage from "./pages/TripsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import UsersPage from "./pages/UsersPage";
import CreateTripPage from "./pages/CreateTripPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import IssuesPage from "./pages/IssuesPage";
import EnquiriesPage from "./pages/EnquiriesPage";

const queryClient = new QueryClient();

const comingSoonRoutes = [
  { path: "/overview", title: "Overview" },
  { path: "/history", title: "History" },
  { path: "/vehicles", title: "Vehicles" },
  { path: "/jobs", title: "Jobs" },
  { path: "/reminders", title: "Reminders" },
  { path: "/finance", title: "Finance" },
  { path: "/ai-agents", title: "AI Agents" },
  { path: "/records", title: "Records" },
  { path: "/alarms", title: "Alarms" },
  { path: "/reports", title: "Reports" },
  { path: "/call-us", title: "Call Us" },
  { path: "/account", title: "Account" },
];

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(auth));

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
  }, []);

  const handleSignOut = async () => {
    if (auth) await signOut(auth);
  };

  const authLoadingView = <div className="auth-loading" aria-label="Loading your fleet workspace"><span /></div>;
  const renderProtectedRoute = (page: ReactNode) => authLoading
    ? authLoadingView
    : user
      ? page
      : <LandingPage />;
  const home = renderProtectedRoute(<Index onSignOut={handleSignOut} />);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={home} />
            <Route path="/realtime" element={renderProtectedRoute(<Index onSignOut={handleSignOut} />)} />
            <Route path="/trips" element={renderProtectedRoute(<TripsPage onSignOut={handleSignOut} />)} />
            <Route path="/audit-logs" element={renderProtectedRoute(<AuditLogsPage onSignOut={handleSignOut} />)} />
            <Route path="/users" element={renderProtectedRoute(<UsersPage onSignOut={handleSignOut} />)} />
            <Route path="/issues" element={renderProtectedRoute(<IssuesPage onSignOut={handleSignOut} />)} />
            <Route path="/enquiries" element={renderProtectedRoute(<EnquiriesPage onSignOut={handleSignOut} />)} />
            <Route path="/trips/create" element={renderProtectedRoute(<CreateTripPage onSignOut={handleSignOut} />)} />
            <Route path="/trips/:documentId/edit" element={renderProtectedRoute(<CreateTripPage onSignOut={handleSignOut} />)} />
            {comingSoonRoutes.map(({ path, title }) => <Route key={path} path={path} element={renderProtectedRoute(<ComingSoonPage title={title} onSignOut={handleSignOut} />)} />)}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}

createRoot(document.getElementById("root")!).render(<App />);
