import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import { AdminProvider } from "./lib/adminAuth";
import NotFound from "@/pages/not-found";
import Register from "@/pages/auth/register";
import Login from "@/pages/auth/login";
import TOTPSetup from "@/pages/auth/totp-setup";
import FaceSetup from "@/pages/auth/face-setup";
import Dashboard from "@/pages/dashboard";
import VoteSuccess from "@/pages/vote-success";
import AdminLogin from "@/pages/admin/admin-login";
import AdminDashboard from "@/pages/admin/admin-dashboard";

function Router() {
  return (
    <Switch>
      {/* Voter routes */}
      <Route path="/" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/login" component={Login} />
      <Route path="/totp-setup" component={TOTPSetup} />
      <Route path="/face-setup" component={FaceSetup} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/vote-success" component={VoteSuccess} />

      {/* Admin routes */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AdminProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AdminProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
