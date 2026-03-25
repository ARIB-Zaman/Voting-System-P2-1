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
import { ArrowLeft, Eye, MapPin, Trophy, Users } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Election {
  election_id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Constituency {
  coe_id: number;
  constituency_id: number;
  name: string;
  region: string;
  ro_name: string | null;
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

// ── Component ────────────────────────────────────────────────────────────────

const FinalizedElection: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [election, setElection] = useState<Election | null>(null);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [elecRes, coeRes] = await Promise.all([
        fetch(`${API}/election/${id}`),
        fetch(`${API}/constituency_of_election/election/${id}`),
      ]);
      if (!elecRes.ok) throw new Error('Failed to fetch election');
      if (!coeRes.ok) throw new Error('Failed to fetch constituencies');
      const [elecData, coeData] = await Promise.all([elecRes.json(), coeRes.json()]);
      setElection(elecData);
      setConstituencies(coeData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black tracking-tight">{election.name}</h1>
              <Badge
                variant="outline"
                className="border-0 text-xs font-bold rounded-full px-2.5 py-0.5 uppercase tracking-tight bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              >
                Finalized
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatDate(election.start_date)} — {formatDate(election.end_date)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Constituencies Table ─────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Constituencies
          </h2>
          <Badge variant="secondary" className="text-xs">
            {constituencies.length}
          </Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                Name
              </TableHead>
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                Region
              </TableHead>
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                Returning Officer
              </TableHead>
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {constituencies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <MapPin className="h-8 w-8 opacity-40" />
                    <p className="font-medium">No constituencies found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              constituencies.map((c) => (
                <TableRow key={c.coe_id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="px-6 py-4">
                    <p className="text-sm font-medium">{c.name}</p>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.region}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {c.ro_name ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.ro_name}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title="View details"
                      onClick={() =>
                        navigate(`/homeAdmin/finalizedElection/${id}/constituency/${c.constituency_id}`)
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default FinalizedElection;
