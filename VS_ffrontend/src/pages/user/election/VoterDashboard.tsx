import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useGetIdentity } from '@refinedev/core';
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
  Printer,
  Download,
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
  status: 'PLANNED' | 'LIVE' | 'FINALIZED';
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

const VoterDashboard: React.FC = () => {
  const { data: identity } = useGetIdentity<{ email: string; name: string }>();
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [details, setDetails] = useState<VoterDetails | null>(null);
  const [stats, setStats] = useState<ElectionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [token, setToken] = useState('');
  const [verifiedVote, setVerifiedVote] = useState<{ candidate_name: string; party: string } | null>(null);

  const API_BASE = 'http://localhost:3001/api/voter';

  // 1. Fetch available elections
  useEffect(() => {
    if (!identity?.email) return;

    fetch(`${API_BASE}/my-elections?email=${identity.email}`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        setElections(data);
        if (data.length > 0) setSelectedElectionId(String(data[0].election_id));
      })
      .catch((err) => console.error('Error fetching elections:', err));
  }, [identity?.email]);

  // 2. Fetch specific election data
  const fetchElectionData = useCallback(async (electionId: string) => {
    if (!identity?.email) return;
    setLoading(true);
    try {
      const election = elections.find(e => String(e.election_id) === electionId);
      
      // Fetch common details (Assignment View)
      const detailsRes = await fetch(`${API_BASE}/election/${electionId}/details?email=${identity.email}`, {
        credentials: 'include',
      });
      const detailsData = await detailsRes.json();
      setDetails(detailsData);

      // If finalized, fetch stats (Results View)
      if (election?.status === 'FINALIZED') {
        const statsRes = await fetch(`${API_BASE}/election/${electionId}/stats?email=${identity.email}`, {
          credentials: 'include',
        });
        const statsData = await statsRes.json();
        setStats(statsData);
      } else {
        setStats(null);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      toast.error('Failed to load election data');
    } finally {
      setLoading(false);
    }
  }, [identity?.email, elections]);

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
        credentials: 'include',
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
  
  const handlePrint = () => {
    window.print();
  };

  const getDirections = () => {
    if (!details?.center_name) return;
    const query = encodeURIComponent(`${details.center_name}, ${details.center_address}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const selectedElection = elections.find((e) => String(e.election_id) === selectedElectionId);

  if (!identity) return <div className="p-8 text-center"><Spinner /></div>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Vote className="h-8 w-8 text-primary" />
            Voter Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome, <span className="font-semibold text-foreground">{identity.name}</span>. Manage your voting details and view results.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="hidden md:flex items-center gap-2 font-bold bg-background/50 backdrop-blur-sm border-primary/20 hover:border-primary transition-all"
            onClick={handlePrint}
            disabled={!details}
          >
            <Printer className="h-4 w-4" />
            Download Voter Slip
          </Button>
          <div className="flex items-center gap-3 bg-card border rounded-xl p-1 px-2 shadow-sm">
            <label className="text-xs font-bold px-2 whitespace-nowrap text-muted-foreground uppercase tracking-tighter">Election:</label>
            <Select
              value={selectedElectionId || ''}
              onValueChange={setSelectedElectionId}
            >
              <SelectTrigger className="w-[180px] md:w-[240px] border-none shadow-none focus:ring-0 font-bold bg-transparent">
                <SelectValue placeholder="Choose an election" />
              </SelectTrigger>
              <SelectContent>
                {elections.map((e) => (
                  <SelectItem key={e.election_id} value={String(e.election_id)} className="font-medium">
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!selectedElectionId ? (
        <Card className="border-dashed py-12 text-center text-muted-foreground">
          <Info className="h-12 w-12 mx-auto opacity-20 mb-4" />
          <p>No active or completed elections found for your constituency.</p>
        </Card>
      ) : loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <Spinner className="h-8 w-8 mx-auto mb-4" />
          Loading your election dashboard...
        </div>
      ) : (
        <>
          {/* Status Banner */}
          <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm overflow-hidden relative ${
            selectedElection?.status === 'LIVE' ? 'bg-green-500/10 border-green-500/20 text-green-700' :
            selectedElection?.status === 'FINALIZED' ? 'bg-blue-500/10 border-blue-500/20 text-blue-700' :
            'bg-amber-500/10 border-amber-500/20 text-amber-700'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                selectedElection?.status === 'LIVE' ? 'bg-green-500 text-white animate-pulse' :
                selectedElection?.status === 'FINALIZED' ? 'bg-blue-500 text-white' :
                'bg-amber-500 text-white'
              }`}>
                {selectedElection?.status === 'LIVE' ? <Clock className="h-5 w-5" /> : 
                 selectedElection?.status === 'FINALIZED' ? <CheckCircle2 className="h-5 w-5" /> : 
                 <Calendar className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-black text-lg uppercase tracking-tight leading-none">
                  {selectedElection?.status === 'LIVE' ? 'Election is Live' : 
                   selectedElection?.status === 'FINALIZED' ? 'Results Finalized' : 
                   'Upcoming Election'}
                </p>
                <p className="text-sm opacity-80 font-medium">
                  {selectedElection?.status === 'LIVE' ? 'Proceed to your polling center to cast your vote.' : 
                   selectedElection?.status === 'FINALIZED' ? 'The official results have been published below.' : 
                   'Make sure your registration details are correct.'}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="font-bold border-current">
              {selectedElection?.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Voter & Center Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Voter Profile */}
              <Card className="overflow-hidden border-none shadow-premium-sm bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-3 border-b border-primary/10">
                  <CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                    <User className="h-4 w-4" /> My Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                      {details?.voter_name?.[0]}
                    </div>
                    <div>
                      <p className="font-black text-lg leading-tight">{details?.voter_name}</p>
                      <p className="text-sm text-muted-foreground">ID: {details?.nid}</p>
                    </div>
                  </div>
                  <Separator className="bg-primary/10" />
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Constituency</p>
                    <p className="font-bold text-primary">{details?.constituency_name}</p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background border shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${details?.has_voted ? 'bg-green-500' : 'bg-destructive animate-pulse'}`} />
                      <p className="text-sm font-bold uppercase tracking-tighter">Voting Status</p>
                    </div>
                    <Badge variant={details?.has_voted ? 'outline' : 'destructive'} className={details?.has_voted ? "bg-green-600 text-white border-none font-black" : "font-black"}>
                      {details?.has_voted ? 'VOTED' : 'PENDING'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Polling Center */}
              <Card className="shadow-premium-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Polling Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-primary/20 space-y-1 relative group cursor-default shadow-inner">
                    <h3 className="font-black text-lg leading-tight">{details?.center_name}</h3>
                    <p className="text-sm text-muted-foreground leading-snug">{details?.center_address}</p>
                    <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-30 transition-opacity">
                      <MapPin className="h-8 w-8" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded-xl bg-background shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Booth Number</p>
                      <p className="text-2xl font-black text-primary">#{details?.booth_number || 'TBD'}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="h-full flex flex-col items-center justify-center gap-1 rounded-xl group border-primary/20 hover:border-primary hover:bg-primary/5 transition-all shadow-sm"
                      onClick={getDirections}
                    >
                      <ExternalLink className="h-4 w-4 group-hover:scale-110 transition-transform text-primary" />
                      <span className="text-[10px] font-bold uppercase">Navigate</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Main Content (Map or Results) */}
            <div className="lg:col-span-2 space-y-8">
              {selectedElection?.status === 'FINALIZED' ? (
                /* RESULTS VIEW */
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="bg-primary text-primary-foreground border-none shadow-premium overflow-hidden relative">
                      <div className="absolute top-0 right-0 p-2 opacity-10">
                        <User className="h-16 w-16" />
                      </div>
                      <CardContent className="pt-6">
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80">Total Voters</p>
                        <p className="text-3xl font-black">{stats?.summary.total_assigned.toLocaleString()}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-none shadow-premium overflow-hidden relative">
                      <CardContent className="pt-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Votes Cast</p>
                        <p className="text-3xl font-black text-blue-600">{stats?.summary.votes_cast.toLocaleString()}</p>
                        <RechartsTooltip />
                      </CardContent>
                    </Card>
                    <Card className="border-none shadow-premium overflow-hidden relative">
                      <CardContent className="pt-6 text-center">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-left">Turnout</p>
                        <div className="relative inline-flex items-center justify-center mt-1">
                          <svg className="w-16 h-16 transform -rotate-90">
                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-muted/20" />
                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="175.9" 
                                    strokeDashoffset={175.9 - (175.9 * (stats?.summary.votes_cast || 0)) / (stats?.summary.total_assigned || 1)} 
                                    className="text-primary transition-all duration-1000" />
                          </svg>
                          <span className="absolute text-sm font-black">
                            {Math.round(((stats?.summary.votes_cast || 0) / (stats?.summary.total_assigned || 1)) * 100)}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Candidate Results */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="md:col-span-1 shadow-premium-sm">
                      <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-base font-black flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-primary" /> Candidate Standings
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                         <Table>
                           <TableHeader className="bg-muted/50">
                             <TableRow>
                               <TableHead className="font-bold text-xs uppercase tracking-tighter">Candidate</TableHead>
                               <TableHead className="font-bold text-xs uppercase tracking-tighter text-right">Votes</TableHead>
                               <TableHead className="font-bold text-xs uppercase tracking-tighter text-right">%</TableHead>
                             </TableRow>
                           </TableHeader>
                           <TableBody>
                             {stats?.candidates.map((c, idx) => (
                               <TableRow key={idx} className={idx === 0 ? 'bg-primary/5' : ''}>
                                 <TableCell className="py-3">
                                   <p className="font-bold text-sm leading-none">{c.name}</p>
                                   <p className="text-[10px] text-muted-foreground font-medium mt-1">{c.party}</p>
                                 </TableCell>
                                 <TableCell className="text-right font-black text-sm">{c.votes.toLocaleString()}</TableCell>
                                 <TableCell className="text-right">
                                   <Badge variant="secondary" className="text-[10px] font-black">
                                     {Math.round((c.votes / (stats.summary.votes_cast || 1)) * 100)}%
                                   </Badge>
                                 </TableCell>
                               </TableRow>
                             ))}
                           </TableBody>
                         </Table>
                      </CardContent>
                    </Card>

                    {/* Chart */}
                    <Card className="md:col-span-1 shadow-premium-sm flex flex-col">
                      <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-base font-black flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" /> Vote Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 pt-6 min-h-[250px]">
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
                              <RechartsTooltip />
                              <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
                            </PieChart>
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground italic text-sm">No vote data available</div>
                          )}
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Personal Voting Experience */}
                  <Card className="border-2 border-primary/20 shadow-premium bg-primary/[0.02]">
                    <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-black flex items-center gap-2">
                          <ShieldCheck className="h-6 w-6 text-primary" /> Verify My Vote
                        </CardTitle>
                        <CardDescription className="text-xs font-medium">Verify your recorded vote anonymously using your secure token.</CardDescription>
                      </div>
                      <Badge variant="outline" className="bg-background font-black border-primary text-primary">SECURE VERIFICATION</Badge>
                    </CardHeader>
                    <CardContent className="pt-8 space-y-6">
                      <div className="max-w-md mx-auto space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-black uppercase tracking-tight ml-1">Enter Your Voting Token</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                placeholder="e.g. VOTE-XXXX-XXXX" 
                                className="pl-10 h-11 border-2 focus-visible:ring-primary shadow-sm font-mono text-center tracking-widest text-lg" 
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                              />
                            </div>
                            <Button 
                              className="h-11 px-6 font-black tracking-tight" 
                              onClick={verifyVote} 
                              disabled={verifying}
                            >
                              {verifying ? <Spinner className="h-4 w-4 mr-2" /> : null}
                              VERIFY VOTE
                            </Button>
                          </div>
                        </div>

                        {verifiedVote && (
                          <div className="animate-in zoom-in-95 duration-300 p-6 rounded-2xl bg-primary/5 border-2 border-primary/20 flex flex-col items-center text-center space-y-2">
                            <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center mb-2 shadow-lg shadow-green-500/20">
                              <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">RECORDED VOTE FOUND FOR:</p>
                            <h3 className="text-2xl font-black text-primary leading-tight">{verifiedVote.candidate_name}</h3>
                            <Badge className="font-black px-4 py-1">{verifiedVote.party}</Badge>
                            <Separator className="my-4 bg-primary/10" />
                            <p className="text-[10px] text-muted-foreground italic">Verification complete. This token matches your selected candidate in the official vote log.</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                /* ASSIGNMENT VIEW (Map + Info) */
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-700">
                  {/* Google Map Placeholder / Embed */}
                  <Card className="overflow-hidden border-none shadow-premium aspect-video relative group">
                    <div className="absolute inset-0 bg-muted/20 z-0" />
                    {details?.lat && details?.lng ? (
                      <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/view?key=YOUR_API_KEY_HERE&center=${details.lat},${details.lng}&zoom=16&maptype=roadmap`}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 p-8 text-center">
                        <MapPin className="h-20 w-20 mb-4 opacity-10" />
                        <p className="text-lg font-black uppercase tracking-widest">Interactive Map Loading...</p>
                        <p className="text-sm font-medium mt-2 max-w-xs">{details?.center_address}</p>
                      </div>
                    )}
                    
                    {/* Map UI Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 z-10 flex gap-2">
                      <div className="flex-1 p-3 rounded-xl bg-background/90 backdrop-blur-md border shadow-lg flex items-center gap-3">
                         <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
                           <MapPin className="h-4 w-4" />
                         </div>
                         <div className="overflow-hidden">
                           <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">Center Coordinates</p>
                           <p className="text-xs font-black truncate">{details?.lat || '0.00'}°N, {details?.lng || '0.00'}°E</p>
                         </div>
                      </div>
                      <Button size="icon" className="h-12 w-12 rounded-xl shadow-lg">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </Card>

                  {/* Instructions & Timing */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="shadow-premium-sm border-l-4 border-l-primary">
                      <CardHeader>
                        <CardTitle className="text-base font-black flex items-center gap-2">
                          <Info className="h-4 w-4 text-primary" /> Election Schedule
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-start gap-3">
                           <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                             <Calendar className="h-4 w-4 text-muted-foreground" />
                           </div>
                           <div>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase">Election Date</p>
                             <p className="font-bold">{selectedElection?.start_date ? new Date(selectedElection.start_date).toLocaleDateString() : 'Loading...'}</p>
                           </div>
                        </div>
                        <div className="flex items-start gap-3">
                           <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                             <Clock className="h-4 w-4 text-muted-foreground" />
                           </div>
                           <div>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase">Voting Hours</p>
                             <p className="font-bold">08:00 AM — 04:00 PM</p>
                           </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-premium-sm">
                      <CardHeader>
                        <CardTitle className="text-base font-black flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-primary" /> Voter Checklist
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {[
                            'Bring your National ID Card (NID)',
                            'Verify your Booth Number at the entrance',
                            'Follow PO/PRO instructions carefully',
                            'Selfie/Photography inside booth is strictly prohibited',
                          ].map((text, idx) => (
                            <li key={idx} className="flex gap-2 text-sm font-medium">
                              <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                              </div>
                              {text}
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
      
      {/* ─── Hidden Printable Voter Slip ─── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #voter-slip-print, #voter-slip-print * { visibility: visible; }
          #voter-slip-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            padding: 2rem;
            background: white;
            color: black;
          }
        }
      `}} />
      
      <div id="voter-slip-print" className="hidden">
        <div className="border-4 border-black p-8 max-w-lg mx-auto bg-white text-black space-y-6">
          <div className="text-center border-b-2 border-black pb-4">
            <h1 className="text-2xl font-black uppercase tracking-tighter">Electoral Voter Slip</h1>
            <p className="text-sm font-bold">{selectedElection?.name}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase">Voter Name</p>
              <p className="font-bold">{details?.voter_name}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase">NID Number</p>
              <p className="font-bold">{details?.nid}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase">Constituency</p>
              <p className="font-bold">{details?.constituency_name}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase">Voter Status</p>
              <p className="font-bold">{details?.has_voted ? 'ALREADY VOTED' : 'PENDING'}</p>
            </div>
          </div>
          
          <div className="p-4 border-2 border-black bg-gray-100 space-y-1">
            <p className="text-[10px] font-black uppercase">Designated Polling Center</p>
            <p className="text-lg font-black">{details?.center_name}</p>
            <p className="text-xs font-bold leading-tight">{details?.center_address}</p>
          </div>
          
          <div className="flex justify-between items-end">
            <div className="border-2 border-black p-2 bg-white">
              <p className="text-[10px] font-black uppercase leading-none">Booth</p>
              <p className="text-3xl font-black">#{details?.booth_number || 'TBD'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black italic">Generated on {new Date().toLocaleDateString()}</p>
              <p className="text-[10px] font-black italic">Secure System Access Ref: {details?.nid?.slice(-4)}</p>
            </div>
          </div>
          
          <div className="text-center pt-4 border-t border-black">
            <p className="font-black text-sm uppercase">Please bring your original NID card</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoterDashboard;
