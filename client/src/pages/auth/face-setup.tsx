import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import FaceCapture from "@/components/FaceCapture";

export default function FaceSetup() {
  const [, navigate] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);
  const [capturedDescriptor, setCapturedDescriptor] = useState<Float32Array | null>(null);

  // Redirect if not authenticated or face already enabled
  useEffect(() => {
    if (!token || !user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to set up face recognition",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }
    
    if (user.faceEnabled) {
      navigate("/dashboard");
      return;
    }
  }, [token, user, navigate, toast]);

  const handleFaceCapture = async (descriptor: Float32Array) => {
    try {
      setIsEnrolling(true);
      setCapturedDescriptor(descriptor);
      
      // Check if we have a valid token
      if (!token) {
        throw new Error("You need to be logged in to enroll face recognition");
      }
      
      // Convert Float32Array to regular array for JSON serialization
      const descriptorArray = Array.from(descriptor);
      
      console.log("Enrolling face with token:", token ? "present" : "missing");
      console.log("User ID:", user?.id);
      
      const response = await apiRequest("POST", "/api/auth/enroll-face", {
        faceDescriptor: descriptorArray
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Enrollment failed: ${errorText}`);
      }
      
      const result = await response.json();
      
      setEnrollmentComplete(true);
      
      toast({
        title: "Success!",
        description: "Face recognition has been enabled for your account",
      });
      
    } catch (error: any) {
      console.error("Face enrollment error:", error);
      
      // If authentication error, redirect to login
      if (error.message.includes("401") || error.message.includes("Invalid token")) {
        toast({
          title: "Authentication Required",
          description: "Please log in again to access face enrollment",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }
      
      toast({
        title: "Enrollment Failed",
        description: error.message || "Failed to enroll face. Please try again.",
        variant: "destructive",
      });
      setCapturedDescriptor(null);
    } finally {
      setIsEnrolling(false);
    }
  };

  const completeFaceSetup = () => {
    // Update user data in auth context to reflect face enabled
    if (user) {
      const updatedUser = { ...user, faceEnabled: true };
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
    navigate("/dashboard");
  };

  const skipFaceSetup = () => {
    toast({
      title: "Face Recognition Skipped",
      description: "You can enable face recognition later in your account settings.",
    });
    navigate("/dashboard");
  };

  if (!user || !token) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-vote-yea text-primary-foreground text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">VoteChain</h1>
                <p className="text-sm text-muted-foreground">Secure Blockchain Voting</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <span className="text-muted-foreground">Dashboard</span>
              <span className="text-muted-foreground">Elections</span>
              <span className="text-foreground font-medium">Face Security</span>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-success text-success-foreground rounded-full flex items-center justify-center text-sm font-medium">
                <i className="fas fa-check"></i>
              </div>
              <span className="ml-2 text-sm font-medium text-success">Account Created</span>
            </div>
            <div className="w-16 h-0.5 bg-success"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-success text-success-foreground rounded-full flex items-center justify-center text-sm font-medium">
                <i className="fas fa-check"></i>
              </div>
              <span className="ml-2 text-sm font-medium text-success">2FA Setup</span>
            </div>
            <div className="w-16 h-0.5 bg-primary"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <span className="ml-2 text-sm font-medium text-primary">Face Recognition</span>
            </div>
          </div>
        </div>

        {/* Face Setup Card */}
        {!enrollmentComplete && (
          <Card className="rounded-xl shadow-sm border border-border p-8">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-user-check text-secondary text-2xl"></i>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Enable Face Recognition</h2>
                <p className="text-muted-foreground">Add an extra layer of security with biometric authentication using your face.</p>
              </div>

              {/* Face Capture Component */}
              <div className="mb-8">
                <FaceCapture
                  mode="enroll"
                  onFaceCapture={handleFaceCapture}
                  className="mx-auto max-w-lg"
                />
              </div>

              {/* Benefits */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-accent rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    <i className="fas fa-bolt text-warning mr-2"></i>
                    Quick Access
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Log in instantly with just your face - no need to remember passwords or enter codes.
                  </p>
                </div>
                
                <div className="bg-accent rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    <i className="fas fa-shield-alt text-primary mr-2"></i>
                    Enhanced Security
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Your face data is processed locally and stored securely as encrypted mathematical descriptors.
                  </p>
                </div>
                
                <div className="bg-accent rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    <i className="fas fa-eye-slash text-success mr-2"></i>
                    Privacy Protected
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    No actual face images are stored - only mathematical patterns unique to your facial features.
                  </p>
                </div>
                
                <div className="bg-accent rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    <i className="fas fa-mobile-alt text-info mr-2"></i>
                    Device Independent
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Works on any device with a camera - desktop, laptop, tablet, or smartphone.
                  </p>
                </div>
              </div>

              {/* Security Notice */}
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <i className="fas fa-info-circle text-warning mt-1"></i>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Privacy & Security Notice</h4>
                    <p className="text-sm text-muted-foreground">
                      Your face data is converted to a mathematical descriptor and encrypted before storage. 
                      No actual face images are saved. You can disable this feature at any time in your account settings.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Completion Card */}
        {enrollmentComplete && (
          <Card className="mt-8 rounded-xl border border-border p-6" data-testid="card-face-completion">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-check text-success text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Face Recognition Enabled!</h3>
              <p className="text-sm text-muted-foreground mt-1">Your account now supports biometric authentication</p>
            </div>

            {/* Feature Summary */}
            <div className="bg-muted/30 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">What's Next?</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center">
                  <i className="fas fa-check-circle text-success mr-2"></i>
                  You can now log in using face recognition
                </li>
                <li className="flex items-center">
                  <i className="fas fa-check-circle text-success mr-2"></i>
                  Face recognition works alongside your existing 2FA
                </li>
                <li className="flex items-center">
                  <i className="fas fa-check-circle text-success mr-2"></i>
                  Manage face recognition settings in your account
                </li>
              </ul>
            </div>

            <div className="flex justify-center">
              <Button 
                onClick={completeFaceSetup}
                data-testid="button-complete-face"
              >
                Continue to Dashboard
              </Button>
            </div>
          </Card>
        )}

        {/* Alternative Options */}
        {!enrollmentComplete && (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Face recognition is optional but recommended for enhanced security.
            </p>
            <div className="flex items-center justify-center space-x-6">
              <button 
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={skipFaceSetup}
                data-testid="button-skip-face"
              >
                Skip for Now
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 bg-card border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              © 2024 VoteChain. Securing democracy through blockchain technology.
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-muted-foreground hover:text-foreground cursor-pointer">Privacy</span>
              <span className="text-muted-foreground hover:text-foreground cursor-pointer">Security</span>
              <span className="text-muted-foreground hover:text-foreground cursor-pointer">Support</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}