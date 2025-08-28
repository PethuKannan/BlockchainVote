import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface TOTPSetupData {
  secret: string;
  qrCode: string;
  manualEntryKey: string;
}

export default function TOTPSetup() {
  const [, navigate] = useLocation();
  const { user, token, logout } = useAuth();
  const { toast } = useToast();
  
  const [setupData, setSetupData] = useState<TOTPSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [setupComplete, setSetupComplete] = useState(false);

  // Redirect if not authenticated or TOTP already enabled
  useEffect(() => {
    if (!token || !user) {
      navigate("/login");
      return;
    }
    
    if (user.totpEnabled) {
      navigate("/dashboard");
      return;
    }
    
    initializeTOTP();
  }, [token, user, navigate]);

  const initializeTOTP = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/setup-totp", {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      setSetupData(data);
    } catch (error: any) {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to initialize TOTP setup",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyTOTP = async () => {
    if (verificationCode.length !== 6 || !/^\d{6}$/.test(verificationCode)) {
      setVerificationStatus('error');
      toast({
        title: "Invalid Code",
        description: "Please enter a valid 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setVerificationStatus('verifying');
    setIsVerifying(true);

    try {
      const response = await apiRequest("POST", "/api/auth/verify-totp", {
        token: verificationCode
      });
      
      const result = await response.json();
      setVerificationStatus('success');
      setBackupCodes(result.backupCodes);
      setSetupComplete(true);
      
      toast({
        title: "Success!",
        description: "Two-factor authentication has been enabled",
      });
      
    } catch (error: any) {
      setVerificationStatus('error');
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const regenerateSecret = async () => {
    setVerificationCode("");
    setVerificationStatus('idle');
    await initializeTOTP();
    toast({
      title: "New Code Generated",
      description: "Please scan the new QR code",
    });
  };

  const completeTOTPSetup = () => {
    navigate("/dashboard");
  };

  const skipTOTP = () => {
    toast({
      title: "Security Warning",
      description: "Skipping 2FA reduces your account security. You can enable it later in settings.",
      variant: "destructive",
    });
    navigate("/dashboard");
  };

  if (!user || !token) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-2xl text-primary mb-4"></i>
          <p className="text-muted-foreground">Setting up two-factor authentication...</p>
        </div>
      </div>
    );
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
              <span className="text-foreground font-medium">Security</span>
              <button 
                onClick={logout}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-logout"
              >
                <i className="fas fa-user-circle text-xl"></i>
              </button>
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
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <span className="ml-2 text-sm font-medium text-primary">Setup 2FA</span>
            </div>
            <div className="w-16 h-0.5 bg-muted"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-muted text-muted-foreground rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <span className="ml-2 text-sm text-muted-foreground">Verification</span>
            </div>
          </div>
        </div>

        {/* TOTP Setup Card */}
        {!setupComplete && (
          <Card className="rounded-xl shadow-sm border border-border p-8">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-shield-alt text-secondary text-2xl"></i>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Secure Your Account</h2>
                <p className="text-muted-foreground">Add two-factor authentication to protect your voting account from unauthorized access.</p>
              </div>

              {/* TOTP Setup Instructions */}
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                {/* QR Code Section */}
                <div className="bg-muted/30 rounded-lg p-6 text-center">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Scan QR Code</h3>
                  
                  {setupData && (
                    <div className="bg-white p-4 rounded-lg inline-block mb-4 shadow-sm border">
                      <img 
                        src={setupData.qrCode}
                        alt="TOTP QR Code" 
                        className="w-48 h-48 mx-auto" 
                        data-testid="img-qr-code"
                      />
                    </div>
                  )}
                  
                  <p className="text-sm text-muted-foreground">
                    Use Google Authenticator, Authy, or any TOTP-compatible app
                  </p>
                  
                  {/* Manual Entry Option */}
                  <button 
                    className="mt-4 text-sm text-primary hover:text-primary/80 font-medium" 
                    onClick={() => setShowManualEntry(!showManualEntry)}
                    data-testid="button-manual-entry"
                  >
                    {showManualEntry ? 'Hide manual entry' : "Can't scan? Enter manually"}
                  </button>
                  
                  {showManualEntry && setupData && (
                    <div className="mt-4 p-3 bg-accent rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">Manual Entry Key:</p>
                      <code className="text-sm font-mono bg-background px-2 py-1 rounded text-foreground" data-testid="text-manual-key">
                        {setupData.manualEntryKey}
                      </code>
                    </div>
                  )}
                </div>

                {/* Instructions Section */}
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Setup Instructions</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                        1
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Download an Authenticator App</p>
                        <p className="text-xs text-muted-foreground mt-1">Google Authenticator, Authy, or Microsoft Authenticator</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                        2
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Scan the QR Code</p>
                        <p className="text-xs text-muted-foreground mt-1">Open your app and scan the code on the left</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                        3
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Enter Verification Code</p>
                        <p className="text-xs text-muted-foreground mt-1">Type the 6-digit code from your app below</p>
                      </div>
                    </div>
                  </div>

                  {/* Supported Apps */}
                  <div className="mt-6 p-4 bg-accent rounded-lg">
                    <p className="text-sm font-medium text-foreground mb-3">Recommended Apps:</p>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <i className="fab fa-google text-lg text-muted-foreground"></i>
                        <span className="text-sm text-muted-foreground">Google Authenticator</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-mobile-alt text-lg text-muted-foreground"></i>
                        <span className="text-sm text-muted-foreground">Authy</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification Input */}
              <div className="bg-accent rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Verify Setup</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Enter the 6-digit code from your authenticator app to complete setup.
                </p>
                
                <div className="flex items-center space-x-4 mb-4">
                  <Label htmlFor="totpCode" className="text-sm font-medium text-foreground">
                    Verification Code:
                  </Label>
                  <Input 
                    type="text" 
                    id="totpCode"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setVerificationCode(value);
                      setVerificationStatus('idle');
                    }}
                    className="w-32 text-center font-mono text-lg tracking-wider"
                    data-testid="input-verification-code"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {/* Success State */}
                    {verificationStatus === 'success' && (
                      <div className="text-success text-sm font-medium" data-testid="status-success">
                        <i className="fas fa-check-circle mr-1"></i>
                        Code verified successfully!
                      </div>
                    )}
                    
                    {/* Error State */}
                    {verificationStatus === 'error' && (
                      <div className="text-destructive text-sm" data-testid="status-error">
                        <i className="fas fa-exclamation-circle mr-1"></i>
                        Invalid code. Please try again.
                      </div>
                    )}
                    
                    {/* Verifying State */}
                    {verificationStatus === 'verifying' && (
                      <div className="text-muted-foreground text-sm" data-testid="status-verifying">
                        <i className="fas fa-spinner fa-spin mr-1"></i>
                        Verifying code...
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    onClick={verifyTOTP}
                    disabled={isVerifying || verificationCode.length !== 6}
                    data-testid="button-verify"
                  >
                    {isVerifying ? "Verifying..." : "Verify & Continue"}
                  </Button>
                </div>
              </div>

              {/* Security Notice */}
              <div className="mt-6 bg-warning/10 border border-warning/20 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <i className="fas fa-shield-alt text-warning mt-1"></i>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Important Security Notice</h4>
                    <p className="text-sm text-muted-foreground">
                      Keep your authenticator app safe and backed up. You'll need it to access your account and vote in elections. 
                      Without it, account recovery requires administrator intervention.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Alternative Setup Options */}
        {!setupComplete && (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Having trouble with setup?
            </p>
            <div className="flex items-center justify-center space-x-6">
              <button 
                className="text-sm text-primary hover:text-primary/80 font-medium"
                onClick={regenerateSecret}
                data-testid="button-regenerate"
              >
                <i className="fas fa-redo mr-1"></i>
                Generate New Code
              </button>
              <button className="text-sm text-primary hover:text-primary/80 font-medium">
                <i className="fas fa-question-circle mr-1"></i>
                Get Help
              </button>
              <button 
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={skipTOTP}
                data-testid="button-skip"
              >
                Skip for Now
              </button>
            </div>
          </div>
        )}

        {/* Recovery Codes Preview (shown after successful setup) */}
        {setupComplete && (
          <Card className="mt-8 rounded-xl border border-border p-6" data-testid="card-completion">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-check text-success text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Two-Factor Authentication Enabled!</h3>
              <p className="text-sm text-muted-foreground mt-1">Your account is now secured with TOTP authentication</p>
            </div>

            {/* Recovery Codes */}
            <div className="bg-muted/30 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Backup Recovery Codes</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Save these codes in a secure location. Each can be used once if you lose access to your authenticator.
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <code key={index} className="bg-background px-2 py-1 rounded text-center" data-testid={`backup-code-${index}`}>
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <Button 
                onClick={completeTOTPSetup}
                data-testid="button-complete"
              >
                Continue to Dashboard
              </Button>
            </div>
          </Card>
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
