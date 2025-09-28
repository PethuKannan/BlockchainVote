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
  const [showFaceLogin, setShowFaceLogin] = useState(false);
  const [faceLoginUsername, setFaceLoginUsername] = useState("");

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

  const handleFaceVerification = async (isMatch: boolean, confidence: number) => {
    if (isMatch) {
      toast({
        title: "Face Verified",
        description: `Face recognition successful (${confidence}% confidence)`,
      });
      setShowFaceLogin(false);
    } else {
      toast({
        title: "Face Verification Failed",
        description: `Face not recognized (${confidence}% confidence)`,
        variant: "destructive",
      });
    }
  };

  const startFaceLogin = () => {
    const username = form.getValues("username");
    if (!username) {
      toast({
        title: "Username Required",
        description: "Please enter your username first for face verification",
        variant: "destructive",
      });
      return;
    }
    
    setFaceLoginUsername(username);
    setShowFaceLogin(true);
  };

  const handleFaceLoginResult = async (descriptor: Float32Array) => {
    try {
      setIsLoading(true);
      
      const descriptorArray = Array.from(descriptor);
      const response = await apiRequest("POST", "/api/auth/verify-face", {
        username: faceLoginUsername,
        faceDescriptor: descriptorArray
      });
      
      const result = await response.json();
      
      if (result.isMatch) {
        login(result.token, result.user);
        
        toast({
          title: "Face Login Successful",
          description: `Welcome back! (${result.confidence}% confidence)`,
        });
        
        navigate("/dashboard");
      }
    } catch (error: any) {
      const errorData = JSON.parse(error.message.split(': ')[1] || '{}');
      toast({
        title: "Face Login Failed",
        description: errorData.message || "Face verification failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setShowFaceLogin(false);
    }
  };

  // Handle escape key and cleanup for face login modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showFaceLogin) {
        setShowFaceLogin(false);
      }
    };

    if (showFaceLogin) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showFaceLogin]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Face Login Modal */}
        {showFaceLogin && (
          <div 
            className="fixed inset-0 z-50"
            data-testid="face-login-backdrop"
          >
            {/* Backdrop overlay */}
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                console.log('Backdrop overlay clicked - closing modal');
                setShowFaceLogin(false);
              }}
            />
            
            {/* Modal container */}
            <div className="relative h-full flex items-center justify-center p-4">
              <div 
                className="bg-background rounded-lg max-w-lg w-full max-h-[90vh] overflow-auto shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Face Recognition Login</h3>
                  <button 
                    onClick={() => setShowFaceLogin(false)}
                    className="text-muted-foreground hover:text-foreground p-2 -m-2 rounded-md hover:bg-muted transition-colors"
                    data-testid="button-close-face-login"
                    aria-label="Close modal"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
              </div>
                <div className="p-4">
                  <FaceCapture
                    mode="enroll"
                    onFaceCapture={handleFaceLoginResult}
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

            {/* Face Login Alternative */}
            <div className="mt-6 text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                className="w-full mt-4"
                onClick={startFaceLogin}
                disabled={isLoading}
                data-testid="button-face-login"
              >
                <i className="fas fa-user-check mr-2"></i>
                Login with Face Recognition
              </Button>
            </div>

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
