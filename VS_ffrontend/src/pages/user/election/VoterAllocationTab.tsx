import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, Plus, Trash2, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';

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
}

interface UnallocatedVoter {
  nid: string;
  name: string;
  phone: string;
  voter_type: string;
}

const API = 'http://localhost:3001/api';

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

  // Auto-allocate state
  const [autoCount, setAutoCount] = useState<string>('50');
  const [autoAllocating, setAutoAllocating] = useState(false);

  // Manual allocate state
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UnallocatedVoter[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedNids, setSelectedNids] = useState<Set<string>>(new Set());
  const [manualAllocating, setManualAllocating] = useState(false);
  const [removingVoeId, setRemovingVoeId] = useState<number | null>(null);
  const [removingAllCenterId, setRemovingAllCenterId] = useState<number | null>(null);

  const fetchAllocatedVoters = useCallback(async (centerId: number) => {
    setLoadingAllocated(true);
    try {
      const res = await fetch(`${API}/voter-allocation/center/${centerId}/election/${electionId}`);
      if (!res.ok) throw new Error();
      setAllocatedVoters(await res.json());
    } catch {
      toast.error('Failed to load allocated voters');
    } finally {
      setLoadingAllocated(false);
    }
  }, [electionId]);

  const toggleExpand = (centerId: number) => {
    if (expandedCenterId === centerId) {
      setExpandedCenterId(null);
    } else {
      setExpandedCenterId(centerId);
      fetchAllocatedVoters(centerId);
    }
  };

  const handleAutoAllocate = async (centerId: number) => {
    const count = parseInt(autoCount, 10);
    if (isNaN(count) || count <= 0) {
      toast.error('Enter a valid number');
      return;
    }
    setAutoAllocating(true);
    try {
      const res = await fetch(`${API}/voter-allocation/auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ center_id: centerId, election_id: electionId, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auto-allocation failed');
      
      toast.success(data.message);
      fetchAllocatedVoters(centerId);
      onAllocationChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAutoAllocating(false);
    }
  };

  const handleRemoveAllocation = async (voeId: number, centerId: number) => {
    setRemovingVoeId(voeId);
    try {
      const res = await fetch(`${API}/voter-allocation/${voeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Voter removed from center');
      fetchAllocatedVoters(centerId);
      onAllocationChanged();
    } catch {
      toast.error('Failed to remove voter');
    } finally {
      setRemovingVoeId(null);
    }
  };

  const handleRemoveAll = async (centerId: number) => {
    setRemovingAllCenterId(centerId);
    try {
      const res = await fetch(`${API}/voter-allocation/center/${centerId}/election/${electionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(data.message || 'All voters removed');
      fetchAllocatedVoters(centerId);
      onAllocationChanged();
    } catch {
      toast.error('Failed to remove all voters');
    } finally {
      setRemovingAllCenterId(null);
    }
  };

  // ── Manual Search ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!manualDialogOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedNids(new Set());
    }
  }, [manualDialogOpen]);

  useEffect(() => {
    if (!manualDialogOpen || !constituencyId) return;
    
    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${API}/voter-allocation/search?q=${encodeURIComponent(searchQuery)}&election_id=${electionId}&constituency_id=${constituencyId}&limit=50`
        );
        if (res.ok) setSearchResults(await res.json());
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, manualDialogOpen, constituencyId, electionId]);

  const handleManualAllocate = async () => {
    if (selectedNids.size === 0 || !expandedCenterId) return;
    setManualAllocating(true);
    try {
      const res = await fetch(`${API}/voter-allocation/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nids: Array.from(selectedNids),
          center_id: expandedCenterId,
          election_id: electionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Manual allocation failed');
      
      toast.success(`${data.allocated} voter(s) allocated`);
      setManualDialogOpen(false);
      fetchAllocatedVoters(expandedCenterId);
      onAllocationChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setManualAllocating(false);
    }
  };

  const toggleNid = (nid: string) => {
    setSelectedNids((prev) => {
      const next = new Set(prev);
      next.has(nid) ? next.delete(nid) : next.add(nid);
      return next;
    });
  };

  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Voter Allocation</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assign voters to specific polling centers within this constituency.
          </p>
        </div>
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
                    onClick={() => toggleExpand(pc.polling_center_id)}
                    className={`flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors text-left ${
                      isExpanded ? 'bg-muted/20' : ''
                    }`}
                  >
                    <div>
                      <p className="font-bold text-sm">{pc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{pc.address}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-sm font-bold">{(pc.voter_count ?? 0).toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground ml-1">allocated</span>
                      </div>
                      {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-muted/10 border-t">
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Left: Allocation Controls */}
                        <div className="w-full md:w-64 space-y-6 flex-shrink-0">
                          <div className="bg-background border rounded-lg p-4 space-y-3 shadow-sm">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Zap className="h-3.5 w-3.5 text-amber-500" /> Auto-Allocate
                            </h4>
                            <p className="text-xs text-muted-foreground">Automatically assign the nearest unallocated voters to this center.</p>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                value={autoCount}
                                onChange={(e) => setAutoCount(e.target.value)}
                                min="1"
                                className="w-20 h-8 text-sm"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAutoAllocate(pc.polling_center_id)}
                                disabled={autoAllocating || !constituencyId}
                                className="flex-1"
                              >
                                {autoAllocating ? <Spinner className="size-3.5 mr-1" /> : 'Assign'}
                              </Button>
                            </div>
                          </div>

                          <div className="bg-background border rounded-lg p-4 space-y-3 shadow-sm">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Search className="h-3.5 w-3.5 text-blue-500" /> Manual Allocation
                            </h4>
                            <p className="text-xs text-muted-foreground">Search and select specific voters from the electoral roll.</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setManualDialogOpen(true)}
                              className="w-full"
                              disabled={!constituencyId}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Select Voters
                            </Button>
                          </div>
                        </div>

                        {/* Right: Allocated Voters List */}
                        <div className="flex-1 bg-background border rounded-lg shadow-sm overflow-hidden flex flex-col min-h-[300px] max-h-[500px]">
                          <div className="px-4 py-3 border-b bg-muted/30">
                            <h4 className="text-sm font-bold flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                Allocated Voters ({allocatedVoters.length})
                                {loadingAllocated && <Spinner className="size-4 text-muted-foreground" />}
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
                                      {removingAllCenterId === pc.polling_center_id ? <Spinner className="size-3 mr-1" /> : <Trash2 className="size-3 mr-1" />}
                                      Remove All
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove All Voters</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to remove all allocated voters from <strong>{pc.name}</strong>? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleRemoveAll(pc.polling_center_id)}
                                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                      >
                                        Remove All
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </h4>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto">
                            {loadingAllocated ? (
                              <div className="flex items-center justify-center h-40">
                                <Spinner className="size-6 text-muted-foreground" />
                              </div>
                            ) : allocatedVoters.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                <Users className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-sm font-medium">No voters allocated</p>
                                <p className="text-xs">Use the controls on the left to add voters.</p>
                              </div>
                            ) : (
                              <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                  <TableRow>
                                    <TableHead className="text-xs font-bold uppercase py-2 h-auto">NID</TableHead>
                                    <TableHead className="text-xs font-bold uppercase py-2 h-auto">Name</TableHead>
                                    <TableHead className="text-xs font-bold uppercase py-2 h-auto text-right">Action</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {allocatedVoters.map((v) => (
                                    <TableRow key={v.id}>
                                      <TableCell className="font-medium text-xs py-2">{v.nid}</TableCell>
                                      <TableCell className="py-2">
                                        <p className="text-sm font-semibold">{v.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{v.voter_type}</p>
                                      </TableCell>
                                      <TableCell className="text-right py-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={() => handleRemoveAllocation(v.id, pc.polling_center_id)}
                                          disabled={removingVoeId === v.id}
                                          title="Remove allocation"
                                        >
                                          {removingVoeId === v.id ? <Spinner className="size-3" /> : <Trash2 className="h-3.5 w-3.5" />}
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

      {/* Manual Allocation Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manual Voter Allocation</DialogTitle>
            <DialogDescription>Search for unallocated voters in this constituency to add to the center.</DialogDescription>
          </DialogHeader>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, NID, or phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-y-auto -mx-6 px-6 max-h-[50vh] border-y">
            {searching ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="size-6 text-muted-foreground" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">{searchQuery ? 'No unallocated voters match search' : 'Start typing to search'}</p>
              </div>
            ) : (
              <div className="divide-y space-y-1 py-1">
                {searchResults.map((v) => (
                  <label key={v.nid} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 rounded-md transition-colors">
                    <Checkbox
                      checked={selectedNids.has(v.nid)}
                      onCheckedChange={() => toggleNid(v.nid)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{v.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{v.voter_type}</Badge>
                        <span>{v.nid}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 flex items-center !justify-between">
            <span className="text-sm text-muted-foreground">{selectedNids.size} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setManualDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleManualAllocate} disabled={selectedNids.size === 0 || manualAllocating}>
                {manualAllocating ? <Spinner className="size-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Add Selected ({selectedNids.size})
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VoterAllocationTab;
