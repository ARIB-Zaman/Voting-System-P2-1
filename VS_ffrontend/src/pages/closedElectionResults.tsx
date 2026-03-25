import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  MapPin,
  TrendingUp,
  Users,
  Vote,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Election {
  election_id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface ConstituencyResult {
  coe_id: number;
  name: string;
  region: string;
  total_voters: number;
  votes_cast: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const API = 'http://localhost:3001/api';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const turnoutPct = (cast: number, total: number) =>
  total === 0 ? 0 : Math.round((cast / total) * 1000) / 10;

// ── Component ────────────────────────────────────────────────────────────────

const ClosedElectionResults: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [election, setElection] = useState<Election | null>(null);
  const [results, setResults] = useState<ConstituencyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [elecRes, resultsRes] = await Promise.all([
        fetch(`${API}/election/${id}`),
        fetch(`${API}/election/${id}/results`),
      ]);
      if (!elecRes.ok) throw new Error('Failed to fetch election');
      if (!resultsRes.ok) throw new Error('Failed to fetch results');
      const [elecData, resultsData] = await Promise.all([
        elecRes.json(),
        resultsRes.json(),
      ]);
      setElection(elecData);
      setResults(resultsData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Finalize ─────────────────────────────────────────────────────────────
  const handleFinalize = async () => {
    if (!election) return;
    setFinalizing(true);
    try {
      const res = await fetch(`${API}/election/${election.election_id}/finalize`, {
        method: 'PUT',
      });
      if (!res.ok) throw new Error('Finalize failed');
      toast.success('Election finalized successfully');
      navigate(`/homeAdmin/finalizedElection/${election.election_id}`);
    } catch {
      toast.error('Failed to finalize election');
    } finally {
      setFinalizing(false);
    }
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalConstituencies = results.length;
  const totalVotes = results.reduce((s, r) => s + Number(r.votes_cast), 0);
  const totalVoters = results.reduce((s, r) => s + Number(r.total_voters), 0);
  const overallTurnout = turnoutPct(totalVotes, totalVoters);

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error || !election) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <p className="text-destructive">{error ?? 'Election not found'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* ── Back + Header ───────────────────────────────────────────────── */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 text-muted-foreground -ml-2"
          onClick={() => navigate('/homeAdmin')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Elections
        </Button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black tracking-tight">{election.name}</h1>
              <Badge
                variant="outline"
                className="border-0 text-xs font-bold rounded-full px-2.5 py-0.5 uppercase tracking-tight bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              >
                Closed
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <CalendarDays className="h-4 w-4" />
              {formatDate(election.start_date)} — {formatDate(election.end_date)}
            </div>
            {election.description && (
              <p className="text-sm text-muted-foreground mt-1">{election.description}</p>
            )}
          </div>

          {/* Finalize button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Finalize Election
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Finalize "{election.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark the election as <strong>Finalized</strong>. The results will be
                  locked and no further changes can be made. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {finalizing ? 'Finalizing…' : 'Yes, Finalize'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Constituencies */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Constituencies</p>
            <p className="text-2xl font-bold">{totalConstituencies}</p>
          </div>
        </div>

        {/* Total Votes Cast */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 flex-shrink-0">
            <Vote className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Votes Cast</p>
            <p className="text-2xl font-bold">{totalVotes.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">of {totalVoters.toLocaleString()} registered</p>
          </div>
        </div>

        {/* Overall Turnout */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Overall Turnout</p>
            <p className="text-2xl font-bold">{overallTurnout}%</p>
          </div>
        </div>
      </div>

      {/* ── Constituencies Table ─────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Constituency Results
          </h2>
          <Badge variant="secondary" className="text-xs">
            {totalConstituencies}
          </Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                Constituency
              </TableHead>
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                Region
              </TableHead>
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">
                Registered Voters
              </TableHead>
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">
                Votes Cast
              </TableHead>
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">
                Turnout
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 opacity-40" />
                    <p className="font-medium">No constituency data available</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              results.map((r) => {
                const pct = turnoutPct(Number(r.votes_cast), Number(r.total_voters));
                return (
                  <TableRow key={r.coe_id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="px-6 py-4">
                      <p className="text-sm font-medium">{r.name}</p>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {r.region}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right text-sm">
                      {Number(r.total_voters).toLocaleString()}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right text-sm font-medium">
                      {Number(r.votes_cast).toLocaleString()}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Mini progress bar */}
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden hidden md:block">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span
                          className={`text-sm font-bold ${
                            pct >= 50
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : pct >= 25
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ClosedElectionResults;
