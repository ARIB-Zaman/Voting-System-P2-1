import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Building2,
    CalendarCheck2,
    ChevronDown,
    Eye,
    MapPin,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface PollingCenter {
    center_id: number;
    center_name: string;
    address: string;
    center_status: 'OPEN' | 'FLAGGED' | 'CLOSED';
    constituency_id: number;
    constituency_name: string;
}

interface Election {
    election_id: number;
    name: string;
    status: 'PLANNED' | 'LIVE' | 'CLOSED' | 'FINALIZED';
    start_date: string;
    end_date: string;
    centers: PollingCenter[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

const electionStatusConfig: Record<string, { label: string; className: string }> = {
    LIVE: {
        label: 'Active',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    },
    PLANNED: {
        label: 'Scheduled',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    },
    CLOSED: {
        label: 'Closed',
        className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    },
    FINALIZED: {
        label: 'Finalized',
        className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    },
};

const centerStatusConfig: Record<string, { label: string; className: string }> = {
    OPEN: {
        label: 'Open',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    FLAGGED: {
        label: 'Flagged',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    },
    CLOSED: {
        label: 'Closed',
        className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    },
};

// ── Component ─────────────────────────────────────────────────────────────────

const ProDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [elections, setElections] = useState<Election[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        fetch('http://localhost:3001/api/pro/elections', { credentials: 'include' })
            .then((r) => {
                if (!r.ok) throw new Error('Failed to load elections');
                return r.json();
            })
            .then((data: Election[]) => {
                setElections(data);
                // Auto-expand if there's only one election
                if (data.length === 1) setExpandedIds(new Set([data[0].election_id]));
            })
            .catch((e) => setError(e.message));
    }, []);

    const toggleExpanded = (id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <header className="mb-8">
                <h2 className="text-3xl font-black tracking-tight">
                    PRO Dashboard
                </h2>
                <p className="text-muted-foreground mt-1">
                    Presiding Officer — your assigned polling centers and elections.
                </p>
            </header>

            {/* Error */}
            {error && (
                <pre className="text-destructive text-sm mb-4 p-3 bg-destructive/10 rounded-lg">
                    {error}
                </pre>
            )}

            {/* Loading */}
            {!elections && !error && (
                <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
                    <Spinner className="size-5" />
                    Loading elections…
                </div>
            )}

            {/* Election Cards */}
            {elections && (
                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        My Elections
                    </h3>

                    {elections.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <div className="flex flex-col items-center gap-2">
                                    <CalendarCheck2 className="h-8 w-8 opacity-40" />
                                    <p className="font-medium">No elections assigned</p>
                                    <p className="text-xs">
                                        You'll appear here once an RO assigns you as the
                                        presiding officer of a polling center.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        elections.map((election) => {
                            const cfg = electionStatusConfig[election.status] ?? electionStatusConfig.CLOSED;
                            const isExpanded = expandedIds.has(election.election_id);
                            const isLive = election.status === 'LIVE';

                            return (
                                <Collapsible
                                    key={election.election_id}
                                    open={isExpanded}
                                    onOpenChange={() => toggleExpanded(election.election_id)}
                                >
                                    <Card
                                        className={`transition-all ${isLive
                                            ? 'border-blue-300 dark:border-blue-700 shadow-md shadow-blue-100/50 dark:shadow-blue-900/20'
                                            : ''
                                            }`}
                                    >
                                        {/* Election header row */}
                                        <CollapsibleTrigger asChild>
                                            <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors p-5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="text-sm font-bold truncate">
                                                                    {election.name}
                                                                </h4>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`border-0 text-[10px] font-bold rounded-full px-2 py-0 uppercase tracking-tight flex-shrink-0 ${cfg.className}`}
                                                                >
                                                                    {cfg.label}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                {formatDate(election.start_date)} — {formatDate(election.end_date)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 flex-shrink-0">
                                                        <Badge variant="secondary" className="text-xs">
                                                            {election.centers.length}{' '}
                                                            center{election.centers.length !== 1 ? 's' : ''}
                                                        </Badge>
                                                        <ChevronDown
                                                            className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                        />
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </CollapsibleTrigger>

                                        {/* Expanded center list */}
                                        <CollapsibleContent>
                                            <CardContent className="px-5 pb-4 pt-0">
                                                <div className="border rounded-lg overflow-hidden">
                                                    {election.centers.map((center, idx) => {
                                                        const cCfg = centerStatusConfig[center.center_status] ?? centerStatusConfig.CLOSED;
                                                        return (
                                                            <div
                                                                key={center.center_id}
                                                                className={`flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors ${idx !== 0 ? 'border-t' : ''}`}
                                                            >
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                                                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <p className="text-sm font-medium truncate">
                                                                                {center.center_name}
                                                                            </p>
                                                                            <Badge
                                                                                variant="outline"
                                                                                className={`border-0 text-[10px] font-bold rounded-full px-2 py-0 uppercase tracking-tight flex-shrink-0 ${cCfg.className}`}
                                                                            >
                                                                                {cCfg.label}
                                                                            </Badge>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                                                            <MapPin className="h-3 w-3 shrink-0" />
                                                                            <span className="truncate">
                                                                                {center.constituency_name} · {center.address}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="flex-shrink-0 text-primary hover:text-primary/80 font-medium"
                                                                    onClick={() =>
                                                                        navigate(`/homePRO/polling-center/${center.center_id}`)
                                                                    }
                                                                >
                                                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                                                    View Details
                                                                </Button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </CardContent>
                                        </CollapsibleContent>
                                    </Card>
                                </Collapsible>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default ProDashboard;
