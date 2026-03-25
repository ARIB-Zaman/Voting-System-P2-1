import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Label, Pie, PieChart, Sector } from 'recharts';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  Landmark,
  MapPin,
  Medal,
  PartyPopper,
  Trophy,
  Users,
} from 'lucide-react';

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

interface PartySeat {
  party_name: string;
  seat_count: number;
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

// Vivid palette cycling through chart css vars then explicit colours
const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  '#a855f7',
  '#ec4899',
  '#f97316',
  '#14b8a6',
];

// ── Component ────────────────────────────────────────────────────────────────

const FinalizedElection: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [election, setElection] = useState<Election | null>(null);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [partySeats, setPartySeats] = useState<PartySeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active pie slice (index into partySeats)
  const [activeIndex, setActiveIndex] = useState(0);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [elecRes, coeRes, seatsRes] = await Promise.all([
        fetch(`${API}/election/${id}`),
        fetch(`${API}/constituency_of_election/election/${id}`),
        fetch(`${API}/election/${id}/party-seats`),
      ]);
      if (!elecRes.ok) throw new Error('Failed to fetch election');
      if (!coeRes.ok) throw new Error('Failed to fetch constituencies');
      if (!seatsRes.ok) throw new Error('Failed to fetch party seats');

      const [elecData, coeData, seatsData] = await Promise.all([
        elecRes.json(),
        coeRes.json(),
        seatsRes.json(),
      ]);
      setElection(elecData);
      setConstituencies(coeData);
      setPartySeats(seatsData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived winner logic ──────────────────────────────────────────────────
  const totalSeats = constituencies.length;

  const winnerParty = useMemo<PartySeat | null>(() => {
    if (partySeats.length === 0 || totalSeats === 0) return null;
    const top = partySeats[0]; // already ordered by seat_count DESC
    // Must have most seats AND >= 50%
    if (top.seat_count >= Math.ceil(totalSeats / 2)) return top;
    return null;
  }, [partySeats, totalSeats]);

  // ── Pie chart data ────────────────────────────────────────────────────────
  const pieChartData = partySeats.map((p, i) => ({
    party: p.party_name,
    seats: Number(p.seat_count),
    fill: PALETTE[i % PALETTE.length],
  }));

  const pieConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = { seats: { label: 'Seats' } };
    partySeats.forEach((p, i) => {
      cfg[p.party_name] = {
        label: p.party_name,
        color: PALETTE[i % PALETTE.length],
      };
    });
    return cfg;
  }, [partySeats]);

  const chartId = 'party-seats-pie';

  // Active shape renderer for the interactive pie slice
  const renderActiveShape = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      const { outerRadius = 0, ...rest } = props;
      return (
        <g>
          <Sector {...rest} outerRadius={outerRadius + 10} />
          <Sector
            {...rest}
            outerRadius={outerRadius + 25}
            innerRadius={outerRadius + 12}
          />
        </g>
      );
    },
    [],
  );

  // ── Loading / error states ────────────────────────────────────────────────

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

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {/* Total Constituencies / Seats */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Seats</p>
            <p className="text-2xl font-bold">{totalSeats}</p>
          </div>
        </div>

        {/* Total Parties */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 flex-shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Parties Contesting</p>
            <p className="text-2xl font-bold">{partySeats.length}</p>
          </div>
        </div>

        {/* Majority threshold */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 flex-shrink-0">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Majority Threshold</p>
            <p className="text-2xl font-bold">{Math.ceil(totalSeats / 2)} seats</p>
            <p className="text-xs text-muted-foreground">≥ 50% required to win</p>
          </div>
        </div>
      </div>

      {/* ── Winner / No-winner Banner ────────────────────────────────────── */}
      {partySeats.length > 0 && (
        winnerParty ? (
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/10 border border-amber-200 dark:border-amber-700/40 rounded-xl p-6 flex items-center gap-5 shadow-sm">
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
            {partySeats[0] && (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground mb-0.5">Leading party</p>
                <p className="font-bold text-base">{partySeats[0].party_name}</p>
                <p className="text-2xl font-black text-slate-600 dark:text-slate-300">
                  {partySeats[0].seat_count}
                </p>
                <p className="text-xs text-muted-foreground">seats</p>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Party Seats: Pie Chart + Leaderboard ────────────────────────── */}
      {partySeats.length > 0 && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Parliamentary Seats by Party
            </h2>
            <Badge variant="secondary" className="text-xs">
              {totalSeats} total
            </Badge>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-0 md:gap-6 p-6">
            {/* Pie Chart */}
            <div className="w-full md:w-auto flex-shrink-0">
              
              <ChartStyle id={chartId} config={pieConfig} />
              <ChartContainer
                id={chartId}
                config={pieConfig}
                className="mx-auto aspect-square w-full max-w-[300px]"
              >
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, name) => (
                          <span className="font-bold">
                            {name}: {Number(value)} seat{Number(value) !== 1 ? 's' : ''}
                          </span>
                        )}
                      />
                    }
                  />
                  <Pie
                    data={pieChartData}
                    dataKey="seats"
                    nameKey="party"
                    innerRadius={70}
                    strokeWidth={4}
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onClick={(_data, index) => setActiveIndex(index)}
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                          const active = pieChartData[activeIndex];
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
                                {active?.seats ?? 0}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 22}
                                className="fill-muted-foreground text-xs"
                              >
                                {active ? 'seats' : ''}
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>

            {/* Party leaderboard */}
            <div className="flex-1 w-full space-y-3">
              {partySeats.map((p, i) => {
                const pct = totalSeats === 0 ? 0 : Math.round((Number(p.seat_count) / totalSeats) * 100);
                const isWinner = winnerParty?.party_name === p.party_name;
                return (
                  <button
                    key={p.party_name}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={`w-full text-left rounded-lg p-3 transition-all border ${
                      activeIndex === i
                        ? 'border-border bg-muted/60 shadow-sm'
                        : 'border-transparent hover:bg-muted/40'
                    }`}
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
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
                      title="View constituency details"
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
