import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export default function VoteSuccess() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [voteData, setVoteData] = useState<any>(null);

  useEffect(() => {
    const storedVoteData = localStorage.getItem("voteSuccess");
    if (storedVoteData) {
      setVoteData(JSON.parse(storedVoteData));
      localStorage.removeItem("voteSuccess");
    } else {
      navigate("/dashboard");
    }
  }, [navigate]);

  if (!voteData) {
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
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <i className="fas fa-check-circle text-success text-6xl"></i>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Thank You for Voting! 🎉
          </h1>
          <p className="text-xl text-muted-foreground">
            Your vote has been successfully recorded
          </p>
        </div>

        {/* Vote Details Card */}
        <Card className="border border-border shadow-lg mb-8">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-foreground mb-2">Vote Confirmation</h2>
              <p className="text-muted-foreground">Your vote has been securely recorded on the blockchain</p>
            </div>

            {/* Candidate Info */}
            <div className="bg-primary/5 border-2 border-primary/20 rounded-xl p-6 mb-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-user-check text-primary text-2xl"></i>
                </div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">You Voted For</h3>
                <p className="text-3xl font-bold text-primary mb-2" data-testid="text-candidate-name">
                  {voteData.candidateName}
                </p>
                <p className="text-lg text-muted-foreground" data-testid="text-candidate-party">
                  {voteData.candidateParty}
                </p>
              </div>
            </div>

            {/* Blockchain Details */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-cube text-primary"></i>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Block Number</p>
                    <p className="text-lg font-semibold text-foreground" data-testid="text-block-number">
                      #{voteData.blockNumber}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-shield-alt text-success"></i>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Voter</p>
                    <p className="text-lg font-semibold text-foreground" data-testid="text-voter-name">
                      {user?.fullName}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Blockchain Hash */}
            <div className="bg-accent rounded-lg p-4">
              <p className="text-sm font-medium text-foreground mb-2">
                <i className="fas fa-fingerprint text-primary mr-2"></i>
                Blockchain Hash
              </p>
              <code className="text-xs font-mono bg-background px-3 py-2 rounded block break-all text-muted-foreground" data-testid="text-block-hash">
                {voteData.blockHash}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Information Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="border border-border">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-lock text-success text-xl"></i>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Secure & Immutable</h3>
              <p className="text-xs text-muted-foreground">
                Your vote is encrypted and stored permanently on the blockchain
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-user-secret text-primary text-xl"></i>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Anonymous</h3>
              <p className="text-xs text-muted-foreground">
                Your vote is private and cannot be traced back to you
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-check-double text-warning text-xl"></i>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Verified</h3>
              <p className="text-xs text-muted-foreground">
                Triple authentication ensures vote authenticity
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Thank You Message */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-8 text-center">
            <i className="fas fa-heart text-primary text-3xl mb-4 inline-block"></i>
            <h3 className="text-2xl font-bold text-foreground mb-3">
              Your Voice Matters!
            </h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Thank you for participating in the democratic process. Your vote has been securely recorded 
              and will be counted in the final results. Together, we're building a more transparent and 
              trustworthy voting system.
            </p>
            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => navigate("/dashboard")}
                data-testid="button-back-dashboard"
              >
                <i className="fas fa-home mr-2"></i>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
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
