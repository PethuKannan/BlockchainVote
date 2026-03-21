import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAdmin, adminApiRequest } from "@/lib/adminAuth";
import {
  Shield, Vote, Users, Plus, Trash2, Power, BarChart3,
  Calendar, LogOut, ChevronDown, ChevronUp, UserCheck
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────
function generateTimeOptions() {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (const min of [0, 30]) {
      const value = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const period = hour < 12 ? 'AM' : 'PM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const label = `${displayHour}:${String(min).padStart(2, '0')} ${period}`;
      options.push({ value, label });
    }
  }
  return options;
}

function getDuration(start: string, end: string): string {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs <= 0) return "Invalid range";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (mins > 0) parts.push(`${mins} minute${mins > 1 ? 's' : ''}`);
  return parts.join(', ');
}

// ── Stat Card ──────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card className="border-none shadow-md">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Create Election Form ───────────────────────────────────
function CreateElectionForm({ onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("21:00");
  const [candidates, setCandidates] = useState([
    { name: "", party: "" },
    { name: "", party: "" },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const addCandidate = () =>
    setCandidates([...candidates, { name: "", party: "" }]);

  const removeCandidate = (idx: number) => {
    if (candidates.length <= 2) {
      toast({ title: "Minimum 2 candidates required", variant: "destructive" });
      return;
    }
    setCandidates(candidates.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);
    if (endDateTime <= startDateTime) {
      toast({ title: "End time must be after start time", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await adminApiRequest("POST", "/api/admin/elections", {
        title,
        description,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        candidates: candidates.filter(c => c.name && c.party),
      });
      toast({ title: "Election created successfully!" });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({ title: "Failed to create election", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Create New Election</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Election Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. 2025 Student Council Election" className="mt-1" required />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of the election" className="mt-1" />
            </div>

            {/* Start */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <Label className="text-sm font-semibold mb-3 block">🟢 Election Start</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input type="date" value={startDate}
                    onChange={e => setStartDate(e.target.value)} className="mt-1" required />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <select value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {generateTimeOptions().map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {startDate && startTime && (
                <p className="text-xs text-muted-foreground mt-2">
                  📅 Starts: {new Date(`${startDate}T${startTime}`).toLocaleString('en-IN', {
                    dateStyle: 'full', timeStyle: 'short'
                  })}
                </p>
              )}
            </div>

            {/* End */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <Label className="text-sm font-semibold mb-3 block">🔴 Election End</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input type="date" value={endDate} min={startDate}
                    onChange={e => setEndDate(e.target.value)} className="mt-1" required />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <select value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {generateTimeOptions().map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {endDate && endTime && (
                <p className="text-xs text-muted-foreground mt-2">
                  📅 Ends: {new Date(`${endDate}T${endTime}`).toLocaleString('en-IN', {
                    dateStyle: 'full', timeStyle: 'short'
                  })}
                </p>
              )}
            </div>

            {/* Duration */}
            {startDate && startTime && endDate && endTime && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs text-primary font-medium">
                  Duration: {getDuration(`${startDate}T${startTime}`, `${endDate}T${endTime}`)}
                </p>
              </div>
            )}

            {/* Candidates */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Candidates</Label>
                <Button type="button" size="sm" variant="outline" onClick={addCandidate}>
                  <Plus className="w-4 h-4 mr-1" />Add Candidate
                </Button>
              </div>
              <div className="space-y-3">
                {candidates.map((c, idx) => (
                  <div key={idx} className="flex gap-2 items-start bg-muted/30 rounded-lg p-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-2">
                      <span className="text-xs font-bold text-primary">{idx + 1}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input placeholder="Full Name" value={c.name}
                        onChange={e => {
                          const u = [...candidates]; u[idx].name = e.target.value; setCandidates(u);
                        }} required />
                      <Input placeholder="Party / Affiliation" value={c.party}
                        onChange={e => {
                          const u = [...candidates]; u[idx].party = e.target.value; setCandidates(u);
                        }} required />
                    </div>
                    <button type="button" onClick={() => removeCandidate(idx)}
                      className="text-destructive hover:text-destructive/80 mt-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading
                  ? <><i className="fas fa-spinner fa-spin mr-2"></i>Creating...</>
                  : <><Plus className="w-4 h-4 mr-2" />Create Election</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Edit Election Form ─────────────────────────────────────
function EditElectionForm({ election, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [title, setTitle] = useState(election.title);
  const [description, setDescription] = useState(election.description || "");
  const [startDate, setStartDate] = useState(
    new Date(election.startDate).toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState(
    new Date(election.startDate).toTimeString().slice(0, 5)
  );
  const [endDate, setEndDate] = useState(
    new Date(election.endDate).toISOString().split("T")[0]
  );
  const [endTime, setEndTime] = useState(
    new Date(election.endDate).toTimeString().slice(0, 5)
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);
    if (endDateTime <= startDateTime) {
      toast({ title: "End time must be after start time", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await adminApiRequest("PATCH", `/api/admin/elections/${election.id}`, {
        title,
        description,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
      });
      toast({ title: "Election updated successfully!" });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({ title: "Failed to update election", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Edit Election</h2>
              <p className="text-xs text-muted-foreground mt-1">Update title, description and schedule</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Election Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" required />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} className="mt-1" />
            </div>

            {/* Start */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <Label className="text-sm font-semibold mb-3 block">🟢 Election Start</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input type="date" value={startDate}
                    onChange={e => setStartDate(e.target.value)} className="mt-1" required />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <select value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {generateTimeOptions().map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {startDate && startTime && (
                <p className="text-xs text-muted-foreground mt-2">
                  📅 {new Date(`${startDate}T${startTime}`).toLocaleString('en-IN', {
                    dateStyle: 'full', timeStyle: 'short'
                  })}
                </p>
              )}
            </div>

            {/* End */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <Label className="text-sm font-semibold mb-3 block">🔴 Election End</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input type="date" value={endDate} min={startDate}
                    onChange={e => setEndDate(e.target.value)} className="mt-1" required />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <select value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {generateTimeOptions().map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {endDate && endTime && (
                <p className="text-xs text-muted-foreground mt-2">
                  📅 {new Date(`${endDate}T${endTime}`).toLocaleString('en-IN', {
                    dateStyle: 'full', timeStyle: 'short'
                  })}
                </p>
              )}
            </div>

            {/* Duration */}
            {startDate && startTime && endDate && endTime && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs text-primary font-medium">
                  Duration: {getDuration(`${startDate}T${startTime}`, `${endDate}T${endTime}`)}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading
                  ? <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</>
                  : <><i className="fas fa-save mr-2"></i>Save Changes</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Election Card ──────────────────────────────────────────
function ElectionCard({ election, onRefresh }: any) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParty, setNewParty] = useState("");
  const [results, setResults] = useState<any>(null);

  const toggleActive = async () => {
    try {
      await adminApiRequest("PATCH", `/api/admin/elections/${election.id}/toggle`);
      toast({ title: `Election ${election.isActive ? "deactivated" : "activated"}` });
      onRefresh();
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
  };

  const deleteElection = async () => {
    if (!confirm("Delete this election? This cannot be undone.")) return;
    try {
      await adminApiRequest("DELETE", `/api/admin/elections/${election.id}`);
      toast({ title: "Election deleted" });
      onRefresh();
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
  };

  const addCandidate = async () => {
    if (!newName || !newParty) return;
    try {
      await adminApiRequest("POST", `/api/admin/elections/${election.id}/candidates`, {
        name: newName, party: newParty,
      });
      toast({ title: "Candidate added!" });
      setNewName(""); setNewParty(""); setShowAddCandidate(false);
      onRefresh();
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
  };

  const removeCandidate = async (candidateId: string) => {
    if (!confirm("Remove this candidate?")) return;
    try {
      await adminApiRequest("DELETE",
        `/api/admin/elections/${election.id}/candidates/${candidateId}`);
      toast({ title: "Candidate removed" });
      onRefresh();
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
  };

  const viewResults = async () => {
    try {
      const res = await adminApiRequest("GET", `/api/admin/elections/${election.id}/results`);
      const data = await res.json();
      setResults(data);
    } catch {
      toast({ title: "Failed to load results", variant: "destructive" });
    }
  };

  const candidates = election.candidates as any[];

  return (
    <>
      <Card className="border-none shadow-lg overflow-hidden">
        {/* Header */}
        <div className={`p-5 text-white ${election.isActive
          ? "bg-gradient-to-r from-primary via-primary/80 to-primary/60"
          : "bg-gradient-to-r from-muted-foreground/60 to-muted-foreground/40"}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold">{election.title}</h3>
                <Badge className={election.isActive
                  ? "bg-green-500/20 text-white border-green-400/30"
                  : "bg-white/10 text-white border-white/20"}>
                  {election.isActive ? "● Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-white/80 text-sm mb-2">{election.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-white/70">
                <span>
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {new Date(election.startDate).toLocaleString('en-IN', {
                    dateStyle: 'medium', timeStyle: 'short'
                  })}
                  {" → "}
                  {new Date(election.endDate).toLocaleString('en-IN', {
                    dateStyle: 'medium', timeStyle: 'short'
                  })}
                </span>
                <span><Users className="w-3 h-3 inline mr-1" />{candidates.length} Candidates</span>
                <span><Vote className="w-3 h-3 inline mr-1" />{election.totalVotes || 0} Votes</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 ml-4">
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20"
                onClick={() => setShowEditForm(true)}>
                <i className="fas fa-edit mr-1"></i>Edit
              </Button>
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20"
                onClick={toggleActive}>
                <Power className="w-4 h-4 mr-1" />{election.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20"
                onClick={viewResults}>
                <BarChart3 className="w-4 h-4 mr-1" />Results
              </Button>
              <Button size="sm" variant="ghost"
                className="text-white/70 hover:bg-red-500/20 hover:text-white"
                onClick={deleteElection}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <button onClick={() => setExpanded(!expanded)} className="text-white/70 hover:text-white">
                {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        {results && (
          <div className="bg-muted/30 border-b border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">
                Live Results — {results.totalVotes} total votes
              </h4>
              <button onClick={() => setResults(null)}
                className="text-muted-foreground hover:text-foreground text-xs">Close</button>
            </div>
            <div className="space-y-2">
              {candidates.map((c: any) => {
                const count = results.results[c.id] || 0;
                const pct = results.totalVotes > 0
                  ? Math.round((count / results.totalVotes) * 100) : 0;
                return (
                  <div key={c.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{c.name}
                        <span className="text-xs text-muted-foreground ml-2">({c.party})</span>
                      </span>
                      <span className="text-muted-foreground">{count} votes ({pct}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Blockchain: {results.blockchainStats.totalBlocks} blocks •
              Last hash: {results.blockchainStats.lastBlockHash?.slice(0, 16)}...
            </p>
          </div>
        )}

        {/* Candidates */}
        {expanded && (
          <CardContent className="p-4 bg-card">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">Candidates ({candidates.length})</h4>
              <Button size="sm" variant="outline"
                onClick={() => setShowAddCandidate(!showAddCandidate)}>
                <Plus className="w-3 h-3 mr-1" />Add Candidate
              </Button>
            </div>

            {showAddCandidate && (
              <div className="bg-muted/30 rounded-lg p-3 mb-3 flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Full name" className="mt-1 h-8 text-sm" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Party</Label>
                  <Input value={newParty} onChange={e => setNewParty(e.target.value)}
                    placeholder="Party name" className="mt-1 h-8 text-sm" />
                </div>
                <Button size="sm" onClick={addCandidate} className="h-8">Add</Button>
                <Button size="sm" variant="ghost" className="h-8"
                  onClick={() => setShowAddCandidate(false)}>Cancel</Button>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-2">
              {candidates.map((c: any, idx: number) => (
                <div key={c.id}
                  className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border group">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    idx % 4 === 0 ? 'bg-blue-500' : idx % 4 === 1 ? 'bg-purple-500' :
                    idx % 4 === 2 ? 'bg-green-500' : 'bg-orange-500'}`}>
                    {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.party}</p>
                  </div>
                  <button onClick={() => removeCandidate(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {showEditForm && (
        <EditElectionForm
          election={election}
          onClose={() => setShowEditForm(false)}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
}

// ── Main Admin Dashboard ───────────────────────────────────
export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { adminLogout, isAdminAuthenticated } = useAdmin();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);

  if (!isAdminAuthenticated) {
    navigate("/admin/login");
    return null;
  }

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await adminApiRequest("GET", "/api/admin/stats");
      return res.json();
    },
  });

  const { data: elections, isLoading } = useQuery({
    queryKey: ["/api/admin/elections"],
    queryFn: async () => {
      const res = await adminApiRequest("GET", "/api/admin/elections");
      return res.json();
    },
  });

  const { data: users } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await adminApiRequest("GET", "/api/admin/users");
      return res.json();
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/elections"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-lg border-b border-border shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-destructive to-destructive/60 rounded-xl flex items-center justify-center shadow-lg">
                <Shield className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-destructive to-destructive/60 bg-clip-text text-transparent">
                  VoteChain Admin
                </h1>
                <p className="text-xs text-muted-foreground">Election Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-destructive/5 text-destructive border-destructive/20">
                <Shield className="w-3 h-3 mr-1" />Admin
              </Badge>
              <Button onClick={adminLogout} variant="ghost" size="sm">
                <LogOut className="w-4 h-4 mr-2" />Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatCard icon={Vote}      label="Total Elections"   value={stats.totalElections}  color="bg-primary" />
            <StatCard icon={BarChart3} label="Active Elections"  value={stats.activeElections} color="bg-green-500" />
            <StatCard icon={Users}     label="Registered Voters" value={stats.totalUsers}       color="bg-blue-500" />
            <StatCard icon={Vote}      label="Total Votes Cast"  value={stats.totalVotes}       color="bg-purple-500" />
            <StatCard icon={Shield}    label="Blockchain Blocks" value={stats.totalBlocks}      color="bg-orange-500" />
          </div>
        )}

        {/* Elections */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Elections</h2>
              <p className="text-muted-foreground text-sm">Create, edit and manage elections dynamically</p>
            </div>
            <Button onClick={() => setShowCreateForm(true)}
              className="bg-gradient-to-r from-primary to-primary/80">
              <Plus className="w-4 h-4 mr-2" />New Election
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-muted-foreground">Loading elections...</p>
            </div>
          ) : elections?.length > 0 ? (
            <div className="space-y-4">
              {elections.map((election: any) => (
                <ElectionCard key={election.id} election={election} onRefresh={refresh} />
              ))}
            </div>
          ) : (
            <Card className="border-none shadow-md">
              <CardContent className="p-12 text-center">
                <Vote className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">No Elections Yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Create your first election to get started</p>
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />Create Election
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Users */}
        {users && users.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Registered Voters</h2>
            </div>
            <Card className="border-none shadow-md">
              <CardContent className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Name</th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Username</th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">2FA</th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Face ID</th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user: any, idx: number) => (
                        <tr key={user.id}
                          className={`border-t border-border ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                          <td className="px-4 py-3 font-medium">{user.fullName}</td>
                          <td className="px-4 py-3 text-muted-foreground">@{user.username}</td>
                          <td className="px-4 py-3">
                            <Badge variant={user.totpEnabled ? "default" : "secondary"}
                              className={user.totpEnabled ? "bg-green-500/10 text-green-600 border-green-200" : ""}>
                              {user.totpEnabled ? "✓ Enabled" : "✗ Disabled"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={user.faceEnabled ? "default" : "secondary"}
                              className={user.faceEnabled ? "bg-blue-500/10 text-blue-600 border-blue-200" : ""}>
                              {user.faceEnabled ? "✓ Enabled" : "✗ Disabled"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {showCreateForm && (
        <CreateElectionForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={refresh}
        />
      )}

      <footer className="mt-16 bg-card/50 border-t border-border py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-muted-foreground">
          VoteChain Admin Panel — All actions are logged to Elastic SIEM
        </div>
      </footer>
    </div>
  );
}
