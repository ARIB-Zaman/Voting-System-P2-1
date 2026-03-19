import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogTrigger,
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
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Eye,
  Info,
  MapPin,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Election {
  election_id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface ConstituencyInfo {
  coe_id: number;
  constituency_id: number;
  name: string;
  region: string;
  ro_id: string | null;
  ro_name: string | null;
}

interface PollingCenterOfElection {
  poe_id: number;
  polling_center_id: number;
  name: string;
  address: string;
  pro_id: string | null;
  pro_name: string | null;
}

interface UnassignedPollingCenter {
  id: number;
  name: string;
  address: string;
}

interface AssignableUser {
  id: string;
  name: string;
}

interface Candidate {
  candidate_id: number;
  name: string;
  party: string;
  nomination_status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const API = 'http://localhost:3001/api';

const statusConfig: Record<string, { label: string; className: string }> = {
  LIVE: {
    label: 'Active',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  PLANNED: {
    label: 'Scheduled',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  CLOSED: {
    label: 'Completed',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
  FINALIZED: {
    label: 'Finalized',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
};

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

// ── PRO Combobox Component ───────────────────────────────────────────────────

const PROCombobox: React.FC<{
  value: string | null;
  onChange: (id: string | null, name: string | null) => void;
  users: AssignableUser[];
}> = ({ value, onChange, users }) => {
  const [open, setOpen] = useState(false);

  const selected = users.find((u) => u.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9"
        >
          {selected ? selected.name : 'Assign PRO…'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search users…" />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {/* Allow clearing */}
              <CommandItem
                onSelect={() => {
                  onChange(null, null);
                  setOpen(false);
                }}
                className="text-muted-foreground italic"
              >
                <span>None (unassign)</span>
                {!value && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.name}
                  onSelect={() => {
                    onChange(u.id, u.name);
                    setOpen(false);
                  }}
                >
                  {u.name}
                  {value === u.id && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

const ConstituencyDetails: React.FC = () => {
  const { id, cId } = useParams();
  const navigate = useNavigate();

  // ── Data state ───────────────────────────────────────────────────────────
  const [election, setElection] = useState<Election | null>(null);
  const [constituency, setConstituency] = useState<ConstituencyInfo | null>(null);
  const [pollingCenters, setPollingCenters] = useState<PollingCenterOfElection[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Add polling center dialog state ─────────────────────────────────────
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [unassignedCenters, setUnassignedCenters] = useState<UnassignedPollingCenter[]>([]);
  const [selectedCenterIds, setSelectedCenterIds] = useState<Set<number>>(new Set());
  const [addSearch, setAddSearch] = useState('');
  const [addingCenters, setAddingCenters] = useState(false);

  // ── PRO edit state ──────────────────────────────────────────────────────
  const [editingPoeId, setEditingPoeId] = useState<number | null>(null);
  const [editProId, setEditProId] = useState<string | null>(null);
  const [savingPro, setSavingPro] = useState(false);

  // ── Delete polling center state ─────────────────────────────────────────
  const [deletingPoeId, setDeletingPoeId] = useState<number | null>(null);

  // ── Candidates state ────────────────────────────────────────────────────
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [updatingCandidateId, setUpdatingCandidateId] = useState<number | null>(null);

  // ── Fetch data ───────────────────────────────────────────────────────────
  const fetchElection = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/election/${id}`);
      if (!res.ok) throw new Error('Failed to fetch election');
      setElection(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [id]);

  const fetchConstituency = useCallback(async () => {
    if (!id || !cId) return;
    try {
      const res = await fetch(`${API}/constituency_of_election/election/${id}`);
      if (!res.ok) throw new Error('Failed to fetch constituency info');
      const all: ConstituencyInfo[] = await res.json();
      const match = all.find((c) => String(c.constituency_id) === String(cId));
      if (match) setConstituency(match);
      else setError('Constituency not found in this election');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load constituency');
    }
  }, [id, cId]);

  const fetchPollingCenters = useCallback(async () => {
    if (!id || !cId) return;
    try {
      const res = await fetch(
        `${API}/polling_center_of_election/election/${id}/constituency/${cId}`
      );
      if (!res.ok) throw new Error('Failed to fetch polling centers');
      setPollingCenters(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load polling centers');
    }
  }, [id, cId]);

  const fetchAssignableUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/users/assignable`);
      if (!res.ok) throw new Error('Failed to fetch users');
      setAssignableUsers(await res.json());
    } catch {
      // Non-critical
    }
  }, []);

  const fetchUnassignedCenters = useCallback(async () => {
    if (!id || !cId) return;
    try {
      const res = await fetch(
        `${API}/constituency/${cId}/polling_centers/unassigned/${id}`
      );
      if (!res.ok) throw new Error('Failed to fetch unassigned centers');
      setUnassignedCenters(await res.json());
    } catch {
      // Non-critical
    }
  }, [id, cId]);

  const fetchCandidates = useCallback(async (coeId: number) => {
    setCandidatesLoading(true);
    try {
      const res = await fetch(`${API}/candidate/coe/${coeId}`);
      if (!res.ok) throw new Error('Failed to fetch candidates');
      setCandidates(await res.json());
    } catch {
      // Non-critical
    } finally {
      setCandidatesLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([
        fetchElection(),
        fetchConstituency(),
        fetchPollingCenters(),
        fetchAssignableUsers(),
      ]);
      setLoading(false);
    })();
  }, [fetchElection, fetchConstituency, fetchPollingCenters, fetchAssignableUsers]);

  // Fetch candidates once the constituency (and its coe_id) is known
  useEffect(() => {
    if (constituency?.coe_id) {
      fetchCandidates(constituency.coe_id);
    }
  }, [constituency, fetchCandidates]);

  // ── Add dialog open handler ─────────────────────────────────────────────
  const openAddDialog = async () => {
    setSelectedCenterIds(new Set());
    setAddSearch('');
    await fetchUnassignedCenters();
    setAddDialogOpen(true);
  };

  const toggleCenter = (centerId: number) => {
    setSelectedCenterIds((prev) => {
      const next = new Set(prev);
      if (next.has(centerId)) next.delete(centerId);
      else next.add(centerId);
      return next;
    });
  };

  const toggleAll = () => {
    const filtered = filteredUnassigned;
    const allSelected = filtered.every((c) => selectedCenterIds.has(c.id));
    setSelectedCenterIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filtered.forEach((c) => next.delete(c.id));
      } else {
        filtered.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const addSelectedCenters = async () => {
    if (!election || selectedCenterIds.size === 0) return;
    setAddingCenters(true);
    try {
      const res = await fetch(`${API}/polling_center_of_election`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          election_id: election.election_id,
          polling_center_ids: Array.from(selectedCenterIds),
        }),
      });
      if (!res.ok) throw new Error('Add failed');
      toast.success(`${selectedCenterIds.size} polling center(s) added`);
      setAddDialogOpen(false);
      await fetchPollingCenters();
    } catch {
      toast.error('Failed to add polling centers');
    } finally {
      setAddingCenters(false);
    }
  };

  // ── PRO handlers ────────────────────────────────────────────────────────
  const startEditPro = (pc: PollingCenterOfElection) => {
    setEditingPoeId(pc.poe_id);
    setEditProId(pc.pro_id);
  };

  const cancelEditPro = () => {
    setEditingPoeId(null);
    setEditProId(null);
  };

  const savePro = async () => {
    if (editingPoeId === null) return;
    setSavingPro(true);
    try {
      const res = await fetch(
        `${API}/polling_center_of_election/${editingPoeId}/pro`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pro_id: editProId }),
        }
      );
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setPollingCenters((prev) =>
        prev.map((pc) => (pc.poe_id === editingPoeId ? updated : pc))
      );
      setEditingPoeId(null);
      toast.success('Presiding officer updated');
    } catch {
      toast.error('Failed to update presiding officer');
    } finally {
      setSavingPro(false);
    }
  };

  // ── Delete polling center ───────────────────────────────────────────────
  const deletePollingCenter = async (poeId: number) => {
    setDeletingPoeId(poeId);
    try {
      const res = await fetch(`${API}/polling_center_of_election/${poeId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Polling center removed from election');
      await fetchPollingCenters();
    } catch {
      toast.error('Failed to remove polling center');
    } finally {
      setDeletingPoeId(null);
    }
  };

  // ── Update candidate status ─────────────────────────────────────────────
  const updateCandidateStatus = async (
    candidateId: number,
    status: 'APPROVED' | 'REJECTED'
  ) => {
    setUpdatingCandidateId(candidateId);
    try {
      const res = await fetch(`${API}/candidate/${candidateId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomination_status: status }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated: Candidate = await res.json();
      setCandidates((prev) =>
        prev.map((c) => (c.candidate_id === candidateId ? updated : c))
      );
      toast.success(
        status === 'APPROVED' ? 'Candidate approved' : 'Candidate rejected'
      );
    } catch {
      toast.error('Failed to update candidate status');
    } finally {
      setUpdatingCandidateId(null);
    }
  };

  // ── Filter for add dialog search ────────────────────────────────────────
  const filteredUnassigned = unassignedCenters.filter(
    (c) =>
      c.name.toLowerCase().includes(addSearch.toLowerCase()) ||
      c.address.toLowerCase().includes(addSearch.toLowerCase())
  );

  const filteredCandidates = candidates.filter(
    (c) => c.nomination_status === statusFilter
  );

  const candidateStatusConfig = {
    PENDING: {
      label: 'Pending',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    },
    APPROVED: {
      label: 'Approved',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    REJECTED: {
      label: 'Rejected',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    },
  };

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error || !election || !constituency) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <p className="text-destructive">{error ?? 'Not found'}</p>
      </div>
    );
  }

  const cfg = statusConfig[election.status] ?? statusConfig.PLANNED;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* ── Back + Header ──────────────────────────────────────────────── */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 text-muted-foreground -ml-2"
          onClick={() => navigate(`/homeAdmin/showElection/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Election
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight">
              {constituency.name}
            </h1>
            <Badge
              variant="outline"
              className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 uppercase tracking-tight ${cfg.className}`}
            >
              {cfg.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* ── Info Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Election Summary */}
        <div className="bg-card border rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary border-b pb-3">
            <CalendarDays className="h-5 w-5" />
            <h2 className="text-base font-bold">Election Summary</h2>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Election Name
              </Label>
              <p className="text-sm font-medium mt-1">{election.name}</p>
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Start Date/Time
              </Label>
              <div className="flex items-center gap-2 mt-1 text-sm">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDateShort(election.start_date)}
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                End Date/Time
              </Label>
              <div className="flex items-center gap-2 mt-1 text-sm">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDateShort(election.end_date)}
              </div>
            </div>
          </div>
        </div>

        {/* Constituency Info */}
        <div className="lg:col-span-2 bg-card border rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary border-b pb-3">
            <Info className="h-5 w-5" />
            <h2 className="text-base font-bold">Constituency Info</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Constituency Name
                </Label>
                <p className="text-sm font-medium mt-1">{constituency.name}</p>
              </div>
              <div>
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Region
                </Label>
                <div className="flex items-center gap-1.5 mt-1 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {constituency.region}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Returning Officer (RO)
              </Label>
              {constituency.ro_name ? (
                <div className="flex items-center gap-1.5 text-sm mt-1">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {constituency.ro_name}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic mt-1">
                  Not assigned
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Polling Centers ────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Polling Centers</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage assigned centers and presiding officers for this constituency.
            </p>
          </div>

          {/* Add Polling Center Dialog Trigger */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="text-primary border-primary/30 hover:bg-primary/10"
                onClick={openAddDialog}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Polling Center
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Add Polling Centers</DialogTitle>
                <DialogDescription>
                  Select polling centers to include in this election.
                </DialogDescription>
              </DialogHeader>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or address…"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto -mx-6 px-6 max-h-[50vh] space-y-1">
                {filteredUnassigned.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No available polling centers</p>
                    <p className="text-xs">
                      All centers in this constituency have already been assigned.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Select all */}
                    <label className="flex items-center gap-3 px-3 py-2.5 border-b cursor-pointer hover:bg-muted/40 rounded-md transition-colors">
                      <Checkbox
                        checked={
                          filteredUnassigned.length > 0 &&
                          filteredUnassigned.every((c) =>
                            selectedCenterIds.has(c.id)
                          )
                        }
                        onCheckedChange={toggleAll}
                      />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Select All Available Centers
                      </span>
                    </label>

                    {filteredUnassigned.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-start gap-3 px-3 py-3 cursor-pointer hover:bg-muted/40 rounded-md transition-colors"
                      >
                        <div className="mt-0.5">
                          <Checkbox
                            checked={selectedCenterIds.has(c.id)}
                            onCheckedChange={() => toggleCenter(c.id)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{c.name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {c.address}
                          </div>
                        </div>
                      </label>
                    ))}
                  </>
                )}
              </div>

              <DialogFooter className="border-t pt-4 flex items-center !justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedCenterIds.size} center(s) selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={addSelectedCenters}
                    disabled={selectedCenterIds.size === 0 || addingCenters}
                  >
                    {addingCenters ? (
                      <Spinner className="size-4 mr-1" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Add Selected ({selectedCenterIds.size})
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Polling Centers Table */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                  Center Name & Address
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                  Presiding Officer (PRO)
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pollingCenters.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <MapPin className="h-8 w-8 opacity-40" />
                      <p className="font-medium">No polling centers yet</p>
                      <p className="text-xs">
                        Click "Add Polling Center" to get started.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pollingCenters.map((pc) => {
                  const isEditing = editingPoeId === pc.poe_id;

                  return (
                    <TableRow
                      key={pc.poe_id}
                      className={
                        isEditing
                          ? 'bg-primary/5'
                          : 'hover:bg-muted/40 transition-colors'
                      }
                    >
                      <TableCell className="px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold">{pc.name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {pc.address}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-[220px]">
                              <PROCombobox
                                value={editProId}
                                onChange={(proId) => setEditProId(proId)}
                                users={assignableUsers}
                              />
                            </div>
                            <Button
                              size="sm"
                              onClick={savePro}
                              disabled={savingPro}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {savingPro ? (
                                <Spinner className="size-3.5" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditPro}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditPro(pc)}
                            className="text-left hover:underline cursor-pointer"
                            title="Click to edit PRO"
                          >
                            {pc.pro_name ? (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                {pc.pro_name}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">
                                Assign PRO…
                              </span>
                            )}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                              navigate(
                                `/homeAdmin/showElection/${id}/constituency/${cId}/polling-center/${pc.polling_center_id}`
                              )
                            }
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Remove from election"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remove Polling Center
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove{' '}
                                  <strong>{pc.name}</strong> from this election?
                                  This will also remove any PRO assignment.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePollingCenter(pc.poe_id)}
                                  disabled={deletingPoeId === pc.poe_id}
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                >
                                  {deletingPoeId === pc.poe_id
                                    ? 'Removing…'
                                    : 'Remove'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {pollingCenters.length > 0 && (
            <div className="px-6 py-3 bg-muted/30 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Showing {pollingCenters.length} center(s) in{' '}
                {constituency.name}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Candidates ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Candidates</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Review and approve or reject nominations for this constituency.
            </p>
          </div>

          {/* Status filter toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
            {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => {
              const counts = {
                PENDING: candidates.filter((c) => c.nomination_status === 'PENDING').length,
                APPROVED: candidates.filter((c) => c.nomination_status === 'APPROVED').length,
                REJECTED: candidates.filter((c) => c.nomination_status === 'REJECTED').length,
              };
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    statusFilter === s
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    s === 'PENDING'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : s === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  }`}>
                    {counts[s]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                  Candidate Name
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                  Party
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidatesLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10">
                    <Spinner className="size-5 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredCandidates.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <UserCheck className="h-8 w-8 opacity-40" />
                      <p className="font-medium">
                        No {statusFilter.toLowerCase()} candidates
                      </p>
                      <p className="text-xs">
                        {statusFilter === 'PENDING'
                          ? 'All nominations have been reviewed.'
                          : `No candidates have been ${statusFilter.toLowerCase()} yet.`}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCandidates.map((c) => {
                  const scfg = candidateStatusConfig[c.nomination_status];
                  const isUpdating = updatingCandidateId === c.candidate_id;
                  return (
                    <TableRow
                      key={c.candidate_id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="px-6 py-4">
                        <p className="text-sm font-semibold">{c.name}</p>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <p className="text-sm text-muted-foreground">{c.party}</p>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 uppercase tracking-tight ${scfg.className}`}
                        >
                          {scfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex gap-1 justify-end">
                          {/* Always show Approve unless already approved */}
                          {c.nomination_status !== 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              title="Approve candidate"
                              disabled={isUpdating}
                              onClick={() =>
                                updateCandidateStatus(c.candidate_id, 'APPROVED')
                              }
                            >
                              {isUpdating ? (
                                <Spinner className="size-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {/* Always show Reject unless already rejected */}
                          {c.nomination_status !== 'REJECTED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Reject candidate"
                              disabled={isUpdating}
                              onClick={() =>
                                updateCandidateStatus(c.candidate_id, 'REJECTED')
                              }
                            >
                              {isUpdating ? (
                                <Spinner className="size-4" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {candidates.length > 0 && (
            <div className="px-6 py-3 bg-muted/30 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {filteredCandidates.length} {statusFilter.toLowerCase()} candidate(s) · {candidates.length} total
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConstituencyDetails;
