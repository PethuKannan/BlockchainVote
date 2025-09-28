import { useState, useEffect } from "react";
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
import FaceCapture from "@/components/FaceCapture";

export default function Login() {
  const [, navigate] = useLocation();
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTotp, setRequiresTotp] = useState(false);
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [pendingAuthData, setPendingAuthData] = useState<any>(null);

  // Redirect if already authenticated - use useEffect to avoid render loops
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

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
      // First validate username/password (and TOTP if required)
      const response = await apiRequest("POST", "/api/auth/login", data);
      const result = await response.json();
      
      // Check if user has face recognition enabled
      if (!result.user.faceEnabled) {
        toast({
          title: "Face Recognition Required",
          description: "You must set up face recognition before logging in. Redirecting to setup...",
          variant: "destructive",
        });
        navigate("/face-setup");
        return;
      }
      
      // Store pending auth data and require face verification
      setPendingAuthData({ token: result.token, user: result.user });
      setShowFaceVerification(true);
      
      toast({
        title: "Password Verified",
        description: "Now please complete face verification to finish login",
      });
      
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

  const handleFaceVerification = async (descriptor: Float32Array) => {
    try {
      setIsLoading(true);
      
      if (!pendingAuthData) {
        toast({
          title: "Error",
          description: "Authentication session expired. Please try again.",
          variant: "destructive",
        });
        setShowFaceVerification(false);
        return;
      }
      
      // Verify face with server
      const descriptorArray = Array.from(descriptor);
      const response = await apiRequest("POST", "/api/auth/verify-face", {
        username: form.getValues("username"),
        faceDescriptor: descriptorArray
      });
      
      const result = await response.json();
      
      if (result.isMatch) {
        // Complete login with the previously validated credentials
        login(pendingAuthData.token, pendingAuthData.user);
        
        toast({
          title: "Login Successful!",
          description: `All authentication factors verified (${result.confidence}% face confidence)`,
        });
        
        navigate("/dashboard");
      } else {
        toast({
          title: "Face Verification Failed",
          description: `Face does not match (${result.confidence}% confidence). Please try again.`,
          variant: "destructive",
        });
      }
      
    } catch (error: any) {
      const errorData = JSON.parse(error.message.split(': ')[1] || '{}');
      toast({
        title: "Face Verification Error",
        description: errorData.message || "Face verification failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setShowFaceVerification(false);
      setPendingAuthData(null);
    }
  };

  const cancelFaceVerification = () => {
    setShowFaceVerification(false);
    setPendingAuthData(null);
    toast({
      title: "Login Cancelled",
      description: "Face verification cancelled. Please log in again.",
      variant: "default",
    });
  };


  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Face Verification Modal */}
        {showFaceVerification && (
          <div 
            className="fixed inset-0 z-50"
            data-testid="face-verification-backdrop"
          >
            {/* Backdrop overlay */}
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={cancelFaceVerification}
            />
            
            {/* Modal container */}
            <div className="relative h-full flex items-center justify-center p-4">
              <div 
                className="bg-background rounded-lg max-w-lg w-full max-h-[90vh] overflow-auto shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Complete Face Verification</h3>
                    <button 
                      onClick={cancelFaceVerification}
                      className="text-muted-foreground hover:text-foreground p-2 -m-2 rounded-md hover:bg-muted transition-colors"
                      data-testid="button-close-face-verification"
                      aria-label="Cancel verification"
                    >
                      <i className="fas fa-times text-lg"></i>
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Step 2 of 2: Please look at the camera to complete your login
                  </p>
                </div>
                <div className="p-4">
                  <FaceCapture
                    mode="verify"
                    onFaceCapture={handleFaceVerification}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
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
