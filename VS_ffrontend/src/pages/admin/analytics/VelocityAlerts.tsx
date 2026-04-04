import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/auth-client';
import { ListView } from '@/components/refine-ui/views/list-view';
import { Breadcrumb } from '@/components/refine-ui/layout/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  AlertTriangle, 
  Activity, 
  Timer,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Info 
} from 'lucide-react';

interface Election {
  election_id: number;
  name: string;
  status: string;
}

interface Alert {
  center_name: string;
  booth_name: string;
  vote_count: number;
  time_window: string;
  severity: 'WARNING' | 'CRITICAL';
}

interface VelocityData {
  electionId: number;
  alerts: Alert[];
  error?: string;
}

const VelocityAlerts: React.FC = () => {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<string>('');
  const [data, setData] = useState<VelocityData | null>(null);
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

  // Use an interval to fake real-time updates / poll the server
  useEffect(() => {
    if (!selectedElection) return;
    
    const fetchAlerts = () => {
      setLoading(true);
      setError(null);

      apiFetch(`/api/analytics/velocity-alerts/${selectedElection}`)
        .then((r) => { if (!r.ok) throw new Error('Failed to fetch security alerts'); return r.json(); })
        .then((d: VelocityData) => { 
          if (d.error) setError(d.error);
          else setData(d);
          setLoading(false); 
        })
        .catch((e) => { setError(e.message); setLoading(false); });
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000); // poll every 15s

    return () => clearInterval(interval);
  }, [selectedElection]);

  const activeAlertsCount = data?.alerts?.length || 0;
  const criticalAlertsCount = data?.alerts?.filter(a => a.severity === 'CRITICAL').length || 0;

  return (
    <ListView>
      <Breadcrumb />

      <div className="p-6 space-y-6 animate-in fade-in duration-500">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-red-600 to-rose-600 shadow-lg shadow-red-500/30">
              <ShieldAlert className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Impossible Velocity Alerts</h1>
              <p className="text-sm text-muted-foreground">Security Command Center — Real-time ballot stuffing detection</p>
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
                  <SelectValue placeholder="Monitoring Target..." />
                </SelectTrigger>
                <SelectContent>
                  {elections.map((e) => (
                    <SelectItem key={e.election_id} value={e.election_id.toString()}>
                      <span className="flex items-center gap-2">
                         {e.name}
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${e.status === 'ACTIVE' || e.status === 'LIVE' ? 'border-red-500 text-red-600 animate-pulse' : 'border-muted-foreground/40'}`}>
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

        {/* ── Status Banner ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {/* Terminal Active Status */}
           <Card className="bg-slate-950 text-slate-50 border-slate-800 shadow-xl overflow-hidden relative">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <Activity className="h-16 w-16" />
             </div>
             <CardContent className="pt-6 relative z-10 flex flex-col justify-between h-full">
               <p className="text-xs font-mono text-slate-400 mb-2 uppercase tracking-widest">System Status</p>
               <div>
                  <p className="text-2xl font-black text-emerald-400 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    Monitoring Live
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">Max Threshold: 2 votes / 60s</p>
               </div>
             </CardContent>
           </Card>

           {/* Warnings */}
           <Card className="border-amber-500/30 bg-amber-500/5">
             <CardContent className="pt-6">
               <p className="text-xs font-bold text-amber-600/80 mb-2 uppercase tracking-widest flex items-center gap-2">
                 <AlertTriangle className="h-3.5 w-3.5" /> High Velocity
               </p>
               <p className="text-3xl font-black text-amber-600">{activeAlertsCount - criticalAlertsCount}</p>
               <p className="text-xs text-muted-foreground mt-1">Warnings (&gt; 2 votes/min)</p>
             </CardContent>
           </Card>

           {/* Critical */}
           <Card className="border-red-500/30 bg-red-500/5 shadow-red-500/10">
             <CardContent className="pt-6">
               <p className="text-xs font-bold text-red-600/80 mb-2 uppercase tracking-widest flex items-center gap-2">
                 <ShieldAlert className="h-3.5 w-3.5" /> Impossible Velocity
               </p>
               <p className="text-3xl font-black text-red-600">{criticalAlertsCount}</p>
               <p className="text-xs text-muted-foreground mt-1">Critical (&ge; 10 votes/min)</p>
             </CardContent>
           </Card>
        </div>

        {/* ── Main Data View ────────────────────────────────────────────────── */}
        <Card className="border-muted/20 shadow-xl overflow-hidden mt-6">
          <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between pb-3">
             <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Timer className="h-4 w-4" /> Detected Anomalies Log
             </CardTitle>
             {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent className="p-0">
            {error ? (
              <div className="p-12 text-center flex flex-col items-center">
                <AlertTriangle className="h-10 w-10 text-amber-500 opacity-50 mb-3" />
                <p className="text-sm font-medium text-amber-600">{error}</p>
                <p className="text-xs text-muted-foreground mt-1">Check Schema Migrations.</p>
              </div>
            ) : !selectedElection ? (
              <div className="p-16 text-center text-muted-foreground">
                 <Info className="h-10 w-10 mx-auto opacity-20 mb-3" />
                 <p className="text-sm font-medium">Select an election to view security alerts.</p>
              </div>
            ) : data?.alerts?.length === 0 ? (
              <div className="p-16 text-center">
                 <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                   <ShieldCheck className="h-8 w-8 text-emerald-600" />
                 </div>
                 <p className="text-lg font-bold text-emerald-600">No Security Threats Detected</p>
                 <p className="text-sm text-muted-foreground mt-1">All booths are operating within normal volume parameters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                       <TableHead className="w-[180px] font-mono text-xs">Timestamp (Minute)</TableHead>
                       <TableHead className="font-mono text-xs">Polling Center</TableHead>
                       <TableHead className="font-mono text-xs">Booth</TableHead>
                       <TableHead className="font-mono text-xs">Expected Velocity</TableHead>
                       <TableHead className="font-mono text-xs">Detected Velocity</TableHead>
                       <TableHead className="text-right font-mono text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.alerts.map((alert, idx) => {
                       const isCritical = alert.severity === 'CRITICAL';
                       const expected = '1-2 votes';
                       
                       return (
                         <TableRow 
                           key={idx} 
                           className={`transition-colors ${isCritical ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/30' : 'hover:bg-amber-50/50 dark:hover:bg-amber-950/20'}`}
                           // Add CSS animation directly
                           style={isCritical ? {
                              animation: 'pulse-bg 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                           } : {}}
                         >
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {new Date(alert.time_window).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell className="font-bold text-sm">
                              {alert.center_name}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {alert.booth_name}
                            </TableCell>
                            <TableCell className="text-sm">
                              <Badge variant="outline" className="text-[10px] font-mono bg-background">
                                {expected} / min
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={`text-lg font-black ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>
                                  {alert.vote_count} votes
                                </span>
                                <span className="text-xs text-muted-foreground">/ min</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {isCritical ? (
                                <Badge className="bg-red-600 hover:bg-red-600 text-white font-black animate-pulse border-none">CRITICAL</Badge>
                              ) : (
                                <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-bold border-none">WARNING</Badge>
                              )}
                            </TableCell>
                         </TableRow>
                       );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global Keyframes for the Flash Effect */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse-bg {
            0%, 100% { background-color: rgba(239, 68, 68, 0.05); }
            50% { background-color: rgba(239, 68, 68, 0.15); }
          }
        `}} />

      </div>
    </ListView>
  );
};

export default VelocityAlerts;
