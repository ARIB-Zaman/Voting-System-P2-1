import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Plus, Trash2, ChevronDown, ChevronRight,
  Zap, MapPin, Navigation, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/auth-client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PollingCenterRow {
  poe_id: number;
  polling_center_id: number;
  name: string;
  address: string;
  voter_count?: number;
}

interface VoterAllocationTabProps {
  electionId: string | number;
  coeId: string | number;
  constituencyId: number | null;
  pollingCenters: PollingCenterRow[];
  onAllocationChanged: () => void;
}

interface AllocatedVoter {
  id: number; // voe_id
  nid: string;
  name: string;
  phone: string;
  voter_type: string;
  booth_id?: number | null;
}

interface UnallocatedVoter {
  nid: string;
  name: string;
  phone: string;
  voter_type: string;
}

interface PreviewVoter {
  nid: string;
  name: string;
  phone: string;
  distance: number; // metres from the DB function
}

const API = '/api';

const fmtDistance = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

// ── Component ─────────────────────────────────────────────────────────────────

const VoterAllocationTab: React.FC<VoterAllocationTabProps> = ({
  electionId,
  constituencyId,
  pollingCenters,
  onAllocationChanged,
}) => {
  const [expandedCenterId, setExpandedCenterId] = useState<number | null>(null);

  // Allocated voters for the currently expanded center
  const [allocatedVoters, setAllocatedVoters] = useState<AllocatedVoter[]>([]);
  const [loadingAllocated, setLoadingAllocated] = useState(false);

  // ── Remove voters ─────────────────────────────────────────────────────────
  const [removingVoeId, setRemovingVoeId] = useState<number | null>(null);
  const [removingAllCenterId, setRemovingAllCenterId] = useState<number | null>(null);

  // ── AUTO-ALLOCATE ─────────────────────────────────────────────────────────
  // Step 1: enter count  →  Step 2: show preview  →  Step 3: confirm & commit
  const [autoCount, setAutoCount] = useState<string>('50');
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoTargetCenter, setAutoTargetCenter] = useState<PollingCenterRow | null>(null);
  const [previewVoters, setPreviewVoters] = useState<PreviewVoter[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [autoCommitting, setAutoCommitting] = useState(false);

  // ── MANUAL ALLOCATE ───────────────────────────────────────────────────────
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualTargetCenter, setManualTargetCenter] = useState<PollingCenterRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UnallocatedVoter[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedNids, setSelectedNids] = useState<Set<string>>(new Set());
  const [manualAllocating, setManualAllocating] = useState(false);

  // ── Fetch allocated voters list ───────────────────────────────────────────

  const fetchAllocatedVoters = useCallback(async (centerId: number) => {
    setLoadingAllocated(true);
    try {
      const res = await apiFetch(`${API}/voter-allocation/center/${centerId}/election/${electionId}`);
      if (!res.ok) throw new Error();
      setAllocatedVoters(await res.json());
    } catch {
      toast.error('Failed to load allocated voters');
    } finally {
      setLoadingAllocated(false);
    }
  }, [electionId]);

  const toggleExpand = (center: PollingCenterRow) => {
    const cid = center.polling_center_id;
    if (expandedCenterId === cid) {
      setExpandedCenterId(null);
    } else {
      setExpandedCenterId(cid);
      fetchAllocatedVoters(cid);
    }
  };

  // ── Auto-allocate: open preview dialog ────────────────────────────────────

  const openAutoDialog = async (center: PollingCenterRow) => {
    setAutoTargetCenter(center);
    setPreviewVoters([]);
    setAutoDialogOpen(true);
    // Load preview immediately with current count
    await loadAutoPreview(center.polling_center_id, autoCount);
  };

  const loadAutoPreview = async (centerId: number, count: string) => {
    const n = parseInt(count, 10);
    if (isNaN(n) || n <= 0) return;
    setPreviewLoading(true);
    try {
      const params = new URLSearchParams({
        center_id: String(centerId),
        election_id: String(electionId),
        count: String(n),
      });
      const res = await apiFetch(`${API}/voter-allocation/auto/preview?${params}`);
      if (!res.ok) throw new Error();
      setPreviewVoters(await res.json());
    } catch {
      toast.error('Failed to fetch voter preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAutoCountChange = (val: string, centerId: number) => {
    setAutoCount(val);
    // Debounce preview reload
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) loadAutoPreview(centerId, val);
  };

  const confirmAutoAllocate = async () => {
    if (!autoTargetCenter || previewVoters.length === 0) return;
    setAutoCommitting(true);
    try {
      const res = await apiFetch(`${API}/voter-allocation/auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_id: autoTargetCenter.polling_center_id,
          election_id: electionId,
          count: parseInt(autoCount, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auto-allocation failed');

      toast.success(data.message || `${data.allocated} voter(s) allocated`);
      setAutoDialogOpen(false);
      fetchAllocatedVoters(autoTargetCenter.polling_center_id);
      onAllocationChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAutoCommitting(false);
    }
  };

  // ── Remove allocation ─────────────────────────────────────────────────────

  const handleRemoveAllocation = async (voeId: number, centerId: number) => {
    setRemovingVoeId(voeId);
    try {
      const res = await apiFetch(`${API}/voter-allocation/${voeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Voter unassigned from center');
      fetchAllocatedVoters(centerId);
      onAllocationChanged();
    } catch {
      toast.error('Failed to unassign voter');
    } finally {
      setRemovingVoeId(null);
    }
  };

  const handleRemoveAll = async (centerId: number) => {
    setRemovingAllCenterId(centerId);
    try {
      const res = await apiFetch(
        `${API}/voter-allocation/center/${centerId}/election/${electionId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(data.message || 'All voters unassigned');
      fetchAllocatedVoters(centerId);
      onAllocationChanged();
    } catch {
      toast.error('Failed to unassign all voters');
    } finally {
      setRemovingAllCenterId(null);
    }
  };

  // ── Manual allocation ─────────────────────────────────────────────────────

  const openManualDialog = (center: PollingCenterRow) => {
    setManualTargetCenter(center);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedNids(new Set());
    setManualDialogOpen(true);
  };

  useEffect(() => {
    if (!manualDialogOpen || !constituencyId) return;

    const delay = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          election_id: String(electionId),
          constituency_id: String(constituencyId),
          limit: '100',
        });
        const res = await apiFetch(`${API}/voter-allocation/search?${params}`);
        if (res.ok) setSearchResults(await res.json());
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, searchQuery ? 400 : 0);

    return () => clearTimeout(delay);
  }, [searchQuery, manualDialogOpen, constituencyId, electionId]);

  const toggleNid = (nid: string) => {
    setSelectedNids((prev) => {
      const next = new Set(prev);
      next.has(nid) ? next.delete(nid) : next.add(nid);
      return next;
    });
  };

  const toggleAllNids = () => {
    const allSelected =
      searchResults.length > 0 && searchResults.every((v) => selectedNids.has(v.nid));
    setSelectedNids(() => {
      if (allSelected) return new Set();
      return new Set(searchResults.map((v) => v.nid));
    });
  };

  const handleManualAllocate = async () => {
    if (selectedNids.size === 0 || !manualTargetCenter) return;
    setManualAllocating(true);
    try {
      const res = await apiFetch(`${API}/voter-allocation/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nids: Array.from(selectedNids),
          center_id: manualTargetCenter.polling_center_id,
          election_id: electionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Manual allocation failed');

      toast.success(`${data.allocated} voter(s) assigned to ${manualTargetCenter.name}`);
      setManualDialogOpen(false);
      // Refresh if this center is the expanded one
      if (expandedCenterId === manualTargetCenter.polling_center_id) {
        fetchAllocatedVoters(manualTargetCenter.polling_center_id);
      }
      onAllocationChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setManualAllocating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Voter Allocation</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Assign voters from this election's master list to specific polling centers.
        </p>
      </div>

      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        {pollingCenters.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No polling centers assigned</p>
            <p className="text-xs mt-1">Add polling centers first to allocate voters.</p>
          </div>
        ) : (
          <div className="divide-y">
            {pollingCenters.map((pc) => {
              const isExpanded = expandedCenterId === pc.polling_center_id;

              return (
                <div key={pc.poe_id} className="flex flex-col">
                  {/* Accordion Header */}
                  <button
                    onClick={() => toggleExpand(pc)}
                    className={`flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors text-left w-full ${
                      isExpanded ? 'bg-muted/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${(pc.voter_count ?? 0) > 0 ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
                      <div>
                        <p className="font-bold text-sm">{pc.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {pc.address}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-sm font-bold">{(pc.voter_count ?? 0).toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground ml-1">allocated</span>
                      </div>
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="px-6 py-5 bg-muted/10 border-t">
                      <div className="flex flex-col md:flex-row gap-5">

                        {/* Left: Allocation Controls */}
                        <div className="w-full md:w-60 space-y-4 flex-shrink-0">
                          {/* Auto-Allocate Card */}
                          <div className="bg-background border rounded-lg p-4 space-y-3 shadow-sm">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Zap className="h-3.5 w-3.5 text-amber-500" />
                              Auto-Allocate
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Assign the geographically nearest unallocated voters to this center.
                            </p>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                value={autoCount}
                                onChange={(e) => setAutoCount(e.target.value)}
                                min="1"
                                max="9999"
                                className="w-20 h-8 text-sm"
                                placeholder="50"
                              />
                              <Button
                                size="sm"
                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={() => openAutoDialog(pc)}
                                disabled={!constituencyId}
                              >
                                <Zap className="h-3.5 w-3.5 mr-1" />
                                Preview
                              </Button>
                            </div>
                          </div>

                          {/* Manual Allocation Card */}
                          <div className="bg-background border rounded-lg p-4 space-y-3 shadow-sm">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Search className="h-3.5 w-3.5 text-blue-500" />
                              Manual Allocation
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Search by name or NID and pick specific voters.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openManualDialog(pc)}
                              className="w-full"
                              disabled={!constituencyId}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Select Voters
                            </Button>
                          </div>
                        </div>

                        {/* Right: Allocated Voters List */}
                        <div className="flex-1 bg-background border rounded-lg shadow-sm overflow-hidden flex flex-col">
                          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                            <span className="text-sm font-bold flex items-center gap-2">
                              Allocated Voters ({allocatedVoters.length})
                              {loadingAllocated && <Spinner className="size-3.5 text-muted-foreground" />}
                            </span>
                            {allocatedVoters.length > 0 && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive px-2"
                                    disabled={removingAllCenterId === pc.polling_center_id}
                                  >
                                    {removingAllCenterId === pc.polling_center_id
                                      ? <Spinner className="size-3 mr-1" />
                                      : <Trash2 className="size-3 mr-1" />}
                                    Unassign All
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Unassign All Voters</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will detach all <strong>{allocatedVoters.length}</strong> voters from{' '}
                                      <strong>{pc.name}</strong> (they stay in the election list and can be
                                      reassigned). This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleRemoveAll(pc.polling_center_id)}
                                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                    >
                                      Unassign All
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>

                          <div className="overflow-y-auto max-h-[420px]">
                            {loadingAllocated ? (
                              <div className="flex items-center justify-center h-36">
                                <Spinner className="size-6 text-muted-foreground" />
                              </div>
                            ) : allocatedVoters.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-36 text-muted-foreground">
                                <Users className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-sm font-medium">No voters allocated</p>
                                <p className="text-xs">Use the controls on the left to add voters.</p>
                              </div>
                            ) : (
                              <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                  <TableRow>
                                    <TableHead className="text-xs font-bold uppercase py-2 h-auto px-4">NID</TableHead>
                                    <TableHead className="text-xs font-bold uppercase py-2 h-auto">Name</TableHead>
                                    <TableHead className="text-xs font-bold uppercase py-2 h-auto text-right px-4">Action</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {allocatedVoters.map((v) => (
                                    <TableRow key={v.id} className="hover:bg-muted/30 transition-colors">
                                      <TableCell className="font-mono text-xs py-2 px-4">{v.nid}</TableCell>
                                      <TableCell className="py-2">
                                        <p className="text-sm font-semibold">{v.name}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{v.voter_type}</p>
                                      </TableCell>
                                      <TableCell className="text-right py-2 px-4">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={() => handleRemoveAllocation(v.id, pc.polling_center_id)}
                                          disabled={removingVoeId === v.id}
                                          title="Unassign from center"
                                        >
                                          {removingVoeId === v.id
                                            ? <Spinner className="size-3" />
                                            : <Trash2 className="h-3.5 w-3.5" />}
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Auto-Allocate Preview Dialog ──────────────────────────────────── */}
      <Dialog open={autoDialogOpen} onOpenChange={(o) => { if (!o && !autoCommitting) setAutoDialogOpen(false); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Auto-Allocate Preview
            </DialogTitle>
            <DialogDescription>
              The system will assign the <strong>{previewVoters.length}</strong> closest unallocated voters
              to <strong>{autoTargetCenter?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {/* Count control */}
          <div className="px-6 py-3 border-b bg-muted/20 flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-medium">Voters to assign:</span>
            <Input
              type="number"
              value={autoCount}
              onChange={(e) =>
                autoTargetCenter && handleAutoCountChange(e.target.value, autoTargetCenter.polling_center_id)
              }
              min="1"
              max="9999"
              className="w-24 h-8 text-sm"
            />
            {previewLoading && <Spinner className="size-4 text-muted-foreground" />}
          </div>

          {/* Preview list */}
          <div className="flex-1 overflow-y-auto max-h-[45vh]">
            {previewLoading ? (
              <div className="flex items-center justify-center py-14 gap-3 text-muted-foreground">
                <Spinner className="size-5" />
                <span className="text-sm">Loading closest voters…</span>
              </div>
            ) : previewVoters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <Navigation className="h-8 w-8 mb-2 opacity-30" />
                <p className="font-medium text-sm">No unallocated voters found</p>
                <p className="text-xs mt-1">All voters in this election may already be assigned to a center.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase py-2 h-auto px-6">Name</TableHead>
                    <TableHead className="text-xs font-bold uppercase py-2 h-auto">NID</TableHead>
                    <TableHead className="text-xs font-bold uppercase py-2 h-auto text-right px-6">Distance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewVoters.map((v, i) => (
                    <TableRow key={v.nid} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                      <TableCell className="py-2.5 px-6">
                        <p className="text-sm font-semibold">{v.name}</p>
                        <p className="text-[10px] text-muted-foreground">{v.phone}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs py-2.5">{v.nid}</TableCell>
                      <TableCell className="text-right py-2.5 px-6">
                        <Badge variant="outline" className="text-[10px] tabular-nums font-medium">
                          <Navigation className="h-2.5 w-2.5 mr-1 text-muted-foreground" />
                          {fmtDistance(v.distance)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/10 flex items-center !justify-between">
            <span className="text-sm text-muted-foreground">
              {previewVoters.length} voter(s) will be assigned
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setAutoDialogOpen(false)} disabled={autoCommitting}>
                Cancel
              </Button>
              <Button
                onClick={confirmAutoAllocate}
                disabled={previewVoters.length === 0 || autoCommitting}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {autoCommitting
                  ? <><Spinner className="size-4 mr-1.5" />Assigning…</>
                  : <><CheckCircle2 className="h-4 w-4 mr-1.5" />Confirm &amp; Assign</>}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual Allocation Dialog ──────────────────────────────────────── */}
      <Dialog open={manualDialogOpen} onOpenChange={(o) => { if (!o) setManualDialogOpen(false); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-500" />
              Manual Voter Allocation
            </DialogTitle>
            <DialogDescription>
              Select voters from the election list (not yet assigned to any center) to add to{' '}
              <strong>{manualTargetCenter?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {/* Search bar */}
          <div className="px-6 py-3 border-b bg-muted/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, NID, or phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Select-all row */}
          {searchResults.length > 0 && (
            <div className="px-6 py-2 border-b bg-muted/20">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={searchResults.every((v) => selectedNids.has(v.nid))}
                  onCheckedChange={toggleAllNids}
                />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Select All
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {searchResults.length} voter(s)
                </span>
              </label>
            </div>
          )}

          {/* Voter list */}
          <div className="flex-1 overflow-y-auto max-h-[45vh] divide-y">
            {searching ? (
              <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                <Spinner className="size-5" />
                <span className="text-sm">Searching…</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-30" />
                <p className="font-medium text-sm">
                  {searchQuery ? 'No voters match your search' : 'No unallocated voters available'}
                </p>
                <p className="text-xs mt-1">
                  {searchQuery
                    ? 'Try a different name, NID, or phone.'
                    : 'All voters may already be assigned to a center.'}
                </p>
              </div>
            ) : (
              searchResults.map((v) => (
                <label
                  key={v.nid}
                  className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={selectedNids.has(v.nid)}
                    onCheckedChange={() => toggleNid(v.nid)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{v.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{v.nid}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 uppercase tracking-wide">
                        {v.voter_type}
                      </Badge>
                    </div>
                  </div>
                  {selectedNids.has(v.nid) && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  )}
                </label>
              ))
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/10 flex items-center !justify-between">
            <span className="text-sm text-muted-foreground">{selectedNids.size} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setManualDialogOpen(false)} disabled={manualAllocating}>
                Cancel
              </Button>
              <Button
                onClick={handleManualAllocate}
                disabled={selectedNids.size === 0 || manualAllocating}
              >
                {manualAllocating
                  ? <><Spinner className="size-4 mr-1.5" />Assigning…</>
                  : <><Plus className="h-4 w-4 mr-1.5" />Assign Selected ({selectedNids.size})</>}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VoterAllocationTab;
