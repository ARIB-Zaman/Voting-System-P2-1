import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ShowButton } from '@/components/refine-ui/buttons/show';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CalendarCheck2, CheckCircle2, ClipboardList, PlusCircle, Search } from 'lucide-react';
import { CreateButton } from '@/components/refine-ui/buttons/create';

// ─── Types ──────────────────────────────────────────────────────────────────

type ElectionStatus = 'PLANNED' | 'LIVE' | 'CLOSED' | 'FINALIZED';

interface Election {
  election_id: string | number;
  name: string;
  status: ElectionStatus;
  start_date: string;
  end_date: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

type TabKey = 'all' | 'active' | 'scheduled' | 'completed';

/** Maps API status → display tab category */
const statusToTab = (s: ElectionStatus): TabKey => {
  if (s === 'LIVE') return 'active';
  if (s === 'PLANNED') return 'scheduled';
  if (s === 'CLOSED' || s === 'FINALIZED') return 'completed';
  return 'all';
};

const statusConfig: Record<
  ElectionStatus,
  { label: string; className: string }
> = {
  LIVE: {
    label: 'Active',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase tracking-tight',
  },
  PLANNED: {
    label: 'Scheduled',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 uppercase tracking-tight',
  },
  CLOSED: {
    label: 'Completed',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-tight',
  },
  FINALIZED: {
    label: 'Completed',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-tight',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

const Dashboard = () => {
  const [data, setData] = useState<Election[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch('http://localhost:3001/api/election')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message));
  }, []);

  // ── Derived stat counts ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!data) return { active: 0, completed: 0, scheduled: 0 };
    return {
      active: data.filter((e) => e.status === 'LIVE').length,
      completed: data.filter(
        (e) => e.status === 'CLOSED' || e.status === 'FINALIZED'
      ).length,
      scheduled: data.filter((e) => e.status === 'PLANNED').length,
    };
  }, [data]);

  // ── Filtered + searched list ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((e) => {
      const matchesTab =
        activeTab === 'all' || statusToTab(e.status) === activeTab;
      const matchesSearch = e.name
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [data, activeTab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  // Reset page on tab/search change
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
  };
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'All Elections' },
    { key: 'active', label: 'Active' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Elections</h2>
          <p className="text-muted-foreground mt-1">
            Manage and monitor all active and historical voting sessions.
          </p>
        </div>
        <CreateButton>
          <PlusCircle className="h-5 w-5" />
          Create New Election
        </CreateButton>
      </header>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Active */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active Elections</p>
            {data ? (
              <p className="text-2xl font-bold">{stats.active}</p>
            ) : (
              <Spinner className="size-5 mt-1" />
            )}
          </div>
        </div>

        {/* Completed */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Completed</p>
            {data ? (
              <p className="text-2xl font-bold">{stats.completed}</p>
            ) : (
              <Spinner className="size-5 mt-1" />
            )}
          </div>
        </div>

        {/* Scheduled */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 flex-shrink-0">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Scheduled</p>
            {data ? (
              <p className="text-2xl font-bold">{stats.scheduled}</p>
            ) : (
              <Spinner className="size-5 mt-1" />
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs & Search ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b mb-6 gap-4">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`pb-4 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative pb-4 md:pb-0 w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search elections..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <pre className="text-destructive text-sm mb-4 p-3 bg-destructive/10 rounded-lg">
          {error}
        </pre>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {!data && !error && (
        <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
          <Spinner className="size-5" />
          Loading elections…
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {data && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  Election Title
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  Date Range
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No elections found.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((election) => {
                  const cfg = statusConfig[election.status];
                  return (
                    <TableRow
                      key={election.election_id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      {/* Title */}
                      <TableCell className="px-6 py-5">
                        <p className="text-sm font-bold">{election.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {election.status.toLowerCase()}
                        </p>
                      </TableCell>

                      {/* Status badge */}
                      <TableCell className="px-6 py-5">
                        <Badge
                          variant="outline"
                          className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 ${cfg.className}`}
                        >
                          {cfg.label}
                        </Badge>
                      </TableCell>

                      {/* Date Range */}
                      <TableCell className="px-6 py-5 text-sm text-muted-foreground">
                        {formatDate(election.start_date)} — {formatDate(election.end_date)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-6 py-5 text-right">
                        <ShowButton
                          resource="election"
                          recordItemId={election.election_id}
                          variant="ghost"
                          className="text-primary font-bold hover:text-primary/80 h-auto p-0"
                        >
                          View Details
                        </ShowButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* ── Pagination ───────────────────────────────────────────────── */}
          <div className="px-6 py-4 bg-muted/30 flex items-center justify-between border-t">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} elections
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ›
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;