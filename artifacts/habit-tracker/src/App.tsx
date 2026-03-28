import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { queryClient } from "@/lib/query-client";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import AuthCallback from "@/pages/auth-callback";
import Dashboard from "@/pages/dashboard";
import CreateHabit from "@/pages/create-habit";
import EditHabit from "@/pages/edit-habit";
import HabitDetail from "@/pages/habit-detail";
import AdminDashboard from "@/pages/admin";
import { PendingScreen, RejectedScreen } from "@/pages/pending";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (user.status === "pending") return <PendingScreen />;
  if (user.status === "rejected") return <RejectedScreen />;

  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/auth/callback" component={AuthCallback} />

      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/habits/new" component={() => <ProtectedRoute component={CreateHabit} />} />
      <Route path="/habits/:id/edit" component={() => <ProtectedRoute component={EditHabit} />} />
      <Route path="/habits/:id" component={() => <ProtectedRoute component={HabitDetail} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
