import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginData } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

export default function Login() {
  const [, navigate] = useLocation();
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTotp, setRequiresTotp] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate("/dashboard");
    return null;
  }

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      totpCode: "",
    },
  });

  const onSubmit = async (data: LoginData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", data);
      const result = await response.json();
      
      login(result.token, result.user);
      
      toast({
        title: "Success",
        description: "Welcome back!",
      });
      
      navigate("/dashboard");
    } catch (error: any) {
      const errorData = JSON.parse(error.message.split(': ')[1] || '{}');
      
      if (errorData.requiresTotp) {
        setRequiresTotp(true);
        toast({
          title: "TOTP Required",
          description: "Please enter your 6-digit authenticator code",
          variant: "default",
        });
      } else {
        toast({
          title: "Login Failed",
          description: errorData.message || "Please check your credentials",
          variant: "destructive",
        });
      }
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
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-vote-yea text-primary-foreground text-xl"></i>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in to your VoteChain account
              </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="username" data-testid="label-username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  {...form.register("username")}
                  data-testid="input-username"
                  className="mt-1"
                />
                {form.formState.errors.username && (
                  <p className="text-sm text-destructive mt-1" data-testid="error-username">
                    {form.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="password" data-testid="label-password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...form.register("password")}
                  data-testid="input-password"
                  className="mt-1"
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive mt-1" data-testid="error-password">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              {requiresTotp && (
                <div>
                  <Label htmlFor="totpCode" data-testid="label-totp">Authenticator Code</Label>
                  <Input
                    id="totpCode"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    {...form.register("totpCode")}
                    data-testid="input-totp"
                    className="mt-1 text-center font-mono tracking-wider"
                  />
                  {form.formState.errors.totpCode && (
                    <p className="text-sm text-destructive mt-1" data-testid="error-totp">
                      {form.formState.errors.totpCode.message}
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button
                  onClick={() => navigate("/register")}
                  className="text-primary hover:text-primary/80 font-medium"
                  data-testid="link-register"
                >
                  Create one
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
