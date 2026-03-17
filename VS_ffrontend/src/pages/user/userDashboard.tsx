import React, { useEffect, useMemo, useState } from 'react';
import { useGetIdentity } from '@refinedev/core';
import { useNavigate } from 'react-router';
import {
  CalendarCheck2,
  ClipboardCheck,
  ArrowRight,
  MapPin,
  CalendarDays,
  UserCheck,
  Inbox,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

type ElectionStatus = 'LIVE' | 'PLANNED';
type ElectionRole = 'RO' | 'PRO' | 'PO';

interface Assignment {
  election_id: string | number;
  election_name: string;
  status: ElectionStatus;
  start_date: string;
  end_date: string;
  role: ElectionRole;
  location_label: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** Human-readable role labels */
const roleLabel: Record<ElectionRole, string> = {
  RO: 'Returning Officer',
  PRO: 'Presiding Officer',
  PO: 'Polling Officer',
};

/** Role badge colour sets (background + text) */
const roleBadgeClass: Record<ElectionRole, string> = {
  RO: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  PRO: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  PO: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

/** Icon per role for the card illustration */
const roleIllustrationClass: Record<ElectionRole, string> = {
  RO: 'text-indigo-400/60',
  PRO: 'text-violet-400/60',
  PO: 'text-teal-400/60',
};
const roleGradientClass: Record<ElectionRole, string> = {
  RO: 'from-indigo-500/15 to-indigo-500/5',
  PRO: 'from-violet-500/15 to-violet-500/5',
  PO: 'from-teal-500/15 to-teal-500/5',
};

// ─── Component ────────────────────────────────────────────────────────────────

const UserDashboard: React.FC = () => {
  const { data: identity } = useGetIdentity<{ id: string; name?: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identity?.id) return;
    fetch(`http://localhost:3001/api/users/my-elections?userId=${identity.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch elections');
        return res.json() as Promise<Assignment[]>;
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [identity?.id]);

  const { live, planned } = useMemo(() => {
    if (!data) return { live: [], planned: [] };
    return {
      live: data.filter((a) => a.status === 'LIVE'),
      planned: data.filter((a) => a.status === 'PLANNED'),
    };
  }, [data]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!data && !error) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3 text-muted-foreground">
        <Spinner className="size-5" /> Loading your elections…
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">My Elections</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, <strong>{identity?.name ?? 'officer'}</strong>. Here are your active and upcoming assignments.
        </p>
      </header>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        {[
          {
            icon: <ClipboardCheck className="h-5 w-5" />,
            label: 'Active Assignments',
            value: live.length,
            color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
          },
          {
            icon: <CalendarCheck2 className="h-5 w-5" />,
            label: 'Upcoming Events',
            value: planned.length,
            color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
          },
          {
            icon: <UserCheck className="h-5 w-5" />,
            label: 'Total Assigned',
            value: data?.length ?? 0,
            color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
          },
        ].map((s) => (
          <div key={s.label} className="bg-card border rounded-xl p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{s.label}</p>
              {data ? (
                <p className="text-2xl font-bold">{String(s.value).padStart(2, '0')}</p>
              ) : (
                <Spinner className="size-4 mt-1" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Active elections ───────────────────────────────────────────────── */}
      {live.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <h2 className="text-xl font-bold">Active Elections</h2>
          </div>

          <div className="space-y-4">
            {live.map((a) => (
              <div
                key={a.election_id}
                className="bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Illustration panel */}
                  <div className="md:w-1/4 bg-muted h-36 md:h-auto relative overflow-hidden flex-shrink-0">
                    <div className={`absolute inset-0 bg-gradient-to-br ${roleGradientClass[a.role]}`} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ClipboardCheck className={`h-14 w-14 ${roleIllustrationClass[a.role]}`} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h3 className="text-base font-bold">{a.election_name}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Live Now
                        </span>
                      </div>

                      <div className="space-y-1.5 mb-4">
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <UserCheck className="h-3.5 w-3.5" />
                          Role:{' '}
                          <Badge
                            variant="outline"
                            className={`border-0 text-xs font-semibold ml-0.5 ${roleBadgeClass[a.role]}`}
                          >
                            {roleLabel[a.role]}
                          </Badge>
                        </p>
                        {a.location_label && (
                          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            {a.location_label}
                          </p>
                        )}
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(a.start_date)} — {formatDate(a.end_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-3 border-t">
                      <Button
                        size="sm"
                        className="gap-1.5 font-bold"
                        onClick={() => navigate(`/homeUSER/election/${a.election_id}`)}
                      >
                        Enter Dashboard
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Upcoming elections ─────────────────────────────────────────────── */}
      {planned.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <h2 className="text-xl font-bold">Upcoming Assignments</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {planned.map((a) => (
              <div
                key={a.election_id}
                className="bg-card border rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mb-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 flex-shrink-0">
                      <CalendarCheck2 className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground pt-1">
                      {formatDate(a.start_date)}
                    </span>
                  </div>
                  <h3 className="font-bold mb-1">{a.election_name}</h3>
                  <p className="text-sm text-muted-foreground mb-1">
                    Role:{' '}
                    <span className={`ml-1 text-xs font-semibold px-1.5 py-0.5 rounded-full ${roleBadgeClass[a.role]}`}>
                      {roleLabel[a.role]}
                    </span>
                  </p>
                  {a.location_label && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" /> {a.location_label}
                    </p>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 font-bold border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  onClick={() => navigate(`/homeUSER/election/${a.election_id}`)}
                >
                  View Details
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {data && live.length === 0 && planned.length === 0 && (
        <div className="bg-card border rounded-xl p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-lg mb-1">No Active Assignments</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            You are not currently assigned to any active or upcoming elections. Please contact your administrator.
          </p>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
