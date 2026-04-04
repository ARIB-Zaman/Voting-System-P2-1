import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Vote, MapPin, Calendar, User, CheckCircle2, XCircle,
  Search, ExternalLink, ShieldCheck, Globe, Printer, Copy,
  Users, TrendingUp, Medal, Trophy, BarChart3, Info, PartyPopper, AlertCircle,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChartStyle } from '@/components/ui/chart';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList,
  Pie, PieChart, Label, Sector, XAxis, YAxis,
} from 'recharts';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// recharts omits `activeIndex` from its Pie types even though it's a valid runtime prop
const PieWithActiveIndex = Pie as any;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Election {
  election_id: string | number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'PLANNED' | 'LIVE' | 'FINALIZED' | 'COMPLETED' | 'CLOSED';
}

interface VoterDetails {
  nid: string;
  voter_name: string;
  constituency_name: string;
  constituency_id: number;
  center_name: string;
  center_address: string;
  lat: number;
  lng: number;
  booth_number: string;
  has_voted: boolean;
}

interface CandidateResult {
  rank: number;
  name: string;
  party: string;
  votes: number;
  percentage: number;
}

interface ResultsSummary {
  total_voters: number;
  votes_cast: number;
  turnout: number;
}

interface ConstituencyResults {
  constituency_name: string;
  summary: ResultsSummary;
  candidates: CandidateResult[];
}

interface PartySeat { party_name: string; seat_count: number; }

interface OverallResults {
  summary: ResultsSummary;
  party_seats: PartySeat[];
  parties: CandidateResult[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = 'http://localhost:3001/api/voter-portal';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

const PALETTE = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)',
  '#a855f7', '#ec4899', '#f97316', '#14b8a6',
];

