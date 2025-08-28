import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, token, logout } = useAuth();
  const { toast } = useToast();

  // Redirect if not authenticated
  if (!token || !user) {
    navigate("/login");
    return null;
  }

  const { data: elections, isLoading: electionsLoading } = useQuery({
    queryKey: ["/api/elections"],
    enabled: !!token,
  });

  const voteForCandidate = async (electionId: string, candidateId: string) => {
    try {
      const response = await apiRequest("POST", "/api/vote", {
        electionId,
        candidateId
      });
      
      const result = await response.json();
      
      toast({
        title: "Vote Recorded",
        description: `Your vote has been recorded in block #${result.blockNumber}`,
      });
      
      // Refresh elections to update UI
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Voting Failed",
        description: error.message || "Failed to record vote",
        variant: "destructive",
      });
    }
  };

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
            <nav className="flex items-center space-x-6">
              <span className="text-foreground font-medium">Dashboard</span>
              <span className="text-muted-foreground">Elections</span>
              <span className="text-muted-foreground">Security</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Welcome, {user.fullName}</span>
                <button 
                  onClick={logout}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-logout"
                >
                  <i className="fas fa-sign-out-alt"></i>
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* User Status */}
        <div className="mb-8">
          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Account Status</h2>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-user text-muted-foreground"></i>
                      <span className="text-sm text-muted-foreground">{user.username}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <i className={`fas fa-shield-alt ${user.totpEnabled ? 'text-success' : 'text-warning'}`}></i>
                      <span className={`text-sm ${user.totpEnabled ? 'text-success' : 'text-warning'}`}>
                        2FA {user.totpEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
                {!user.totpEnabled && (
                  <Button 
                    onClick={() => navigate("/totp-setup")}
                    variant="outline"
                    data-testid="button-setup-2fa"
                  >
                    Setup 2FA
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Elections */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">Active Elections</h2>
          
          {electionsLoading ? (
            <div className="text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground mb-4"></i>
              <p className="text-muted-foreground">Loading elections...</p>
            </div>
          ) : elections && elections.length > 0 ? (
            <div className="grid gap-6">
              {elections.map((election: any) => (
                <Card key={election.id} className="border border-border">
                  <CardContent className="p-6">
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold text-foreground mb-2">{election.title}</h3>
                      <p className="text-muted-foreground">{election.description}</p>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        Voting Period: {new Date(election.startDate).toLocaleDateString()} - {new Date(election.endDate).toLocaleDateString()}
                      </p>
                      <div className={`inline-flex items-center space-x-2 px-2 py-1 rounded-full text-xs ${
                        election.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${election.isActive ? 'bg-success' : 'bg-muted-foreground'}`}></div>
                        <span>{election.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-3">Candidates:</h4>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {election.candidates.map((candidate: any) => (
                          <div key={candidate.id} className="bg-muted/30 rounded-lg p-4">
                            <h5 className="font-medium text-foreground">{candidate.name}</h5>
                            <p className="text-sm text-muted-foreground mb-3">{candidate.party}</p>
                            {election.isActive && (
                              <Button
                                size="sm"
                                onClick={() => voteForCandidate(election.id, candidate.id)}
                                data-testid={`button-vote-${candidate.id}`}
                              >
                                Vote
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border border-border">
              <CardContent className="p-8 text-center">
                <i className="fas fa-ballot-check text-4xl text-muted-foreground mb-4"></i>
                <h3 className="text-lg font-semibold text-foreground mb-2">No Active Elections</h3>
                <p className="text-muted-foreground">Check back later for upcoming voting opportunities.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
