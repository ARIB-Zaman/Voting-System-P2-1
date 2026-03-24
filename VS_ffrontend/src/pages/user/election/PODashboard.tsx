import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  MapPin,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PODashboardProps {
  electionId: string | number;
  boothId: string | number;
  electionName: string;
  locationLabel: string | null;
  startDate: string;
  endDate: string;
}

interface Voter {
  id: number;       // voter_of_election.id
  nid: string;
  name: string;
  phone: string;
  email: string;
  voter_type: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API = 'http://localhost:3001/api';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

// ─── Component ────────────────────────────────────────────────────────────────

const PODashboard: React.FC<PODashboardProps> = ({
  electionId,
  boothId,
  electionName,
  locationLabel,
  startDate,
  endDate,
}) => {
  const navigate = useNavigate();

  // Voter list
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [search, setSearch] = useState('');

  // OTP state: { [voeId]: { loading, otp } }
  const [otpMap, setOtpMap] = useState<
    Record<number, { loading: boolean; otp: string | null }>
  >({});

  // ── Fetch voters ────────────────────────────────────────────────────────────
  const fetchVoters = useCallback(async () => {
    if (!boothId || !electionId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/voter-allocation/booth/${boothId}/election/${electionId}`
      );
      if (!res.ok) throw new Error('Failed to load voters');
      setVoters(await res.json());
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load voters');
    } finally {
      setLoading(false);
    }
  }, [boothId, electionId]);

  useEffect(() => {
    fetchVoters();
  }, [fetchVoters]);

  // ── Generate OTP ─────────────────────────────────────────────────────────────
  const handleSendOtp = async (voeId: number) => {
    setOtpMap((prev) => ({ ...prev, [voeId]: { loading: true, otp: null } }));
    try {
      const res = await fetch(`${API}/voter-allocation/${voeId}/generate-otp`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'OTP generation failed');
      setOtpMap((prev) => ({ ...prev, [voeId]: { loading: false, otp: data.otp } }));
      toast.success('OTP generated');
    } catch (err: any) {
      setOtpMap((prev) => ({ ...prev, [voeId]: { loading: false, otp: null } }));
      toast.error(err.message ?? 'Failed to generate OTP');
    }
  };

  // ── Filtered voters ──────────────────────────────────────────────────────────
  const filtered = voters.filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      v.name.toLowerCase().includes(q) ||
      v.nid.toLowerCase().includes(q)
    );
  });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-muted-foreground"
          onClick={() => navigate('/homeUSER')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to My Elections
        </Button>

        <Card className="shadow-sm">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                  Polling Officer
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight">{electionName}</h1>
              {locationLabel && (
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {locationLabel}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(startDate)} — {formatDate(endDate)}
              </p>
            </div>
            <div className="bg-primary/5 border border-primary/10 rounded-lg px-4 py-3 text-right flex-shrink-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Assigned Booth</p>
              <p className="text-lg font-black text-primary">#{boothId}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Voter List Card */}
      <Card className="shadow-sm overflow-hidden">
        <div className="border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-lg">Voter List</h2>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading…' : `${voters.length} voter(s) assigned to this booth`}
            </p>
          </div>
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or NID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Spinner className="size-5" /> Loading voters…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-20" />
            <p className="font-medium">
              {search ? 'No voters match your search' : 'No voters assigned to this booth'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs font-bold uppercase tracking-wide">NID</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide">Name</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide">Phone</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide">Email</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide text-right">OTP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => {
                  const otpState = otpMap[v.id];
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.nid}</TableCell>
                      <TableCell>
                        <p className="font-semibold text-sm">{v.name}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{v.phone || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{v.email || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Debug OTP display */}
                          {otpState?.otp && (
                            <span className="font-mono text-xs bg-yellow-100 border border-yellow-400 text-yellow-800 px-2 py-0.5 rounded dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700">
                              [DEBUG] {otpState.otp}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
                            disabled={otpState?.loading}
                            onClick={() => handleSendOtp(v.id)}
                          >
                            {otpState?.loading
                              ? <Spinner className="size-3" />
                              : <Send className="h-3 w-3" />
                            }
                            {otpState?.otp ? 'Resend OTP' : 'Send OTP'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PODashboard;