const statusConfig: Record<string, { label: string; className: string }> = {
  LIVE:      { label: 'Active',     className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase tracking-tight' },
  PLANNED:   { label: 'Scheduled',  className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 uppercase tracking-tight' },
  CLOSED:    { label: 'Completed',  className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-tight' },
  FINALIZED: { label: 'Finalized',  className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 uppercase tracking-tight' },
};

// ── Summary Card ──────────────────────────────────────────────────────────────

const SummaryCard = ({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: string | number; color: string }) => (
  <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

// ── Results Section (shared by constituency & overall) ────────────────────────

const ResultsSection = ({
  summary, candidates, title, chartId,
}: {
  summary: ResultsSummary;
  candidates: CandidateResult[];
  title: string;
  chartId: string;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const pieKeys = candidates.map((_, i) => `c${i}`);
  const pieData = candidates.map((c, i) => ({
    key: pieKeys[i], label: c.name, seats: c.votes,
    fill: `var(--color-c${i})`,
  }));
  const pieConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = { seats: { label: 'Votes' } };
    candidates.forEach((c, i) => { cfg[`c${i}`] = { label: c.name, color: PALETTE[i % PALETTE.length] }; });
    return cfg;
  }, [candidates]);

  const barData = candidates.map(c => ({ candidate: c.name, votes: c.votes, party: c.party }));
  const barConfig: ChartConfig = { votes: { label: 'Votes', color: PALETTE[0] } };

  const renderActiveShape = useCallback(({ outerRadius = 0, innerRadius = 0, ...props }: any) => (
    <Sector {...props} outerRadius={(outerRadius as number) + 12} innerRadius={innerRadius} />
  ), []);

  return (
    <div className="space-y-6">
      <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{title}</p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <SummaryCard icon={Users} label="Registered Voters" value={summary.total_voters.toLocaleString()} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30" />
        <SummaryCard icon={Vote} label="Votes Cast" value={summary.votes_cast.toLocaleString()} color="bg-violet-100 text-violet-600 dark:bg-violet-900/30" />
        <SummaryCard icon={TrendingUp} label="Turnout" value={`${summary.turnout}%`} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/30">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Vote Share</h3>
          </div>
          <div className="p-6">
            {candidates.length > 0 ? (
              <ChartContainer id={chartId} config={pieConfig} className="mx-auto aspect-square w-full max-w-[280px]">
                <PieChart>
                  <ChartTooltip cursor={false} content={
                    <ChartTooltipContent hideLabel formatter={(value, name) => {
                      const e = pieData.find(d => d.key === name);
                      return <span className="font-bold">{e?.label ?? name}: {Number(value).toLocaleString()} votes</span>;
                    }} />
                  } />
                  <PieWithActiveIndex data={pieData} dataKey="seats" nameKey="key"
                    innerRadius={60} strokeWidth={5}
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onClick={(_d: any, idx: number) => setActiveIndex(idx)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Label content={({ viewBox }) => {
                      if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                        const active = pieData[activeIndex];
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                              {active?.seats?.toLocaleString() ?? 0}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 22} className="fill-muted-foreground text-xs">votes</tspan>
                          </text>
                        );
                      }
                    }} />
                  </PieWithActiveIndex>
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="text-center py-12 text-sm text-muted-foreground">No data available</p>
            )}
          </div>
          {candidates.length > 0 && (
            <div className="px-6 pb-5 flex flex-wrap gap-3">
              {candidates.map((c, i) => (
                <button key={i} onClick={() => setActiveIndex(i)}
                  className={`flex items-center gap-2 text-xs rounded-md px-2 py-1 transition-all border ${activeIndex === i ? 'border-border bg-muted/60' : 'border-transparent hover:bg-muted/40'}`}>
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="font-medium">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bar Chart */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/30">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Candidate Comparison</h3>
          </div>
          <div className="p-6">
            {candidates.length > 0 ? (
              <ChartContainer config={barConfig} className="min-h-[240px] w-full">
                <BarChart data={barData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="candidate" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={40} />
                  <ChartTooltip cursor={false} content={
                    <ChartTooltipContent hideLabel formatter={(value, _name, props) => [
                      <span key="v" className="font-bold">{Number(value).toLocaleString()} votes</span>,
                      <span key="p" className="text-muted-foreground ml-1">{props.payload?.party}</span>,
                    ]} />
                  } />
                  <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                    {barData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    <LabelList dataKey="votes" position="top" style={{ fontSize: 11, fontWeight: 700 }}
                      formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString() : v)} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-center py-12 text-sm text-muted-foreground">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Results Table</h3>
        </div>
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Info className="h-8 w-8 opacity-40" />
            <p className="text-sm">No results available</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Rank</TableHead>
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Candidate</TableHead>
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Party</TableHead>
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">Votes</TableHead>
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">%</TableHead>
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => (
                <TableRow key={c.rank}
                  className={`hover:bg-muted/40 transition-colors ${c.rank === 1 ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                  <TableCell className="px-6 py-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${c.rank === 1 ? 'bg-amber-500 text-white shadow-sm' : 'bg-muted text-muted-foreground'}`}>
                      {c.rank}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {c.rank === 1 && (
                        <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                          <Medal className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                      )}
                      <p className="text-sm font-bold">{c.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-muted-foreground font-medium">{c.party}</TableCell>
                  <TableCell className="px-6 py-4 text-right font-bold text-sm">{c.votes.toLocaleString()}</TableCell>
                  <TableCell className="px-6 py-4 text-right text-sm text-muted-foreground">{c.percentage}%</TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    {c.rank === 1 && (
                      <Badge className="border-0 text-xs font-bold rounded-full px-2.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 uppercase tracking-tight">
                        Winner
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const VoterPortalDashboard: React.FC = () => {
  const navigate = useNavigate();
  const voterNid = sessionStorage.getItem('voterNid');
  const voterName = sessionStorage.getItem('voterName');
  const voterConstituencyId = sessionStorage.getItem('voterConstituencyId');

  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [details, setDetails] = useState<VoterDetails | null>(null);
  const [constResults, setConstResults] = useState<ConstituencyResults | null>(null);
  const [overallResults, setOverallResults] = useState<OverallResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'constituency' | 'overall'>('constituency');

  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedVote, setVerifiedVote] = useState<{ candidate_name: string; party: string } | null>(null);

  // Derived state for overall results winner
  const totalSeats = useMemo(() => {
    if (!overallResults) return 0;
    return overallResults.party_seats.reduce((sum, p) => sum + Number(p.seat_count), 0);
  }, [overallResults]);

  const winnerParty = useMemo<PartySeat | null>(() => {
    if (!overallResults || overallResults.party_seats.length === 0 || totalSeats === 0) return null;
    const top = overallResults.party_seats[0]; // already ordered by seat_count DESC
    // Must have most seats AND >= 50%
    if (top.seat_count >= Math.ceil(totalSeats / 2)) return top;
    return null;
  }, [overallResults, totalSeats]);

  // Guard
  useEffect(() => {
    if (!voterNid) {
      toast.error('Identity not verified. Please enter your NID.');
      navigate('/voter-portal');
    }
  }, [voterNid, navigate]);

  // Fetch elections
  useEffect(() => {
    if (!voterNid) return;
    fetch(`${API}/my-elections?nid=${voterNid}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setElections(data);
        if (data.length > 0) setSelectedElectionId(String(data[0].election_id));
      })
      .catch(() => toast.error('Could not load elections for this NID.'));
  }, [voterNid]);

  // Fetch election data when selection changes
  const fetchElectionData = useCallback(async (electionId: string) => {
    if (!voterNid) return;
    setLoading(true);
    setConstResults(null);
    setOverallResults(null);
    setVerifiedVote(null);
    setDetails(null);
    try {
      const election = elections.find(e => String(e.election_id) === electionId);
      const detailsRes = await fetch(`${API}/details?nid=${voterNid}&election_id=${electionId}`);
      if (detailsRes.ok) {
        const d = await detailsRes.json();
        setDetails(d);

        if (election?.status === 'FINALIZED' || election?.status === 'COMPLETED' || election?.status === 'CLOSED') {
          const cId = d.constituency_id || voterConstituencyId;
          if (cId) {
            const [cRes, oRes] = await Promise.all([
              fetch(`${API}/election-results/${electionId}/${cId}`),
              fetch(`${API}/election-results-overall/${electionId}`),
            ]);
            if (cRes.ok) setConstResults(await cRes.json());
            if (oRes.ok) {
              const d = await oRes.json();
              // Capitalize party names case-insensitively
              if (d.party_seats) {
                 const normalizedSeats: Map<string, number> = new Map();
                 for (const p of d.party_seats) {
                    const normalized = p.party_name.trim().toUpperCase();
                    normalizedSeats.set(normalized, (normalizedSeats.get(normalized) || 0) + Number(p.seat_count));
                 }
                 const unified = Array.from(normalizedSeats.entries())
                                      .map(([name, count]) => ({ party_name: name, seat_count: count }))
                                      .sort((a,b) => b.seat_count - a.seat_count);
                 d.party_seats = unified;
              }
              setOverallResults(d);
            }
          }
        }
      }
    } catch (err) {
      toast.error('Failed to load election data.');
    } finally {
      setLoading(false);
    }
  }, [voterNid, elections, voterConstituencyId]);

  useEffect(() => {
    if (selectedElectionId && elections.length > 0) fetchElectionData(selectedElectionId);
  }, [selectedElectionId, fetchElectionData]);

  const verifyVote = async () => {
    if (!token.trim()) return toast.warning('Please enter your voting token');
    setVerifying(true);
    setVerifiedVote(null);
    try {
      const res = await fetch(`${API}/verify-vote/${token.trim()}`);
      const data = await res.json();
      if (res.ok) { setVerifiedVote(data); toast.success('Vote verified successfully!'); }
      else toast.error(data.error || 'Invalid token');
    } catch { toast.error('Verification failed'); }
    finally { setVerifying(false); }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token).then(() => toast.success('Token copied!'));
  };

  const logout = () => {
    sessionStorage.removeItem('voterNid');
    sessionStorage.removeItem('voterName');
    sessionStorage.removeItem('voterConstituencyId');
    navigate('/voter-portal');
  };

  const getDirections = () => {
    if (!details?.center_name) return;
    const query = encodeURIComponent(`${details.center_name}, ${details.center_address}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const selectedElection = elections.find(e => String(e.election_id) === selectedElectionId);
  const isFinalized = selectedElection?.status === 'FINALIZED' || selectedElection?.status === 'COMPLETED' || selectedElection?.status === 'CLOSED';
  const cfg = selectedElection ? (statusConfig[selectedElection.status] ?? statusConfig.PLANNED) : null;

  // QR slip ID
  const slipId = `VP-${voterNid?.slice(-4)}-${selectedElectionId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(slipId)}`;

  if (!voterNid) return null;

  return (
    <>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 print:hidden">


        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Globe className="h-8 w-8 text-primary shrink-0" />
              Voter Dashboard
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Welcome, <span className="font-bold text-foreground">{voterName}</span>. Review your electoral details securely.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {details && (
              <Button variant="outline" size="sm" className="gap-2 font-bold" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print Slip
              </Button>
            )}
            
            {/* Election Dropdown */}
            <div className="flex items-center gap-2 bg-card border rounded-xl p-1 px-3 shadow-sm">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Election:</label>
              <Select value={selectedElectionId || ''} onValueChange={setSelectedElectionId}>
                <SelectTrigger className="w-[200px] md:w-[260px] border-none shadow-none focus:ring-0 bg-transparent h-8 font-bold">
                  <SelectValue placeholder="Select Election" />
                </SelectTrigger>
                <SelectContent>
                  {elections.map(e => (
                    <SelectItem key={e.election_id} value={String(e.election_id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        {/* ── No Elections ───────────────────────────────────────────────── */}
        {!selectedElectionId ? (
          <div className="bg-card border rounded-xl flex flex-col items-center gap-3 py-16 text-center text-muted-foreground shadow-sm">
            <Info className="h-12 w-12 opacity-20" />
            <p className="font-bold text-sm uppercase tracking-wider">No Records Found</p>
            <p className="text-sm">No elections were found for your NID.</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center gap-4 py-24 text-muted-foreground">
            <Spinner className="h-8 w-8 text-primary" />
            <p className="text-xs font-bold uppercase tracking-widest">Loading…</p>
          </div>
        ) : (
          <>
            {/* ── Election Header Banner ────────────────────────────────── */}
            <div className={`bg-card border rounded-xl p-5 flex items-center justify-between shadow-sm overflow-hidden relative`}>
              <div className={`absolute top-0 left-0 h-full w-1.5 ${isFinalized ? 'bg-emerald-500' : selectedElection?.status === 'LIVE' ? 'bg-blue-500' : 'bg-amber-500'}`} />
              <div className="flex items-center gap-4 pl-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isFinalized ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : selectedElection?.status === 'LIVE' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'}`}>
                  {isFinalized ? <Trophy className="h-5 w-5" /> : selectedElection?.status === 'LIVE' ? <Vote className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-black tracking-tight">{selectedElection?.name}</h2>
                    {cfg && (
                      <Badge variant="outline" className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 ${cfg.className}`}>
                        {cfg.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {selectedElection?.start_date && `${formatDate(selectedElection.start_date)} — ${formatDate(selectedElection.end_date)}`}
                  </p>
                </div>
              </div>
            </div>

            {/* ── FINALIZED VIEW ────────────────────────────────────────── */}
            {isFinalized ? (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">

                {/* Toggle Tabs */}
                <div className="flex gap-6 border-b">
                  {([
                    { key: 'constituency', label: 'My Constituency' },
                    { key: 'overall',      label: 'Overall Results' },
                  ] as const).map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                      className={`pb-4 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Constituency Tab */}
                {activeTab === 'constituency' && (
                  constResults ? (
                    <ResultsSection
                      summary={constResults.summary}
                      candidates={constResults.candidates}
                      title={`Results in ${constResults.constituency_name}`}
                      chartId="const-pie"
                    />
                  ) : (
                    <div className="bg-card border rounded-xl flex flex-col items-center gap-3 py-12 text-muted-foreground shadow-sm">
                      <Info className="h-8 w-8 opacity-40" />
                      <p className="text-sm font-medium">Results not available for your constituency</p>
                    </div>
                  )
                )}

                {/* Overall Tab */}
                {activeTab === 'overall' && (
                  overallResults ? (
                    <div className="space-y-6">
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Overall Election Results</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <SummaryCard icon={Users} label="Total Voters" value={overallResults.summary.total_voters.toLocaleString()} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30" />
                        <SummaryCard icon={Vote} label="Total Votes Cast" value={overallResults.summary.votes_cast.toLocaleString()} color="bg-violet-100 text-violet-600 dark:bg-violet-900/30" />
                        <SummaryCard icon={TrendingUp} label="Overall Turnout" value={`${overallResults.summary.turnout}%`} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" />
                      </div>

                      {/* Winner / No-winner Banner */}
                      {overallResults.party_seats.length > 0 && (
                        winnerParty ? (
                          <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-6 flex items-center gap-5 shadow-sm">
                            <div className="w-16 h-16 rounded-full bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                              <PartyPopper className="h-8 w-8" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                                Winning Party
                              </p>
                              <p className="text-2xl font-black tracking-tight">{winnerParty.party_name}</p>
                              <p className="text-sm text-muted-foreground">
                                Secured a parliamentary majority
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-3xl font-black text-amber-600 dark:text-amber-400">
                                {winnerParty.seat_count}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                of {totalSeats} seats
                              </p>
                              <Badge className="mt-1 bg-amber-500 hover:bg-amber-500 text-white border-0 text-xs">
                                {Math.round((winnerParty.seat_count / totalSeats) * 100)}% majority
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/30 dark:to-slate-800/10 border border-slate-200 dark:border-slate-700/40 rounded-xl p-6 flex items-center gap-5 shadow-sm">
                            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700/50 flex items-center justify-center text-slate-500 dark:text-slate-400 flex-shrink-0">
                              <AlertCircle className="h-8 w-8" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                No Clear Winner
                              </p>
                              <p className="text-lg font-bold tracking-tight">Hung Parliament</p>
                              <p className="text-sm text-muted-foreground">
                                No party has secured ≥ 50% of the {totalSeats} available seats. Coalition
                                negotiations may be required.
                              </p>
                            </div>
                            {overallResults.party_seats[0] && (
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs text-muted-foreground mb-0.5">Leading party</p>
                                <p className="font-bold text-base">{overallResults.party_seats[0].party_name}</p>
                                <p className="text-2xl font-black text-slate-600 dark:text-slate-300">
                                  {overallResults.party_seats[0].seat_count}
                                </p>
                                <p className="text-xs text-muted-foreground">seats</p>
                              </div>
                            )}
                          </div>
                        )
                      )}

                      {/* Party Seats Table */}
                      {overallResults.party_seats.length > 0 && (
                        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                          <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Party Seats Won</h3>
                            <Badge variant="secondary" className="text-xs">{overallResults.party_seats.length} parties</Badge>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Rank</TableHead>
                                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Party</TableHead>
                                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">Seats</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {overallResults.party_seats.map((p, i) => {
                                const isWinner = winnerParty?.party_name === p.party_name;
                                return (
                                <TableRow key={p.party_name} className={`hover:bg-muted/40 transition-colors ${isWinner ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                                  <TableCell className="px-6 py-4">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isWinner ? 'bg-amber-500 text-white shadow-sm' : 'bg-muted text-muted-foreground'}`}>{i + 1}</div>
                                  </TableCell>
                                  <TableCell className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                                      <p className="text-sm font-bold">{p.party_name}</p>
                                      {isWinner && <Medal className="h-4 w-4 text-amber-500" />}
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-6 py-4 text-right font-bold">{p.seat_count}</TableCell>
                                </TableRow>
                              )})}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {/* Party Seats: Pie Chart + Leaderboard */}
                      {overallResults.party_seats.length > 0 && (
                        <div className="bg-card border rounded-xl shadow-sm overflow-hidden mt-6">
                          <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                              Parliamentary Seats by Party
                            </h2>
                            <Badge variant="secondary" className="text-xs">
                              {totalSeats} total
                            </Badge>
                          </div>

                          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 p-6">
                            {/* Pie Chart Wrapper */}
                            <div className="w-[260px] md:w-[300px] flex-shrink-0 mx-auto md:mx-0">
                               <ChartStyle id="overall-party-seats-pie" config={
                                 overallResults.party_seats.reduce((acc, p, i) => {
                                   acc[`p${i}`] = { label: p.party_name, color: PALETTE[i % PALETTE.length] };
                                   return acc;
                                 }, {} as ChartConfig)
                               } />
                              <ChartContainer
                                id="overall-party-seats-pie"
                                config={overallResults.party_seats.reduce((acc, p, i) => {
                                   acc[`p${i}`] = { label: p.party_name, color: PALETTE[i % PALETTE.length] };
                                   return acc;
                                 }, {} as ChartConfig)}
                                className="mx-auto aspect-square w-full max-w-[300px]"
                              >
                                <PieChart>
                                  <ChartTooltip
                                    cursor={false}
                                    content={
                                      <ChartTooltipContent
                                        hideLabel
                                        formatter={(value, name) => {
                                          const entry = overallResults.party_seats[Number(String(name).replace('p', ''))];
                                          return (
                                            <span className="font-bold">
                                              {entry?.party_name ?? name}:{' '}
                                              {Number(value)} seat{Number(value) !== 1 ? 's' : ''}
                                            </span>
                                          );
                                        }}
                                      />
                                    }
                                  />
                                  <PieWithActiveIndex
                                    data={overallResults.party_seats.map((p, i) => ({
                                      key: `p${i}`, party: p.party_name, seats: Number(p.seat_count), fill: `var(--color-p${i})`,
                                    }))}
                                    dataKey="seats"
                                    nameKey="key"
                                    innerRadius={60}
                                    strokeWidth={5}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <Label
                                      content={({ viewBox }) => {
                                        if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                          return (
                                            <text
                                              x={viewBox.cx}
                                              y={viewBox.cy}
                                              textAnchor="middle"
                                              dominantBaseline="middle"
                                            >
                                              <tspan
                                                x={viewBox.cx}
                                                y={viewBox.cy}
                                                className="fill-foreground text-3xl font-bold"
                                              >
                                                {totalSeats}
                                              </tspan>
                                              <tspan
                                                x={viewBox.cx}
                                                y={(viewBox.cy || 0) + 22}
                                                className="fill-muted-foreground text-xs"
                                              >
                                                seats
                                              </tspan>
                                            </text>
                                          );
                                        }
                                      }}
                                    />
                                  </PieWithActiveIndex>
                                </PieChart>
                              </ChartContainer>
                            </div>

                            {/* Party leaderboard */}
                            <div className="flex-1 w-full space-y-3">
                              {overallResults.party_seats.map((p, i) => {
                                const pct = totalSeats === 0 ? 0 : Math.round((Number(p.seat_count) / totalSeats) * 100);
                                const isWinner = winnerParty?.party_name === p.party_name;
                                return (
                                  <div
                                    key={p.party_name}
                                    className="w-full text-left rounded-lg p-3 transition-all border border-transparent hover:bg-muted/40"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span
                                        className="w-3 h-3 rounded-sm flex-shrink-0"
                                        style={{ background: PALETTE[i % PALETTE.length] }}
                                      />
                                      <span className="font-semibold text-sm flex-1 truncate">{p.party_name}</span>
                                      {isWinner && (
                                        <Medal className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                      )}
                                      <span className="text-sm font-bold flex-shrink-0">
                                        {p.seat_count} seat{Number(p.seat_count) !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="mt-2 ml-6 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                          width: `${pct}%`,
                                          background: PALETTE[i % PALETTE.length],
                                        }}
                                      />
                                    </div>
                                    <p className="ml-6 mt-1 text-xs text-muted-foreground">{pct}% of seats</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-card border rounded-xl flex flex-col items-center gap-3 py-12 text-muted-foreground shadow-sm">
                      <Info className="h-8 w-8 opacity-40" />
                      <p className="text-sm font-medium">Overall results not available</p>
                    </div>
                  )
                )}

                <hr className="border-border" />

                {/* Personal Participation */}
                <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b bg-muted/30">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" /> Your Participation
                    </h3>
                  </div>
                  <div className="p-6 flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${details?.has_voted ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
                      {details?.has_voted ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
                    </div>
                    <div>
                      <p className={`text-lg font-black ${details?.has_voted ? 'text-emerald-600' : 'text-red-600'}`}>
                        {details?.has_voted ? 'You voted in this election' : 'You did not vote in this election'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {details?.constituency_name && `Constituency: ${details.constituency_name}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vote Verification */}
                <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b bg-muted/30">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Verify My Vote
                    </h3>
                  </div>
                  <div className="p-6 space-y-6 max-w-xl">
                    <p className="text-sm text-muted-foreground">Enter your private <strong>Voting Token</strong> to verify which candidate was recorded for your vote.</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Enter Voting Token"
                          className="pl-10 h-11 font-mono font-bold border-2 focus-visible:ring-primary tracking-widest"
                          value={token}
                          onChange={e => setToken(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && verifyVote()}
                        />
                      </div>
                      <Button className="h-11 font-bold px-6" onClick={verifyVote} disabled={verifying}>
                        {verifying ? <Spinner className="h-4 w-4" /> : 'Verify'}
                      </Button>
                      {token && (
                        <Button variant="outline" className="h-11 px-3" onClick={copyToken} title="Copy token">
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {verifiedVote && (
                      <div className="animate-in fade-in slide-in-from-top-4 duration-500 p-6 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-5">
                        <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Verified Choice</p>
                          <p className="text-xl font-black tracking-tight">{verifiedVote.candidate_name}</p>
                          <Badge className="mt-1 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold">{verifiedVote.party}</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              /* ── ASSIGNMENT VIEW ─────────────────────────────────────── */
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Voter Info */}
                  <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-2xl flex-shrink-0">
                      {details?.voter_name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><User className="h-3.5 w-3.5" /> Registered Voter</p>
                      <p className="text-lg font-black tracking-tight truncate">{details?.voter_name}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs font-bold">NID: {details?.nid}</Badge>
                        <Badge variant="outline" className="text-xs font-bold border-primary/30 text-primary">{details?.constituency_name}</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Election Info */}
                  <div className="bg-card border rounded-xl p-6 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Election Info</p>
                    <p className="font-black text-base">{selectedElection?.name}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="bg-muted/40 border rounded-lg p-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Date</p>
                        <p className="text-sm font-bold">{selectedElection?.start_date && formatDate(selectedElection.start_date)}</p>
                      </div>
                      <div className="bg-muted/40 border rounded-lg p-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Hours</p>
                        <p className="text-sm font-bold">08 AM – 04 PM</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Polling Center */}
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" /> Polling Center</p>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h3 className="text-xl font-black tracking-tight">{details?.center_name || 'Not Assigned'}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{details?.center_address || 'Assignment pending'}</p>
                    </div>
                    <div className="flex gap-3 items-center">
                      <div className="text-center bg-muted/40 border rounded-xl p-4">
                        <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Booth</p>
                        <p className="text-3xl font-black text-primary">#{details?.booth_number || '--'}</p>
                      </div>
                      <Button variant="outline" className="h-auto py-3 px-4 flex flex-col gap-1 rounded-xl" onClick={getDirections}>
                        <ExternalLink className="h-5 w-5 opacity-70" />
                        <span className="text-[9px] font-black uppercase">Navigate</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Map */}
                <div className="bg-card border rounded-xl overflow-hidden shadow-sm aspect-video relative z-0">
                  {details?.lat && details?.lng ? (
                    <MapContainer
                      center={[Number(details.lat), Number(details.lng)]}
                      zoom={15}
                      scrollWheelZoom={false}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker position={[Number(details.lat), Number(details.lng)]} />
                    </MapContainer>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 bg-muted/10">
                      <MapPin className="h-16 w-16 mb-2 opacity-10" />
                      <p className="font-bold text-lg uppercase tracking-tighter">Map Preview</p>
                      <p className="text-sm mt-1">{details?.center_address || 'Location pending'}</p>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 p-3 rounded-xl bg-background/80 backdrop-blur-sm border shadow-lg">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      Your Polling Center
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b bg-muted/30">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Voting Instructions
                    </h3>
                  </div>
                  <div className="p-6">
                    <ul className="space-y-3">
                      {[
                        'Bring your original National ID (NID) — it is mandatory.',
                        'Arrive at your designated polling center on time.',
                        'Verify your booth assignment at the entrance.',
                        'Follow the queuing order and official staff guidance.',
                        'Mobile phones and campaigning are not allowed inside.',
                        'Submit any grievances to the Presiding Officer.',
                      ].map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm">
                          <span className="flex-shrink-0 w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-black">{idx + 1}</span>
                          <span className="text-muted-foreground leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div id="voter-slip-print" className="hidden print:block w-full max-w-2xl mx-auto bg-white text-black p-8">
        <div style={{ fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto', padding: 32, color: '#000', background: '#fff' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '3px solid #000', paddingBottom: 16, marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 2, marginBottom: 4 }}>ELECTION MANAGEMENT SYSTEM</p>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: '8px 0' }}>Official Voting Slip</h1>
            <p style={{ fontSize: 12, color: '#555' }}>{selectedElection?.name}</p>
          </div>

          {/* Voter Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div><p style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Voter Name</p><p style={{ fontWeight: 'bold' }}>{details?.voter_name}</p></div>
            <div><p style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>NID Number</p><p style={{ fontWeight: 'bold' }}>{details?.nid}</p></div>
            <div><p style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Constituency</p><p style={{ fontWeight: 'bold' }}>{details?.constituency_name}</p></div>
            <div><p style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Voter Status</p><p style={{ fontWeight: 'bold' }}>{details?.has_voted ? 'VOTED' : 'PENDING'}</p></div>
          </div>

          {/* Polling Center */}
          <div style={{ background: '#f5f5f5', border: '2px solid #000', padding: 16, marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Designated Polling Center</p>
            <p style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase' }}>{details?.center_name || 'Not Assigned'}</p>
            <p style={{ fontSize: 12 }}>{details?.center_address}</p>
            <p style={{ fontSize: 14, fontWeight: 900, marginTop: 8 }}>Booth No. {details?.booth_number || 'TBD'}</p>
          </div>

          {/* Voting Schedule */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ border: '1px solid #ccc', padding: 12, borderRadius: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Election Date</p>
              <p style={{ fontWeight: 'bold' }}>{selectedElection?.start_date && formatDate(selectedElection.start_date)}</p>
            </div>
            <div style={{ border: '1px solid #ccc', padding: 12, borderRadius: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Voting Hours</p>
              <p style={{ fontWeight: 'bold' }}>08:00 AM – 04:00 PM</p>
            </div>
          </div>

          {/* Instructions */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 }}>Instructions</p>
            {['Bring your original NID (mandatory)', 'Arrive at your assigned polling center', 'Proceed to Booth #' + (details?.booth_number || 'TBD'), 'Follow all official guidance'].map((t, i) => (
              <p key={i} style={{ fontSize: 11, marginBottom: 4 }}>{i + 1}. {t}</p>
            ))}
          </div>

          {/* Footer: QR + Signature */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '2px solid #000', paddingTop: 16, marginTop: 16 }}>
            <div>
              <img src={qrUrl} alt="QR Code" width={80} height={80} />
              <p style={{ fontSize: 9, marginTop: 4 }}>Slip ID: {slipId}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ width: 160, borderBottom: '1px solid #000', marginBottom: 4, height: 40 }} />
              <p style={{ fontSize: 10 }}>Voter Signature</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VoterPortalDashboard;
