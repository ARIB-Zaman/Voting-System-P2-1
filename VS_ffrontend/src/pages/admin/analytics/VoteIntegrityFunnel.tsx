import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { apiFetch } from '@/lib/auth-client';
import { ListView } from '@/components/refine-ui/views/list-view';
import { Breadcrumb } from '@/components/refine-ui/layout/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  Building2,
  Key,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  TrendingDown,
  AlertTriangle,
  Info,
  ChevronRight,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Election {
  election_id: number;
  name: string;
  status: string;
}

interface FunnelStage {
  stage: string;
  label: string;
  value: number;
  retention: number;
  dropOff: number;
  icon: string;
}

interface Meta {
  integrityGapPct: number;
  hasIntegrityAlert: boolean;
  alertMessage: string | null;
}

interface IntegrityData {
  electionId: number;
  funnel: FunnelStage[];
  meta: Meta;
}

// ── Stage config (icon, gradient colors) ──────────────────────────────────────
const STAGE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  Allocated: {
    icon: <Users className="h-5 w-5" />,
    color: '#6366f1',
    bg: 'from-indigo-500 to-violet-600',
  },
  'Booth Assigned': {
    icon: <Building2 className="h-5 w-5" />,
    color: '#0ea5e9',
    bg: 'from-sky-500 to-cyan-500',
  },
  'OTP Requested': {
    icon: <Key className="h-5 w-5" />,
    color: '#f59e0b',
    bg: 'from-amber-500 to-orange-500',
  },
  'Vote Cast': {
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: '#10b981',
    bg: 'from-emerald-500 to-teal-500',
  },
};

