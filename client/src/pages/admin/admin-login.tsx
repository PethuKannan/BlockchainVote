import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/lib/adminAuth";
import { Shield, Lock } from "lucide-react";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { adminLogin, isAdminAuthenticated } = useAdmin();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (isAdminAuthenticated) {
    navigate("/admin/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }

      const data = await res.json();
      adminLogin(data.token);

      toast({
        title: "Admin Login Successful",
        description: "Welcome to the VoteChain Admin Panel",
      });

      navigate("/admin/dashboard");
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid admin credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-destructive/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="text-destructive w-7 h-7" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-sm text-muted-foreground mt-1">
                VoteChain Election Management System
              </p>
            </div>

            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-6 flex items-center gap-2">
              <Lock className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">
                Restricted access. All login attempts are monitored and logged to Elastic SIEM.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Admin Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Admin Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-destructive hover:bg-destructive/90"
                disabled={isLoading}
              >
                {isLoading
                  ? <><i className="fas fa-spinner fa-spin mr-2"></i>Signing In...</>
                  : <><Shield className="w-4 h-4 mr-2" />Admin Sign In</>
                }
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => navigate("/login")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back to Voter Login
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
