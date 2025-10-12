import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, Users, Shield, CheckCircle2, Clock, Vote, Lock } from "lucide-react";

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

  // Ensure elections is an array
  const electionsList = Array.isArray(elections) ? elections : [];

  const voteForCandidate = async (electionId: string, candidateId: string, candidateName: string, candidateParty: string) => {
    // Check authentication requirements before voting
    if (!user?.totpEnabled) {
      toast({
        title: "2FA Required",
        description: "You must enable TOTP authentication before voting. Please complete setup.",
        variant: "destructive",
      });
      return;
    }
    
    if (!user?.faceEnabled) {
      toast({
        title: "Face Recognition Required", 
        description: "You must enable face recognition before voting. Please complete setup.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await apiRequest("POST", "/api/vote", {
        electionId,
        candidateId
      });
      
      const result = await response.json();
      
      // Store vote data for success page
      localStorage.setItem("voteSuccess", JSON.stringify({
        candidateName,
        candidateParty,
        blockNumber: result.blockNumber,
        blockHash: result.blockHash
      }));
      
      // Navigate to success page
      navigate("/vote-success");
    } catch (error: any) {
      toast({
        title: "Voting Failed",
        description: error.message || "Failed to record vote",
        variant: "destructive",
      });
    }
  };

  // Check if user can vote (has both TOTP and face authentication)
  const canVote = user?.totpEnabled && user?.faceEnabled;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-lg border-b border-border shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg">
                  <Vote className="text-primary-foreground w-6 h-6" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-card animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  VoteChain
                </h1>
                <p className="text-xs text-muted-foreground">Blockchain Powered Democracy</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="hidden md:flex items-center space-x-2 bg-muted/50 rounded-full px-4 py-2">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{user.fullName.charAt(0)}</span>
                </div>
                <span className="text-sm font-medium text-foreground">{user.fullName}</span>
              </div>
              <Button 
                onClick={logout}
                variant="ghost"
                size="sm"
                data-testid="button-logout"
              >
                <i className="fas fa-sign-out-alt mr-2"></i>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Status Banner */}
        <div className="mb-8">
          <Card className="border-none shadow-lg bg-gradient-to-r from-primary/10 via-primary/5 to-background">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3">Security Status</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline" className="bg-background/50">
                      <i className="fas fa-user text-primary mr-2"></i>
                      {user.username}
                    </Badge>
                    <Badge 
                      variant={user.totpEnabled ? "default" : "secondary"}
                      className={user.totpEnabled ? "bg-success text-success-foreground" : ""}
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      2FA {user.totpEnabled ? '✓' : '✗'}
                    </Badge>
                    <Badge 
                      variant={user.faceEnabled ? "default" : "secondary"}
                      className={user.faceEnabled ? "bg-success text-success-foreground" : ""}
                    >
                      <i className="fas fa-user-check mr-1"></i>
                      Face ID {user.faceEnabled ? '✓' : '✗'}
                    </Badge>
                    {canVote && (
                      <Badge className="bg-gradient-to-r from-success to-success/80 text-success-foreground">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Ready to Vote
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!user.totpEnabled && (
                    <Button 
                      onClick={() => navigate("/totp-setup")}
                      size="sm"
                      variant="outline"
                      className="bg-background/50"
                      data-testid="button-setup-2fa"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Setup 2FA
                    </Button>
                  )}
                  {!user.faceEnabled && (
                    <Button 
                      onClick={() => navigate("/face-setup")}
                      size="sm"
                      variant="outline"
                      className="bg-background/50"
                      data-testid="button-setup-face"
                    >
                      <i className="fas fa-user-check mr-2"></i>
                      Setup Face ID
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Elections Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground">Active Elections</h2>
              <p className="text-muted-foreground mt-1">Cast your vote securely on the blockchain</p>
            </div>
            {electionsList.length > 0 && (
              <Badge variant="outline" className="text-sm">
                <Calendar className="w-4 h-4 mr-2" />
                {electionsList.length} Active
              </Badge>
            )}
          </div>
          
          {electionsLoading ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading elections...</p>
            </div>
          ) : electionsList.length > 0 ? (
            <div className="grid gap-6">
              {electionsList.map((election: any) => (
                <Card key={election.id} className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group">
                  {/* Election Header with Gradient */}
                  <div className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 p-6 text-primary-foreground">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold">{election.title}</h3>
                          {election.isActive ? (
                            <Badge className="bg-success/20 text-success-foreground border-success/30">
                              <div className="w-2 h-2 bg-success-foreground rounded-full mr-2 animate-pulse"></div>
                              Live
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-muted/20">
                              <Clock className="w-3 h-3 mr-1" />
                              Ended
                            </Badge>
                          )}
                        </div>
                        <p className="text-primary-foreground/90 mb-4">{election.description}</p>
                        <div className="flex items-center gap-4 text-sm text-primary-foreground/80">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(election.startDate).toLocaleDateString()}</span>
                          </div>
                          <span>→</span>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(election.endDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-auto">
                            <Users className="w-4 h-4" />
                            <span>{election.candidates.length} Candidates</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Candidates Grid */}
                  <CardContent className="p-6 bg-card">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {election.candidates.map((candidate: any, idx: number) => (
                        <div 
                          key={candidate.id} 
                          className="group/card relative bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl p-5 border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
                        >
                          {/* Candidate Avatar */}
                          <div className="flex items-start gap-4 mb-4">
                            <div className="relative">
                              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white ${
                                idx % 4 === 0 ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                                idx % 4 === 1 ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                                idx % 4 === 2 ? 'bg-gradient-to-br from-green-500 to-green-600' :
                                'bg-gradient-to-br from-orange-500 to-orange-600'
                              }`}>
                                {candidate.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center border-2 border-muted">
                                <CheckCircle2 className="w-3 h-3 text-primary" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <h5 className="font-bold text-foreground text-lg leading-tight">{candidate.name}</h5>
                              <p className="text-sm text-muted-foreground mt-1">{candidate.party}</p>
                            </div>
                          </div>
                          
                          {/* Vote Button */}
                          {election.isActive && canVote && (
                            <Button
                              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md group-hover/card:shadow-lg transition-all"
                              onClick={() => voteForCandidate(election.id, candidate.id, candidate.name, candidate.party)}
                              data-testid={`button-vote-${candidate.id}`}
                            >
                              <Vote className="w-4 h-4 mr-2" />
                              Cast Vote
                            </Button>
                          )}
                          
                          {election.isActive && !canVote && (
                            <div className="w-full bg-muted/50 rounded-lg p-3 flex items-center gap-2 text-sm text-muted-foreground">
                              <Lock className="w-4 h-4" />
                              <span className="text-xs">
                                {!user?.totpEnabled && !user?.faceEnabled ? (
                                  'Complete security setup to vote'
                                ) : !user?.totpEnabled ? (
                                  'Enable 2FA to vote'
                                ) : (
                                  'Enable Face ID to vote'
                                )}
                              </span>
                            </div>
                          )}
                          
                          {!election.isActive && (
                            <div className="w-full bg-muted/30 rounded-lg p-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span>Voting Closed</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  
                  {/* Election Footer */}
                  <div className="bg-muted/30 px-6 py-3 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Shield className="w-4 h-4 text-primary" />
                        <span>Secured by Blockchain Technology</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <i className="fas fa-lock text-xs"></i>
                        <span className="text-xs">End-to-End Encrypted</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-none shadow-lg">
              <CardContent className="p-16 text-center">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Vote className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">No Active Elections</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  There are no elections currently available. Check back soon for upcoming voting opportunities.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="mt-16 bg-card/50 backdrop-blur-sm border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>© 2024 VoteChain - Securing Democracy with Blockchain</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hover:text-foreground cursor-pointer transition-colors">Privacy Policy</span>
              <span className="hover:text-foreground cursor-pointer transition-colors">Terms of Service</span>
              <span className="hover:text-foreground cursor-pointer transition-colors">Support</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
