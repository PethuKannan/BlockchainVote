import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

export default function Register() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
    },
  });

  const onSubmit = async (data: InsertUser) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/register", data);
      const result = await response.json();
      
      login(result.token, result.user);
      
      toast({
        title: "Success",
        description: "Account created successfully! Now set up two-factor authentication.",
      });
      
      navigate("/totp-setup");
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Please try again",
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
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-vote-yea text-primary-foreground text-xl"></i>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Join VoteChain's secure voting platform
              </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="fullName" data-testid="label-fullname">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  {...form.register("fullName")}
                  data-testid="input-fullname"
                  className="mt-1"
                />
                {form.formState.errors.fullName && (
                  <p className="text-sm text-destructive mt-1" data-testid="error-fullname">
                    {form.formState.errors.fullName.message}
                  </p>
                )}
              </div>

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

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-register"
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  onClick={() => navigate("/login")}
                  className="text-primary hover:text-primary/80 font-medium"
                  data-testid="link-login"
                >
                  Sign in
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
