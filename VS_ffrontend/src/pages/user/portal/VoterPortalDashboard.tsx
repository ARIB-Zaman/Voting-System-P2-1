import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Vote,
  MapPin,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  BarChart3,
  Search,
  ExternalLink,
  Info,
  ChevronRight,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

// --- Types ---
interface Election {
  election_id: string | number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'PLANNED' | 'LIVE' | 'FINALIZED' | 'COMPLETED';
}

interface VoterDetails {
  nid: string;
  voter_name: string;
  constituency_name: string;
  center_name: string;
  center_address: string;
  lat: number;
  lng: number;
  booth_number: string;
  has_voted: boolean;
}

interface ResultSummary {
  total_assigned: number;
  votes_cast: number;
}

interface CandidateResult {
  name: string;
  party: string;
  votes: number;
}

interface ElectionStats {
  constituency_name: string;
  summary: ResultSummary;
  candidates: CandidateResult[];
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

const VoterPortalDashboard: React.FC = () => {
  const navigate = useNavigate();
  const voterNid = sessionStorage.getItem('voterNid');
  
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [details, setDetails] = useState<VoterDetails | null>(null);
  const [stats, setStats] = useState<ElectionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [token, setToken] = useState('');
  const [verifiedVote, setVerifiedVote] = useState<{ candidate_name: string; party: string } | null>(null);

  const API_BASE = 'http://localhost:3001/api/voter';

  // Check access on mount
  useEffect(() => {
    if (!voterNid) {
       toast.error('Identity not verified. Please enter your NID.');
       navigate('/voter-portal');
    }
  }, [voterNid, navigate]);

  // 1. Fetch available elections
  useEffect(() => {
    if (!voterNid) return;

    fetch(`${API_BASE}/my-elections?nid=${voterNid}`)
      .then((res) => res.json())
      .then((data) => {
        setElections(data);
        if (data.length > 0) setSelectedElectionId(String(data[0].election_id));
      })
      .catch((err) => console.error('Error fetching elections:', err));
  }, [voterNid]);

  // 2. Fetch specific election data
  const fetchElectionData = useCallback(async (electionId: string) => {
    if (!voterNid) return;
    setLoading(true);
    try {
      const election = elections.find(e => String(e.election_id) === electionId);
      
      // Fetch common details (Assignment View)
      const detailsRes = await fetch(`${API_BASE}/election/${electionId}/details?nid=${voterNid}`);
      const detailsData = await detailsRes.json();
      setDetails(detailsData);

      // If finalized/completed, fetch stats (Results View)
      if (election?.status === 'FINALIZED' || election?.status === 'COMPLETED') {
        const statsRes = await fetch(`${API_BASE}/election/${electionId}/stats?nid=${voterNid}`);
        const statsData = await statsRes.json();
        setStats(statsData);
      } else {
        setStats(null);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [voterNid, elections]);

  useEffect(() => {
    if (selectedElectionId) {
      fetchElectionData(selectedElectionId);
    }
  }, [selectedElectionId, fetchElectionData]);

  // 3. Vote Verification
  const verifyVote = async () => {
    if (!token.trim()) return toast.warning('Please enter your voting token');
    setVerifying(true);
    setVerifiedVote(null);
    try {
      const res = await fetch(`${API_BASE}/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), election_id: selectedElectionId }),
      });
      const data = await res.json();
      if (res.ok) {
        setVerifiedVote(data);
        toast.success('Vote verified successfully!');
      } else {
        toast.error(data.error || 'Invalid token');
      }
    } catch (err) {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const selectedElection = elections.find((e) => String(e.election_id) === selectedElectionId);

  if (!voterNid) return null;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary shrink-0" />
            National Voter Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Review your election details, polling center, and results securely.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-card border rounded-xl p-2 shadow-premium-sm">
          <label className="text-sm font-black px-2 whitespace-nowrap uppercase tracking-widest text-muted-foreground opacity-60">Election:</label>
          <Select
            value={selectedElectionId || ''}
            onValueChange={setSelectedElectionId}
          >
            <SelectTrigger className="w-[260px] border-none shadow-none focus:ring-0 bg-muted/50 rounded-lg h-9 font-bold">
              <SelectValue placeholder="Choose an election" />
            </SelectTrigger>
            <SelectContent>
              {elections.map((e) => (
                <SelectItem key={e.election_id} value={String(e.election_id)}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedElectionId ? (
        <Card className="border-dashed py-16 text-center text-muted-foreground bg-card/50">
          <Info className="h-14 w-14 mx-auto opacity-20 mb-4" />
          <p className="font-bold uppercase tracking-widest text-xs">No Records Found</p>
          <p className="text-sm mt-1">No active or completed elections were found for your NID.</p>
        </Card>
      ) : loading ? (
        <div className="py-24 text-center text-muted-foreground flex flex-col items-center gap-4">
          <Spinner className="h-10 w-10 text-primary" />
          <p className="font-bold uppercase tracking-[0.2em] text-xs">Syncing National Database...</p>
        </div>
      ) : (
        <>
          {/* Status Banner */}
          <div className={`p-5 rounded-2xl border flex items-center justify-between shadow-premium-sm overflow-hidden relative ${
            selectedElection?.status === 'LIVE' ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' :
            (selectedElection?.status === 'FINALIZED' || selectedElection?.status === 'COMPLETED') ? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400' :
            'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
          }`}>
             {/* Gradient Accent */}
             <div className={`absolute top-0 left-0 h-full w-1.5 ${
                selectedElection?.status === 'LIVE' ? 'bg-green-500' : 
                (selectedElection?.status === 'FINALIZED' || selectedElection?.status === 'COMPLETED') ? 'bg-blue-500' : 
                'bg-amber-500'
             }`} />

            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-lg ${
                selectedElection?.status === 'LIVE' ? 'bg-green-500 text-white animate-pulse' :
                (selectedElection?.status === 'FINALIZED' || selectedElection?.status === 'COMPLETED') ? 'bg-blue-500 text-white' :
                'bg-amber-500 text-white'
              }`}>
                {selectedElection?.status === 'LIVE' ? <Vote className="h-6 w-6" /> : 
                 (selectedElection?.status === 'FINALIZED' || selectedElection?.status === 'COMPLETED') ? <CheckCircle2 className="h-6 w-6" /> : 
                 <Calendar className="h-6 w-6" />}
              </div>
              <div className="space-y-0.5">
                <p className="font-black text-xl uppercase tracking-tighter leading-none">
                  {selectedElection?.status === 'LIVE' ? 'Voting is Live Now' : 
                   (selectedElection?.status === 'FINALIZED' || selectedElection?.status === 'COMPLETED') ? 'Election Results Released' : 
                   'Scheduled for Polls'}
                </p>
                <div className="flex items-center gap-2">
                   <Badge variant="outline" className="text-[10px] uppercase font-black px-1.5 h-4 border-current">
                      {selectedElection?.status}
                   </Badge>
                   <Separator orientation="vertical" className="h-3 bg-current opacity-20" />
                   <p className="text-xs opacity-80 font-bold uppercase tracking-widest">
                     {selectedElection?.status === 'LIVE' ? 'Proceed to center' : 
                      (selectedElection?.status === 'FINALIZED' || selectedElection?.status === 'COMPLETED') ? 'View full breakdown below' : 
                      'Planned election'}
                   </p>
                </div>
              </div>
            </div>
            
            <div className="hidden sm:block text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Election Phase</p>
              <p className="font-black text-lg">{selectedElection?.status === 'LIVE' ? 'PHASE 2: VOTING' : 
                   (selectedElection?.status === 'FINALIZED' || selectedElection?.status === 'COMPLETED') ? 'PHASE 3: PUBLICATION' : 
                   'PHASE 1: PREPARATION'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Voter & Center Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Voter Profile Card */}
              <Card className="overflow-hidden border shadow-premium-sm">
                <CardHeader className="pb-3 border-b bg-muted/30">
                   <div className="flex items-center justify-between">
                    <CardTitle className="text-xs uppercase tracking-[0.2em] font-black text-muted-foreground flex items-center gap-2">
                      <User className="h-3.5 w-3.5" /> Registered Voter
                    </CardTitle>
                    <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                   </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-4 py-2">
                    <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-2xl shadow-premium">
                      {details?.voter_name?.[0]}
                    </div>
                    <div>
                      <p className="font-black text-xl leading-none tracking-tighter mb-1">{details?.voter_name}</p>
                      <Badge variant="outline" className="font-bold text-[10px] h-5 tracking-widest">NID: {details?.nid}</Badge>
                    </div>
                  </div>
                  <Separator className="opacity-50" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Constituency</p>
                      <p className="font-black text-sm text-primary leading-tight uppercase">{details?.constituency_name}</p>
                    </div>
                    <div className="space-y-1 text-right">
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</p>
                       <Badge variant={details?.has_voted ? 'outline' : 'destructive'} className={details?.has_voted ? "font-black h-5 text-[10px] uppercase bg-green-600 text-white border-none" : "font-black h-5 text-[10px] uppercase"}>
                        {details?.has_voted ? 'VERIFIED VOTE' : 'UNDECIDED'}
                       </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Polling Station Card */}
              <Card className="shadow-premium-sm border-2 border-primary/5">
                <CardHeader className="pb-3 bg-primary/[0.03]">
                  <CardTitle className="text-xs uppercase tracking-[0.2em] font-black text-primary flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" /> Polling Station
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="space-y-1">
                    <h3 className="font-black text-lg leading-tight tracking-tight uppercase">{details?.center_name || 'NOT ASSIGNED'}</h3>
                    <p className="text-xs text-muted-foreground font-medium leading-relaxed">{details?.center_address || 'Assignment pending.'}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 p-3 rounded-xl bg-muted/40 border border-dashed text-center">
                      <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Your Booth</p>
                      <p className="text-3xl font-black text-primary leading-none">#{details?.booth_number || '--'}</p>
                    </div>
                    <Button variant="outline" className="h-auto px-4 rounded-xl border-primary/20 flex flex-col gap-1 hover:bg-primary/5 transition-colors">
                      <ExternalLink className="h-5 w-5 opacity-60" />
                      <span className="text-[9px] font-black uppercase">Navigate</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Results or Assignment Map */}
            <div className="lg:col-span-2 space-y-8">
              {(selectedElection?.status === 'FINALIZED' || selectedElection?.status === 'COMPLETED') ? (
                /* 🟥 RESULTS VIEW */
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                  {/* Summary Dashboard */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="bg-primary text-primary-foreground border-none shadow-premium overflow-hidden relative group">
                        <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10 group-hover:scale-125 transition-transform duration-700" />
                        <CardContent className="pt-6 relative z-10">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Constituency Turnout</p>
                          <div className="flex items-end gap-3">
                            <span className="text-4xl font-black">{Math.round(((stats?.summary.votes_cast || 0) / (stats?.summary.total_assigned || 1)) * 100)}%</span>
                            <span className="text-xs font-bold mb-1.5 opacity-70">({stats?.summary.votes_cast.toLocaleString()} votes cast)</span>
                          </div>
                          <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                             <div className="h-full bg-white transition-all duration-1000" style={{ width: `${Math.round(((stats?.summary.votes_cast || 0) / (stats?.summary.total_assigned || 1)) * 100)}%` }} />
                          </div>
                      </CardContent>
                    </Card>
                    <Card className="border-none shadow-premium bg-card flex items-center justify-between p-6">
                        <div className="space-y-1">
                           <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Constituency Info</p>
                           <p className="text-lg font-black">{stats?.constituency_name}</p>
                           <p className="text-xs font-medium text-muted-foreground">{selectedElection?.name}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full border-4 border-muted flex items-center justify-center text-primary font-black shadow-inner">
                          {stats?.candidates.length || 0}
                        </div>
                    </Card>
                  </div>

                  {/* Leaderboard & Chart */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border shadow-premium-sm flex flex-col">
                      <CardHeader className="pb-3 border-b bg-muted/10">
                        <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wide">
                          <BarChart3 className="h-4 w-4 text-primary" /> Candidate Standings
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 flex-1">
                        <Table>
                          <TableBody>
                            {stats?.candidates.map((c, idx) => (
                              <TableRow key={idx} className={idx === 0 ? 'bg-primary/[0.03]' : ''}>
                                <TableCell className="py-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>
                                      {idx + 1}
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm leading-tight uppercase">{c.name}</p>
                                      <p className="text-[9px] font-black text-muted-foreground tracking-widest uppercase">{c.party}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                   <p className="text-sm font-black">{c.votes.toLocaleString()}</p>
                                   <p className="text-[9px] font-bold text-muted-foreground">{Math.round((c.votes / (stats.summary.votes_cast || 1)) * 100)}%</p>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card className="border shadow-premium-sm flex flex-col">
                      <CardHeader className="pb-3 border-b bg-muted/10">
                        <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wide">
                          <PieChart className="h-4 w-4 text-primary" /> Vote Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 min-h-[250px] p-4">
                        <ResponsiveContainer width="100%" height="100%">
                         {stats?.candidates.length ? (
                           <PieChart>
                             <Pie
                               data={stats.candidates}
                               innerRadius={60}
                               outerRadius={80}
                               paddingAngle={5}
                               dataKey="votes"
                               nameKey="name"
                             >
                               {stats.candidates.map((_, index) => (
                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                               ))}
                             </Pie>
                             <RechartsTooltip contentStyle={{ fontSize: '10px', fontWeight: 'bold', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                             <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', paddingTop: '20px', textTransform: 'uppercase' }} />
                           </PieChart>
                         ) : (
                           <div className="h-full flex items-center justify-center italic text-xs text-muted-foreground uppercase tracking-widest">No data available</div>
                         )}
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Verification Section */}
                  <Card className="border-2 border-primary/20 shadow-premium bg-background overflow-hidden">
                    <div className="bg-primary text-primary-foreground px-6 py-4 flex items-center justify-between">
                       <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-tighter">
                         <ShieldCheck className="h-5 w-5" /> Independent Vote Verification
                       </CardTitle>
                       <Badge variant="outline" className="text-white border-white/30 text-[9px] font-black uppercase tracking-widest">Election Finalized</Badge>
                    </div>
                    <CardContent className="pt-8 pb-10 space-y-8">
                       <div className="max-w-md mx-auto text-center space-y-6">
                         <div className="space-y-4">
                            <p className="text-sm font-medium text-muted-foreground leading-relaxed">Enter your private <strong>Voting Token</strong> to securely verify which candidate was recorded for your vote.</p>
                            <div className="flex gap-2">
                               <div className="relative flex-1">
                                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                 <Input 
                                   placeholder="VOTER-TOKEN-HERE" 
                                   className="pl-10 h-12 text-center font-mono font-black border-2 focus-visible:ring-primary shadow-sm tracking-widest"
                                   value={token}
                                   onChange={(e) => setToken(e.target.value)}
                                 />
                               </div>
                               <Button size="lg" className="h-12 font-black tracking-tight px-8" onClick={verifyVote} disabled={verifying}>
                                 {verifying ? <Spinner className="h-4 w-4" /> : 'VERIFY'}
                               </Button>
                            </div>
                         </div>

                         {verifiedVote && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-500 p-8 rounded-3xl bg-neutral-50 dark:bg-neutral-900 border-2 border-dashed border-primary/30 flex flex-col items-center gap-3">
                               <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-500/30 mb-2">
                                 <CheckCircle2 className="h-8 w-8" />
                               </div>
                               <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">Verified Choice:</p>
                                 <h3 className="text-3xl font-black text-primary leading-tight uppercase tracking-tighter">{verifiedVote.candidate_name}</h3>
                                 <Badge className="font-black px-6 rounded-full">{verifiedVote.party}</Badge>
                               </div>
                               <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest mt-4">Verified by Independent Election Audit Protocol</p>
                            </div>
                         )}
                       </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                /* 🟩 ASSIGNMENT VIEW */
                <div className="space-y-8 animate-in slide-in-from-right-10 duration-1000">
                  {/* Map Section */}
                   <Card className="aspect-video rounded-3xl overflow-hidden border-none shadow-premium relative bg-neutral-200">
                     {details?.lat && details?.lng ? (
                        <iframe
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          title="Polling Center Location"
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY_HERE&q=${details.lat},${details.lng}&zoom=15`}
                        />
                     ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 p-12 text-center bg-card">
                           <MapPin className="h-24 w-24 mb-4 opacity-10" />
                           <h2 className="text-2xl font-black uppercase tracking-tighter">Location Map Preview</h2>
                           <p className="text-sm font-bold uppercase tracking-widest mt-2">{details?.center_address || 'Address processing'}</p>
                        </div>
                     )}

                     {/* Map Legend/Overlay */}
                     <div className="absolute top-6 left-6 max-w-[200px] p-4 rounded-2xl bg-background/80 backdrop-blur-md border shadow-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-primary" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Polling Center</span>
                        </div>
                        <Separator />
                        <p className="text-[9px] font-medium text-muted-foreground leading-relaxed uppercase">Use this location for in-person voting on election day.</p>
                     </div>
                   </Card>

                   {/* Instructions & Schedule */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="shadow-premium-sm border-l-4 border-primary bg-card">
                         <CardHeader className="pb-2">
                           <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wide">
                             <Clock className="h-4 w-4 text-primary" /> Timing Details
                           </CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-4">
                            <div className="flex gap-4">
                               <div className="flex-1 p-3 rounded-2xl bg-muted/40 border">
                                  <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">Date</p>
                                  <p className="text-sm font-black">{selectedElection?.start_date ? new Date(selectedElection.start_date).toLocaleDateString() : 'TBD'}</p>
                               </div>
                               <div className="flex-1 p-3 rounded-2xl bg-muted/40 border">
                                  <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">Hours</p>
                                  <p className="text-sm font-black">08 AM - 04 PM</p>
                               </div>
                            </div>
                            <Separator />
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none">Status: <span className="text-primary">{selectedElection?.status}</span></p>
                         </CardContent>
                      </Card>

                      <Card className="shadow-premium-sm">
                         <CardHeader className="pb-2">
                           <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wide">
                             <ShieldCheck className="h-4 w-4 text-primary" /> Security Protocol
                           </CardTitle>
                         </CardHeader>
                         <CardContent>
                            <ul className="space-y-2.5">
                              {[
                                'Original National ID (NID) is mandatory.',
                                'Verify your booth placement on arrival.',
                                'Follow the queuing order and official guidance.',
                                'Submit any grievances to the Presiding Officer.'
                              ].map((item, idx) => (
                                <li key={idx} className="flex gap-2 text-xs font-bold text-muted-foreground/80 lowercase italic">
                                  <span className="text-primary font-black uppercase not-italic">[{idx + 1}]</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                         </CardContent>
                      </Card>
                   </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VoterPortalDashboard;