// Alert color for vote cast when integrity alert fires
const ALERT_COLOR = '#ef4444';

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const FunnelTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: FunnelStage }[];
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border bg-background/95 backdrop-blur shadow-2xl p-4 min-w-[180px]">
      <p className="font-bold text-sm mb-2">{d.label}</p>
      <p className="text-2xl font-black">{d.value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground mt-1">
        Retention from previous: <span className="font-semibold text-foreground">{d.retention}%</span>
      </p>
      {d.dropOff > 0 && (
        <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
          <TrendingDown className="h-3 w-3" />
          {d.dropOff.toLocaleString()} dropped off
        </p>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const VoteIntegrityFunnel: React.FC = () => {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<string>('');
  const [data, setData] = useState<IntegrityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingElections, setLoadingElections] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load elections
  useEffect(() => {
    apiFetch('/api/election')
      .then((r) => r.json())
      .then((d: Election[]) => { setElections(d); setLoadingElections(false); })
      .catch(() => setLoadingElections(false));
  }, []);

  // Load integrity data when election changes
  useEffect(() => {
    if (!selectedElection) return;
    setLoading(true);
    setError(null);
    setData(null);

    apiFetch(`/api/analytics/vote-integrity/${selectedElection}`)
      .then((r) => { if (!r.ok) throw new Error('Failed to fetch integrity data'); return r.json(); })
      .then((d: IntegrityData) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [selectedElection]);

  // Chart data — apply alert color to Vote Cast bar if alert is active
  const chartData = data?.funnel.map((stage) => ({
    ...stage,
    fill:
      data.meta.hasIntegrityAlert && stage.stage === 'Vote Cast'
        ? ALERT_COLOR
        : STAGE_CONFIG[stage.stage]?.color ?? '#6366f1',
  }));

  const maxValue = data ? Math.max(...data.funnel.map((f) => f.value)) : 0;

  return (
    <ListView>
      <Breadcrumb />

      <div className="p-6 space-y-6 animate-in fade-in duration-500">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
              }}
            >
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Vote Integrity Funnel</h1>
              <p className="text-sm text-muted-foreground">Security audit — track every vote from allocation to casting</p>
            </div>
          </div>

          <div className="w-full sm:w-72">
            {loadingElections ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading elections…
              </div>
            ) : (
              <Select value={selectedElection} onValueChange={setSelectedElection}>
                <SelectTrigger className="border-2 border-primary/20 focus:border-primary/50 rounded-xl shadow-sm h-11">
                  <SelectValue placeholder="Select an election…" />
                </SelectTrigger>
                <SelectContent>
                  {elections.map((e) => (
                    <SelectItem key={e.election_id} value={e.election_id.toString()}>
                      <span className="flex items-center gap-2">
                        {e.name}
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${e.status === 'ACTIVE' ? 'border-green-500 text-green-600' : 'border-muted-foreground/40'}`}>
                          {e.status}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* ── Integrity alert banner ────────────────────────────────────────── */}
        {data?.meta.hasIntegrityAlert && (
          <div className="flex items-start gap-4 p-4 rounded-xl border-2 border-red-500/40 bg-red-500/10 shadow-lg">
            <ShieldAlert className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="font-bold text-red-500 text-sm">Integrity Alert Detected</p>
              <p className="text-sm text-muted-foreground mt-1">{data.meta.alertMessage}</p>
              <p className="text-xs text-muted-foreground mt-1">
                The final bar is highlighted in <span className="text-red-500 font-semibold">red</span>. 
                Review kiosk logs to identify where votes were dropped.
              </p>
            </div>
          </div>
        )}

        {data && !data.meta.hasIntegrityAlert && data.funnel[3]?.value > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              System Integrity: CLEAN — All OTP-verified voters have matching vote records.
            </p>
          </div>
        )}

        {/* ── Stage cards (top summary) ─────────────────────────────────────── */}
        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data.funnel.map((stage, idx) => {
              const cfg = STAGE_CONFIG[stage.stage];
              const isAlertStage = data.meta.hasIntegrityAlert && stage.stage === 'Vote Cast';
              return (
                <Card
                  key={stage.stage}
                  className={`shadow-md border-muted/20 overflow-hidden transition-all ${isAlertStage ? 'border-red-500/40 shadow-red-500/10' : ''}`}
                >
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${isAlertStage ? 'from-red-500 to-red-600' : cfg?.bg}`}>
                        <span className="text-white">{cfg?.icon}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5">
                        Stage {idx + 1}
                      </Badge>
                    </div>
                    <p className="text-2xl font-black leading-none">{stage.value.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stage.label}</p>
                    {idx > 0 && (
                      <div className="mt-2 flex items-center gap-1">
                        <div className="flex-1 bg-muted/30 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isAlertStage ? 'bg-red-500' : ''}`}
                            style={{
                              width: `${stage.retention}%`,
                              background: isAlertStage ? undefined : cfg?.color,
                            }}
                          />
                        </div>
                        <span className={`text-[11px] font-bold ${stage.retention < 90 ? 'text-amber-500' : isAlertStage ? 'text-red-500' : 'text-emerald-500'}`}>
                          {stage.retention}%
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Bar chart funnel ──────────────────────────────────────────────── */}
        <Card className="shadow-xl border-muted/20 overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-muted/10 to-transparent border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-violet-500" />
              Funnel Visualization
              {data && (
                <Badge variant="secondary" className="ml-auto font-mono text-xs">
                  {data.funnel[0]?.value.toLocaleString()} total allocated
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 pb-4">

            {/* Loading / Error / Empty states */}
            {!selectedElection && (
              <EmptyState icon={<Info className="h-10 w-10 text-muted-foreground/30" />} message="Select an election to view the integrity funnel" />
            )}
            {loading && (
              <EmptyState icon={<Loader2 className="h-10 w-10 animate-spin text-primary" />} message="Fetching funnel data…" />
            )}
            {error && (
              <EmptyState icon={<AlertTriangle className="h-10 w-10 text-destructive" />} message={error} />
            )}

            {data && !loading && (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={chartData}
                  barCategoryGap="25%"
                  margin={{ top: 30, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted)/50)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, maxValue * 1.15]}
                  />
                  <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'hsl(var(--muted)/20)' }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={100}>
                    {chartData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(v: any) => Number(v).toLocaleString()}
                      style={{ fontSize: 12, fontWeight: 700, fill: 'hsl(var(--foreground))' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── Flow diagram with retention arrows ───────────────────────────── */}
        {data && (
          <Card className="shadow-lg border-muted/20">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                Stage-by-Stage Retention Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 pb-5">
              <div className="flex flex-col sm:flex-row items-stretch gap-0">
                {data.funnel.map((stage, idx) => {
                  const cfg = STAGE_CONFIG[stage.stage];
                  const isAlertStage = data.meta.hasIntegrityAlert && stage.stage === 'Vote Cast';
                  const isLast = idx === data.funnel.length - 1;

                  return (
                    <React.Fragment key={stage.stage}>
                      {/* Stage pill */}
                      <div className={`flex-1 flex flex-col items-center text-center p-4 rounded-xl border ${isAlertStage ? 'border-red-500/40 bg-red-500/5' : 'border-muted/30 bg-muted/5'}`}>
                        <div className={`p-3 rounded-2xl bg-gradient-to-br mb-3 ${isAlertStage ? 'from-red-500 to-red-600' : cfg?.bg}`}>
                          <span className="text-white">{cfg?.icon}</span>
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stage.label}</p>
                        <p className={`text-3xl font-black mt-1 ${isAlertStage ? 'text-red-500' : ''}`}>{stage.value.toLocaleString()}</p>
                        {idx > 0 && (
                          <div className={`mt-2 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            stage.retention >= 98 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : stage.retention >= 90 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {stage.retention}% retained
                          </div>
                        )}
                        {idx === 0 && (
                          <div className="mt-2 text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                            Baseline
                          </div>
                        )}
                        {stage.dropOff > 0 && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            <span className="text-red-500">−{stage.dropOff.toLocaleString()}</span> drop-off
                          </p>
                        )}
                      </div>

                      {/* Arrow connector */}
                      {!isLast && (
                        <div className="flex items-center justify-center px-2 py-4 sm:py-0">
                          <ChevronRight className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── How to read this ─────────────────────────────────────────────── */}
        <Card className="border-indigo-500/20 bg-indigo-50/5 shadow-md">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">How the Integrity Audit Works</p>
                <div className="text-xs text-muted-foreground mt-2 space-y-1 leading-relaxed">
                  <p>📋 <strong>Stage 1 → 2</strong>: Voters allocated but not yet placed in booths. Low booth-assignment rate = logistics gap.</p>
                  <p>🏛️ <strong>Stage 2 → 3</strong>: Booth-assigned voters who didn't reach the kiosk. Low show-up rate = absenteeism or operational issue.</p>
                  <p>🔑 <strong>Stage 3 → 4 (Critical)</strong>: OTP requested but vote not cast. Any gap {`>`} 1% fires a <span className="text-red-500 font-semibold">🚨 red alert</span> — this means the kiosk accepted a voter but the vote was never recorded. Check server logs immediately.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </ListView>
  );
};

// ── Helper ─────────────────────────────────────────────────────────────────────
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      {icon}
      <p className="text-base font-medium text-muted-foreground max-w-xs">{message}</p>
    </div>
  );
}

export default VoteIntegrityFunnel;
