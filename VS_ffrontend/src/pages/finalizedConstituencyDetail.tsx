import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeft, MapPin, Medal, TrendingUp, Users, Vote } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Candidate {
  candidate_id: number;
  name: string;
  party: string;
  votes: number;
}

interface TimelinePoint {
  hour: string;
  votes: number;
}

interface DetailData {
  coe_id: number;
  name: string;
  region: string;
  total_voters: number;
  votes_cast: number;
  winner: Candidate | null;
  candidates: Candidate[];
  timeline: TimelinePoint[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const API = 'http://localhost:3001/api';

const turnoutPct = (cast: number, total: number) =>
  total === 0 ? 0 : Math.round((cast / total) * 1000) / 10;

const formatHour = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

// Distinct chart colours for up to ~8 candidates
const PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

// ── Component ────────────────────────────────────────────────────────────────

const FinalizedConstituencyDetail: React.FC = () => {
  const { id, cId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id || !cId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/election/${id}/constituency/${cId}/results`);
      if (!res.ok) throw new Error('Failed to fetch constituency results');
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, cId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <p className="text-destructive">{error ?? 'Not found'}</p>
      </div>
    );
  }

  const turnout = turnoutPct(data.votes_cast, data.total_voters);

  // ── Chart configs ─────────────────────────────────────────────────────────

  // Bar chart: one key per candidate, config maps key → label + color
  const barChartData = data.candidates.map((c) => ({
    candidate: c.name,
    votes: c.votes,
    party: c.party,
  }));

  const barConfig: ChartConfig = {
    votes: { label: 'Votes', color: PALETTE[0] },
  };

  // Line chart data
  const lineChartData = data.timeline.map((t) => ({
    hour: formatHour(t.hour),
    votes: t.votes,
  }));

  const lineConfig: ChartConfig = {
    votes: { label: 'Votes Cast', color: '#6366f1' },
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* ── Back + Header ───────────────────────────────────────────────── */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 text-muted-foreground -ml-2"
          onClick={() => navigate(`/homeAdmin/finalizedElection/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Election
        </Button>

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-black tracking-tight">{data.name}</h1>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {data.region}
          </div>
          <Badge
            variant="outline"
            className="border-0 text-xs font-bold rounded-full px-2.5 py-0.5 uppercase tracking-tight bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          >
            Finalized
          </Badge>
        </div>
      </div>

      {/* ── Winner Card ─────────────────────────────────────────────────── */}
      {data.winner && (
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-6 flex items-center gap-5 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
            <Medal className="h-8 w-8" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
              Winner
            </p>
            <p className="text-2xl font-black tracking-tight truncate">{data.winner.name}</p>
            <p className="text-sm text-muted-foreground">{data.winner.party}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {data.winner.votes.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">votes</p>
          </div>
        </div>
      )}

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Registered Voters</p>
            <p className="text-2xl font-bold">{data.total_voters.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 flex-shrink-0">
            <Vote className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Votes Cast</p>
            <p className="text-2xl font-bold">{data.votes_cast.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Participation Rate</p>
            <p className="text-2xl font-bold">{turnout}%</p>
          </div>
        </div>
      </div>

      {/* ── Bar Chart: Votes per Candidate ──────────────────────────────── */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Candidate Vote Breakdown
          </h2>
        </div>
        <div className="p-6">
          {data.candidates.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No candidate data available.</p>
          ) : (
            <ChartContainer config={barConfig} className="min-h-[280px] w-full">
              <BarChart
                data={barChartData}
                margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="candidate"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={40} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, props) => [
                        <span key="v" className="font-bold">{Number(value).toLocaleString()} votes</span>,
                        <span key="p" className="text-muted-foreground ml-1">{props.payload?.party}</span>,
                      ]}
                      hideLabel
                    />
                  }
                />
                <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                  {barChartData.map((_entry, index) => (
                    <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                  <LabelList
                    dataKey="votes"
                    position="top"
                    style={{ fontSize: 11, fontWeight: 700 }}
                    formatter={(v: number) => v.toLocaleString()}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </div>
        {/* Candidate legend */}
        {data.candidates.length > 0 && (
          <div className="px-6 pb-5 flex flex-wrap gap-3">
            {data.candidates.map((c, i) => (
              <div key={c.candidate_id} className="flex items-center gap-2 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">— {c.party}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Line Chart: Votes Over Time ─────────────────────────────────── */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Voter Turnout Over Time (Per Hour)
          </h2>
        </div>
        <div className="p-6">
          {lineChartData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No timeline data available.</p>
          ) : (
            <ChartContainer config={lineConfig} className="min-h-[240px] w-full">
              <LineChart
                data={lineChartData}
                margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={40}
                  allowDecimals={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={(label) => `${label}`}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="votes"
                  stroke="var(--color-votes)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--color-votes)', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinalizedConstituencyDetail;
