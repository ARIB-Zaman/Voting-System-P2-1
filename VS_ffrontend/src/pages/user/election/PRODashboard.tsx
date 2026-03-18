import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  MapPin,
  Pencil,
  Plus,
  Search,
  Shuffle,
  Trash2,
  UserPlus,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PRODashboardProps {
  electionId: string | number;
  electionName: string;
  locationLabel: string | null;
  startDate: string;
  endDate: string;
  /** PK of polling_center_of_election */
  poeId: string | number;
  /** Physical polling_center.id */
  pollingCenterId: number;
}

interface Booth {
  id: number;
  booth_number: number;
  officers: Officer[];
}

interface Officer {
  role_map_id: number;
  user_id: string;
  user_name: string;
}

interface AssignableUser {
  id: string;
  name: string;
}

interface BoothVoter {
  id: number; // voe_id
  nid: string;
  name: string;
  phone: string;
  voter_type: string;
}

type TabKey = 'polling-booths' | 'voter-allocation';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const API = 'http://localhost:3001/api';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

// ─── Add Officer Popover ───────────────────────────────────────────────────────

const AddOfficerPopover: React.FC<{
  users: AssignableUser[];
  onSelect: (userId: string) => void;
}> = ({ users, onSelect }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          Add Officer
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search users…" />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.name}
                  onSelect={() => {
                    onSelect(u.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                      {getInitials(u.name)}
                    </div>
                    {u.name}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// ─── Booth Voter Allocation Tab ────────────────────────────────────────────────

const BoothVoterAllocationTab: React.FC<{
  electionId: string | number;
  pollingCenterId: number;
  booths: Booth[];
  onDistributed: () => void;
}> = ({ electionId, pollingCenterId, booths, onDistributed }) => {
  const [expandedBoothId, setExpandedBoothId] = useState<number | null>(null);
  const [boothVoters, setBoothVoters] = useState<BoothVoter[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [removingVoeId, setRemovingVoeId] = useState<number | null>(null);

  // Manual assign dialog
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualTargetBoothId, setManualTargetBoothId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BoothVoter[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedVoeIds, setSelectedVoeIds] = useState<Set<number>>(new Set());
  const [manualAssigning, setManualAssigning] = useState(false);

  // ── Fetch voters for expanded booth ─────────────────────────────────────────
  const fetchBoothVoters = useCallback(
    async (boothId: number) => {
      setLoadingVoters(true);
      try {
        const res = await fetch(
          `${API}/voter-allocation/booth/${boothId}/election/${electionId}`
        );
        if (!res.ok) throw new Error();
        setBoothVoters(await res.json());
      } catch {
        toast.error('Failed to load booth voters');
      } finally {
        setLoadingVoters(false);
      }
    },
    [electionId]
  );

  const toggleExpand = (boothId: number) => {
    if (expandedBoothId === boothId) {
      setExpandedBoothId(null);
      setBoothVoters([]);
    } else {
      setExpandedBoothId(boothId);
      fetchBoothVoters(boothId);
    }
  };

  // ── Auto Distribute ──────────────────────────────────────────────────────────
  const handleDistribute = async () => {
    setDistributing(true);
    try {
      const res = await fetch(
        `${API}/voter-allocation/center/${pollingCenterId}/election/${electionId}/distribute`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Distribution failed');
      toast.success(data.message);
      onDistributed();
      if (expandedBoothId !== null) fetchBoothVoters(expandedBoothId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDistributing(false);
    }
  };

  // ── Remove voter from booth (unassign booth_id) ──────────────────────────────
  const handleUnassignVoter = async (voeId: number) => {
    setRemovingVoeId(voeId);
    try {
      const res = await fetch(`${API}/voter-allocation/${voeId}/booth`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booth_id: null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Voter removed from booth');
      setBoothVoters((prev) => prev.filter((v) => v.id !== voeId));
      onDistributed();
    } catch {
      toast.error('Failed to remove voter from booth');
    } finally {
      setRemovingVoeId(null);
    }
  };

  // ── Manual Assign ────────────────────────────────────────────────────────────
  const openManualDialog = (boothId: number) => {
    setManualTargetBoothId(boothId);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedVoeIds(new Set());
    setManualDialogOpen(true);
  };

  useEffect(() => {
    if (!manualDialogOpen) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${API}/voter-allocation/center/${pollingCenterId}/election/${electionId}/unassigned-booths?q=${encodeURIComponent(searchQuery)}&limit=100`
        );
        if (res.ok) setSearchResults(await res.json());
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, manualDialogOpen, pollingCenterId, electionId]);

  const toggleVoeId = (id: number) => {
    setSelectedVoeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleManualAssign = async () => {
    if (selectedVoeIds.size === 0 || manualTargetBoothId === null) return;
    setManualAssigning(true);
    try {
      await Promise.all(
        Array.from(selectedVoeIds).map((voeId) =>
          fetch(`${API}/voter-allocation/${voeId}/booth`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booth_id: manualTargetBoothId }),
          })
        )
      );
      toast.success(`${selectedVoeIds.size} voter(s) assigned to booth`);
      setManualDialogOpen(false);
      if (expandedBoothId === manualTargetBoothId) fetchBoothVoters(manualTargetBoothId);
      onDistributed();
    } catch {
      toast.error('Failed to assign voters');
    } finally {
      setManualAssigning(false);
    }
  };

  if (booths.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
          <Vote className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">No polling booths yet</p>
          <p className="text-xs mt-1">Create booths in the "Polling Booths" tab first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Voter-to-Booth Allocation</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assign center voters to specific booths manually or auto-distribute.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={distributing} className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/20">
              {distributing ? <Spinner className="size-4" /> : <Shuffle className="h-4 w-4" />}
              Auto-Distribute All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Auto-Distribute Voters</AlertDialogTitle>
              <AlertDialogDescription>
                All voters assigned to this center but not yet placed in a booth will be automatically distributed evenly across all booths. This cannot be undone easily.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDistribute} className="bg-violet-600 hover:bg-violet-700 text-white">
                Distribute
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y">
          {booths.map((booth) => {
            const isExpanded = expandedBoothId === booth.id;
            return (
              <div key={booth.id} className="flex flex-col">
                {/* Accordion Header */}
                <button
                  onClick={() => toggleExpand(booth.id)}
                  className={`flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors text-left ${isExpanded ? 'bg-muted/20' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {booth.booth_number}
                    </div>
                    <div>
                      <p className="font-bold text-sm">Booth {booth.booth_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {booth.officers.length > 0
                          ? booth.officers.map((o) => o.user_name).join(', ')
                          : 'No officers assigned'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isExpanded
                      ? <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      : <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    }
                  </div>
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="px-6 py-4 bg-muted/10 border-t">
                    <div className="flex flex-col gap-4">
                      {/* Controls row */}
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => openManualDialog(booth.id)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Manual Assign
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {loadingVoters ? '…' : `${boothVoters.length} voter(s) in this booth`}
                        </span>
                      </div>

                      {/* Voter table */}
                      <div className="bg-background border rounded-lg shadow-sm overflow-hidden">
                        {loadingVoters ? (
                          <div className="flex items-center justify-center py-10">
                            <Spinner className="size-5 text-muted-foreground" />
                          </div>
                        ) : boothVoters.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                            <Users className="h-7 w-7 mb-2 opacity-20" />
                            <p className="text-sm font-medium">No voters assigned</p>
                            <p className="text-xs">Use Manual Assign or Auto-Distribute above.</p>
                          </div>
                        ) : (
                          <div className="overflow-y-auto max-h-64">
                            <Table>
                              <TableHeader className="bg-muted/50 sticky top-0">
                                <TableRow>
                                  <TableHead className="text-xs font-bold uppercase py-2 h-auto">NID</TableHead>
                                  <TableHead className="text-xs font-bold uppercase py-2 h-auto">Name</TableHead>
                                  <TableHead className="text-xs font-bold uppercase py-2 h-auto text-right">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {boothVoters.map((v) => (
                                  <TableRow key={v.id}>
                                    <TableCell className="font-mono text-xs py-2">{v.nid}</TableCell>
                                    <TableCell className="py-2">
                                      <p className="text-sm font-semibold">{v.name}</p>
                                      <p className="text-[10px] text-muted-foreground">{v.voter_type}</p>
                                    </TableCell>
                                    <TableCell className="text-right py-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleUnassignVoter(v.id)}
                                        disabled={removingVoeId === v.id}
                                        title="Unassign from booth"
                                      >
                                        {removingVoeId === v.id ? <Spinner className="size-3" /> : <X className="h-3.5 w-3.5" />}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Manual Assign Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manual Voter Assignment</DialogTitle>
            <DialogDescription>
              Search for voters in this center that haven't been assigned to a booth yet.
            </DialogDescription>
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
                <p className="font-medium">
                  {searchQuery ? 'No unassigned voters match search' : 'Start typing to search'}
                </p>
                <p className="text-xs mt-1">Only voters allocated to this center without a booth are shown.</p>
              </div>
            ) : (
              <div className="divide-y py-1">
                {searchResults.map((v) => (
                  <label key={v.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 rounded-md transition-colors">
                    <Checkbox
                      checked={selectedVoeIds.has(v.id)}
                      onCheckedChange={() => toggleVoeId(v.id)}
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
            <span className="text-sm text-muted-foreground">{selectedVoeIds.size} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setManualDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleManualAssign} disabled={selectedVoeIds.size === 0 || manualAssigning}>
                {manualAssigning ? <Spinner className="size-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Assign Selected ({selectedVoeIds.size})
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const PRODashboard: React.FC<PRODashboardProps> = ({
  electionId,
  electionName,
  locationLabel,
  startDate,
  endDate,
  pollingCenterId,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('polling-booths');

  // ── Booths state ────────────────────────────────────────────────────────────
  const [booths, setBooths] = useState<Booth[]>([]);
  const [boothsLoading, setBoothsLoading] = useState(true);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  // Add booth dialog
  const [addBoothDialogOpen, setAddBoothDialogOpen] = useState(false);
  const [newBoothNumber, setNewBoothNumber] = useState('');
  const [addingBooth, setAddingBooth] = useState(false);

  // Edit booth
  const [editingBoothId, setEditingBoothId] = useState<number | null>(null);
  const [editBoothNumber, setEditBoothNumber] = useState('');
  const [savingBooth, setSavingBooth] = useState(false);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const [totalAllocated, setTotalAllocated] = useState<number | null>(null);
  const [boothAssigned, setBoothAssigned] = useState<number | null>(null);

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  const fetchBooths = useCallback(async () => {
    setBoothsLoading(true);
    try {
      const res = await fetch(
        `${API}/polling_booth/election/${electionId}/center/${pollingCenterId}`
      );
      if (!res.ok) throw new Error();
      setBooths(await res.json());
    } catch {
      toast.error('Failed to load polling booths');
    } finally {
      setBoothsLoading(false);
    }
  }, [electionId, pollingCenterId]);

  const fetchAssignableUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/users/assignable`);
      if (res.ok) setAssignableUsers(await res.json());
    } catch { /* non-critical */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      // Total voters allocated to center
      const centerRes = await fetch(
        `${API}/voter-allocation/center/${pollingCenterId}/election/${electionId}`
      );
      if (centerRes.ok) {
        const voters: BoothVoter[] = await centerRes.json();
        setTotalAllocated(voters.length);
        setBoothAssigned(voters.filter((v: any) => v.booth_id !== null && v.booth_id !== undefined).length);
      }
    } catch { /* non-critical */ }
  }, [pollingCenterId, electionId]);

  useEffect(() => {
    fetchBooths();
    fetchAssignableUsers();
    fetchStats();
  }, [fetchBooths, fetchAssignableUsers, fetchStats]);

  // ── Booth handlers ──────────────────────────────────────────────────────────
  const addBooth = async () => {
    if (!newBoothNumber) return;
    setAddingBooth(true);
    try {
      const res = await fetch(`${API}/polling_booth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booth_number: Number(newBoothNumber),
          polling_center_id: pollingCenterId,
          election_id: electionId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add booth');
      }
      const newBooth = await res.json();
      setBooths((prev) => [...prev, newBooth]);
      setAddBoothDialogOpen(false);
      setNewBoothNumber('');
      toast.success(`Booth #${newBooth.booth_number} created`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add booth');
    } finally {
      setAddingBooth(false);
    }
  };

  const saveBoothRename = async () => {
    if (editingBoothId === null || !editBoothNumber) return;
    setSavingBooth(true);
    try {
      const res = await fetch(`${API}/polling_booth/${editingBoothId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booth_number: Number(editBoothNumber) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to rename booth');
      }
      const updated = await res.json();
      setBooths((prev) =>
        prev.map((b) => (b.id === editingBoothId ? { ...b, booth_number: updated.booth_number } : b))
      );
      setEditingBoothId(null);
      toast.success(`Booth renamed to #${updated.booth_number}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to rename booth');
    } finally {
      setSavingBooth(false);
    }
  };

  const deleteBooth = async (boothId: number) => {
    try {
      const res = await fetch(`${API}/polling_booth/${boothId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setBooths((prev) => prev.filter((b) => b.id !== boothId));
      toast.success('Booth deleted');
    } catch {
      toast.error('Failed to delete booth');
    }
  };

  const addOfficer = async (boothId: number, userId: string) => {
    try {
      const res = await fetch(`${API}/polling_booth/${boothId}/officer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add officer');
      }
      const officer: Officer = await res.json();
      setBooths((prev) =>
        prev.map((b) => (b.id === boothId ? { ...b, officers: [...b.officers, officer] } : b))
      );
      toast.success(`${officer.user_name} assigned`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add officer');
    }
  };

  const removeOfficer = async (boothId: number, roleMapId: number) => {
    try {
      const res = await fetch(`${API}/polling_booth/officer/${roleMapId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setBooths((prev) =>
        prev.map((b) =>
          b.id === boothId
            ? { ...b, officers: b.officers.filter((o) => o.role_map_id !== roleMapId) }
            : b
        )
      );
      toast.success('Officer removed');
    } catch {
      toast.error('Failed to remove officer');
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const centerLabel = locationLabel
    ? locationLabel.split(' — ')[0]
    : 'Polling Center';
  const centerAddress = locationLabel
    ? locationLabel.split(' — ').slice(1).join(' — ')
    : null;

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'polling-booths', label: 'Polling Booths', icon: <Vote className="h-4 w-4" /> },
    { key: 'voter-allocation', label: 'Voter-to-Booth Allocation', icon: <Users className="h-4 w-4" /> },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">

      {/* ── Back + Header ──────────────────────────────────────────────────── */}
      <div>
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={() => navigate('/homeUSER')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to My Elections
        </Button>

        <Card className="shadow-sm">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  Presiding Officer
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight">{electionName}</h1>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold text-foreground">{centerLabel}</span>
                {centerAddress && <span>— {centerAddress}</span>}
              </p>
            </div>
            <div className="bg-primary/5 border border-primary/10 rounded-lg px-4 py-3 flex items-center gap-3 flex-shrink-0">
              <CalendarDays className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Election Period</p>
                <p className="text-sm font-bold">{formatDate(startDate)} — {formatDate(endDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: 'Booths in Center',
            value: boothsLoading ? '—' : String(booths.length),
            icon: <Vote className="h-5 w-5" />,
            color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30',
          },
          {
            label: 'Voters Allocated to Center',
            value: totalAllocated !== null ? totalAllocated.toLocaleString() : '—',
            icon: <Users className="h-5 w-5" />,
            color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
          },
          {
            label: 'Assigned to Booths',
            value: boothAssigned !== null ? boothAssigned.toLocaleString() : '—',
            icon: <ClipboardList className="h-5 w-5" />,
            color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
          },
        ].map((s) => (
          <Card key={s.label} className="shadow-sm">
            <CardContent className="p-5 flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${s.color}`}>
                {s.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                <p className="text-xl font-bold truncate">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────────────── */}
      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 pb-3 pt-1 border-b-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Polling Booths
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'polling-booths' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Polling Booths</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Create booths and assign Polling Officers for this center.
              </p>
            </div>
            <Button onClick={() => { setNewBoothNumber(''); setAddBoothDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Booth
            </Button>
          </div>

          {boothsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                <Spinner className="size-5" /> Loading…
              </CardContent>
            </Card>
          ) : booths.length === 0 ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
                <Vote className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium">No polling booths yet</p>
                <p className="text-xs mt-1">Click "Add Booth" to create the first booth.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {booths.map((booth) => {
                const isEditing = editingBoothId === booth.id;
                return (
                  <Card key={booth.id} className="shadow-sm overflow-hidden">
                    {/* Booth Header */}
                    <div className="px-5 py-4 border-b bg-muted/30 flex flex-col md:flex-row justify-between md:items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                          {booth.booth_number}
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={editBoothNumber}
                              onChange={(e) => setEditBoothNumber(e.target.value)}
                              className="w-24 h-8"
                              min={1}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={saveBoothRename}
                              disabled={savingBooth}
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {savingBooth ? <Spinner className="size-3.5" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingBoothId(null)} className="h-8">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <h3 className="text-lg font-bold">Booth {booth.booth_number}</h3>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <AddOfficerPopover
                          users={assignableUsers}
                          onSelect={(userId) => addOfficer(booth.id, userId)}
                        />
                        <div className="w-px h-6 bg-border mx-1" />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => { setEditingBoothId(booth.id); setEditBoothNumber(String(booth.booth_number)); }}
                          title="Rename booth"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete booth"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Booth</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>Booth #{booth.booth_number}</strong>? This will also remove all officer assignments.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteBooth(booth.id)}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {/* Officers Grid */}
                    <CardContent className="p-4">
                      {booth.officers.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic px-1">
                          No officers assigned yet. Click "Add Officer" above.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {booth.officers.map((officer) => (
                            <div
                              key={officer.role_map_id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                                  {getInitials(officer.user_name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold truncate">{officer.user_name}</p>
                                  <p className="text-xs text-muted-foreground">Polling Officer</p>
                                </div>
                              </div>
                              <button
                                onClick={() => removeOfficer(booth.id, officer.role_map_id)}
                                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-2"
                                title="Remove officer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Voter-to-Booth Allocation
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'voter-allocation' && (
        <BoothVoterAllocationTab
          electionId={electionId}
          pollingCenterId={pollingCenterId}
          booths={booths}
          onDistributed={() => {
            fetchStats();
          }}
        />
      )}

      {/* ── Add Booth Dialog ────────────────────────────────────────────────── */}
      <Dialog open={addBoothDialogOpen} onOpenChange={setAddBoothDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Polling Booth</DialogTitle>
            <DialogDescription>Enter a booth number for the new polling booth in this center.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="booth-number">Booth Number</Label>
              <Input
                id="booth-number"
                type="number"
                placeholder="e.g. 1"
                value={newBoothNumber}
                onChange={(e) => setNewBoothNumber(e.target.value)}
                min={1}
                className="mt-1.5"
                onKeyDown={(e) => e.key === 'Enter' && addBooth()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAddBoothDialogOpen(false); setNewBoothNumber(''); }}>
              Cancel
            </Button>
            <Button onClick={addBooth} disabled={!newBoothNumber || addingBooth}>
              {addingBooth ? <Spinner className="size-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Booth
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PRODashboard;
