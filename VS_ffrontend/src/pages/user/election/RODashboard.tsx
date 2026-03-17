import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ClipboardList,
  MapPin,
  Plus,
  Search,
  Trash2,
  User,
  Users,
  Vote as VoteIcon,
} from 'lucide-react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface RODashboardProps {
  electionId: string | number;
  electionName: string;
  locationLabel: string | null;
  startDate: string;
  endDate: string;
  /** coe_id — the constituency_of_election PK for this user's assignment */
  coeId: string | number;
  /** constituency display name */
  constituencyName: string;
}

interface PollingCenterRow {
  poe_id: number;
  polling_center_id: number;
  name: string;
  address: string;
  pro_id: string | null;
  pro_name: string | null;
  voter_count?: number;
}

interface UnassignedCenter {
  id: number;
  name: string;
  address: string;
}

interface AssignableUser {
  id: string;
  name: string;
}

type NominationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Candidate {
  candidate_id: number;
  name: string;
  party: string;
  nomination_status: NominationStatus;
}

type TabKey = 'polling-centers' | 'voter-allocation' | 'candidates';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API = 'http://localhost:3001/api';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  });

const statusConfig = {
  LIVE: { label: 'Live', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  PLANNED: { label: 'Scheduled', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  CLOSED: { label: 'Closed', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  FINALIZED: { label: 'Finalized', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
} as const;

const nominationBadge: Record<NominationStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

/** Initials avatar for PRO / candidates */
const Initials: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <div className={`rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0 ${className}`}>
      {letters}
    </div>
  );
};

// ─── PRO Combobox ─────────────────────────────────────────────────────────────

const PROCombobox: React.FC<{
  value: string | null;
  onChange: (id: string | null) => void;
  users: AssignableUser[];
}> = ({ value, onChange, users }) => {
  const [open, setOpen] = useState(false);
  const selected = users.find((u) => u.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal h-9">
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
              <CommandItem onSelect={() => { onChange(null); setOpen(false); }} className="text-muted-foreground italic">
                <span>None (unassign)</span>
                {!value && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
              {users.map((u) => (
                <CommandItem key={u.id} value={u.name} onSelect={() => { onChange(u.id); setOpen(false); }}>
                  {u.name}
                  {value === u.id && <Check className="ml-auto h-4 w-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RODashboard: React.FC<RODashboardProps> = ({
  electionId,
  electionName,
  locationLabel,
  startDate,
  endDate,
  coeId,
  constituencyName,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('polling-centers');

  // ── Polling Centers state ───────────────────────────────────────────────────
  const [pollingCenters, setPollingCenters] = useState<PollingCenterRow[]>([]);
  const [centersLoading, setCentersLoading] = useState(true);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [editingPoeId, setEditingPoeId] = useState<number | null>(null);
  const [editProId, setEditProId] = useState<string | null>(null);
  const [savingPro, setSavingPro] = useState(false);
  const [deletingPoeId, setDeletingPoeId] = useState<number | null>(null);

  // Add center dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [unassignedCenters, setUnassignedCenters] = useState<UnassignedCenter[]>([]);
  const [selectedCenterIds, setSelectedCenterIds] = useState<Set<number>>(new Set());
  const [addSearch, setAddSearch] = useState('');
  const [addingCenters, setAddingCenters] = useState(false);

  // ── Candidates state ────────────────────────────────────────────────────────
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [addCandOpen, setAddCandOpen] = useState(false);
  const [candName, setCandName] = useState('');
  const [candParty, setCandParty] = useState('');
  const [savingCand, setSavingCand] = useState(false);
  const [deletingCandId, setDeletingCandId] = useState<number | null>(null);
  const [candSearch, setCandSearch] = useState('');

  // ── Stats ───────────────────────────────────────────────────────────────────
  const [totalVoters, setTotalVoters] = useState<number | null>(null);

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  const fetchPollingCenters = useCallback(async () => {
    // We need constituency_id — extract from locationLabel or re-query.
    // We query by election + constituency via the existing endpoint pattern.
    // coeId gives us the row, from which we can get constituency_id via a small redirect:
    // We'll use /constituency_of_election/election/:eId and filter by coe_id.
    try {
      const res = await fetch(`${API}/constituency_of_election/election/${electionId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const all = await res.json();
      const coe = all.find((r: { id?: number; coe_id?: number }) =>
        String(r.coe_id ?? r.id) === String(coeId)
      );
      if (!coe) return;
      const constituencyId = coe.constituency_id;

      const centersRes = await fetch(
        `${API}/polling_center_of_election/election/${electionId}/constituency/${constituencyId}`
      );
      if (!centersRes.ok) throw new Error('Failed to fetch centers');
      const centers: PollingCenterRow[] = await centersRes.json();

      // Fetch per-center voter counts
      const countRes = await fetch(`${API}/candidate/center-voter-counts/${coeId}`);
      const countData: { poe_id: number; voter_count: number }[] = countRes.ok ? await countRes.json() : [];
      const countMap = new Map(countData.map((c) => [c.poe_id, c.voter_count]));

      setPollingCenters(centers.map((c) => ({ ...c, voter_count: countMap.get(c.poe_id) ?? 0 })));
    } catch (err) {
      toast.error('Failed to load polling centers');
    }
  }, [electionId, coeId]);

  const fetchAssignableUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/users/assignable`);
      if (res.ok) setAssignableUsers(await res.json());
    } catch { /* non-critical */ }
  }, []);

  const fetchTotalVoters = useCallback(async () => {
    try {
      const res = await fetch(`${API}/candidate/voter-count/${coeId}`);
      if (res.ok) {
        const data = await res.json();
        setTotalVoters(data.total_voters ?? 0);
      }
    } catch { /* non-critical */ }
  }, [coeId]);

  const fetchCandidates = useCallback(async () => {
    setCandidatesLoading(true);
    try {
      const res = await fetch(`${API}/candidate/coe/${coeId}`);
      if (!res.ok) throw new Error('Failed to fetch candidates');
      setCandidates(await res.json());
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setCandidatesLoading(false);
    }
  }, [coeId]);

  const fetchUnassignedCenters = useCallback(async () => {
    // Get constituency_id first
    try {
      const res = await fetch(`${API}/constituency_of_election/election/${electionId}`);
      if (!res.ok) return;
      const all = await res.json();
      const coe = all.find((r: { id?: number; coe_id?: number }) =>
        String(r.coe_id ?? r.id) === String(coeId)
      );
      if (!coe) return;
      const constituencyId = coe.constituency_id;
      const ucRes = await fetch(`${API}/constituency/${constituencyId}/polling_centers/unassigned/${electionId}`);
      if (ucRes.ok) setUnassignedCenters(await ucRes.json());
    } catch { /* non-critical */ }
  }, [electionId, coeId]);

  useEffect(() => {
    (async () => {
      setCentersLoading(true);
      await Promise.all([fetchPollingCenters(), fetchAssignableUsers(), fetchTotalVoters()]);
      setCentersLoading(false);
    })();
    fetchCandidates();
  }, [fetchPollingCenters, fetchAssignableUsers, fetchTotalVoters, fetchCandidates]);

  // ── Polling Center handlers ─────────────────────────────────────────────────
  const openAddDialog = async () => {
    setSelectedCenterIds(new Set());
    setAddSearch('');
    await fetchUnassignedCenters();
    setAddDialogOpen(true);
  };

  const toggleCenter = (id: number) => {
    setSelectedCenterIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredUnassigned = unassignedCenters.filter(
    (c) =>
      c.name.toLowerCase().includes(addSearch.toLowerCase()) ||
      c.address.toLowerCase().includes(addSearch.toLowerCase())
  );

  const toggleAll = () => {
    const allSel = filteredUnassigned.every((c) => selectedCenterIds.has(c.id));
    setSelectedCenterIds((prev) => {
      const next = new Set(prev);
      filteredUnassigned.forEach((c) => (allSel ? next.delete(c.id) : next.add(c.id)));
      return next;
    });
  };

  const addSelectedCenters = async () => {
    if (selectedCenterIds.size === 0) return;
    setAddingCenters(true);
    try {
      const res = await fetch(`${API}/polling_center_of_election`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ election_id: electionId, polling_center_ids: Array.from(selectedCenterIds) }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${selectedCenterIds.size} polling center(s) added`);
      setAddDialogOpen(false);
      await fetchPollingCenters();
    } catch {
      toast.error('Failed to add polling centers');
    } finally {
      setAddingCenters(false);
    }
  };

  const savePro = async () => {
    if (editingPoeId === null) return;
    setSavingPro(true);
    try {
      const res = await fetch(`${API}/polling_center_of_election/${editingPoeId}/pro`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pro_id: editProId }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPollingCenters((prev) => prev.map((pc) => pc.poe_id === editingPoeId ? { ...updated, voter_count: pc.voter_count } : pc));
      setEditingPoeId(null);
      toast.success('Presiding officer updated');
    } catch {
      toast.error('Failed to update presiding officer');
    } finally {
      setSavingPro(false);
    }
  };

  const deletePollingCenter = async (poeId: number) => {
    setDeletingPoeId(poeId);
    try {
      const res = await fetch(`${API}/polling_center_of_election/${poeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Polling center removed');
      await fetchPollingCenters();
      await fetchTotalVoters();
    } catch {
      toast.error('Failed to remove polling center');
    } finally {
      setDeletingPoeId(null);
    }
  };

  // ── Candidate handlers ──────────────────────────────────────────────────────
  const addCandidate = async () => {
    if (!candName.trim() || !candParty.trim()) {
      toast.error('Name and party are required');
      return;
    }
    setSavingCand(true);
    try {
      const res = await fetch(`${API}/candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: candName.trim(), party: candParty.trim(), constituency_of_election_id: coeId }),
      });
      if (!res.ok) throw new Error();
      const newCand: Candidate = await res.json();
      setCandidates((prev) => [...prev, newCand].sort((a, b) => a.name.localeCompare(b.name)));
      setCandName('');
      setCandParty('');
      setAddCandOpen(false);
      toast.success('Candidate added successfully');
    } catch {
      toast.error('Failed to add candidate');
    } finally {
      setSavingCand(false);
    }
  };

  const deleteCandidate = async (id: number) => {
    setDeletingCandId(id);
    try {
      const res = await fetch(`${API}/candidate/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setCandidates((prev) => prev.filter((c) => c.candidate_id !== id));
      toast.success('Candidate removed');
    } catch {
      toast.error('Failed to remove candidate');
    } finally {
      setDeletingCandId(null);
    }
  };

  const filteredCandidates = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(candSearch.toLowerCase()) ||
      c.party.toLowerCase().includes(candSearch.toLowerCase())
  );

  // ── Stat cards data ─────────────────────────────────────────────────────────
  const proAssigned = pollingCenters.filter((p) => p.pro_id).length;
  const approvedCandidates = candidates.filter((c) => c.nomination_status === 'APPROVED').length;

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'polling-centers', label: 'Polling Centers', icon: <Building2 className="h-4 w-4" /> },
    { key: 'voter-allocation', label: 'Voter Allocation', icon: <Users className="h-4 w-4" /> },
    { key: 'candidates', label: 'Candidate Management', icon: <VoteIcon className="h-4 w-4" /> },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">

      {/* ── Back + Header ─────────────────────────────────────────────────── */}
      <div>
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={() => navigate('/homeUSER')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to My Elections
        </Button>

        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                Returning Officer
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">{electionName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {constituencyName}
              {locationLabel && locationLabel !== constituencyName && ` · ${locationLabel}`}
            </p>
          </div>
          <div className="bg-primary/5 border border-primary/10 rounded-lg px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <CalendarDays className="h-4 w-4 text-primary" />
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Election Period</p>
              <p className="text-sm font-bold">{formatDate(startDate)} — {formatDate(endDate)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Voters',
            value: totalVoters !== null ? totalVoters.toLocaleString() : '—',
            icon: <Users className="h-5 w-5" />,
            color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
          },
          {
            label: 'Polling Centers',
            value: centersLoading ? '—' : String(pollingCenters.length),
            icon: <Building2 className="h-5 w-5" />,
            color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30',
          },
          {
            label: 'PROs Assigned',
            value: centersLoading ? '—' : `${proAssigned} / ${pollingCenters.length}`,
            icon: <User className="h-5 w-5" />,
            color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30',
          },
          {
            label: 'Total Candidates',
            value: candidatesLoading ? '—' : String(candidates.length),
            icon: <ClipboardList className="h-5 w-5" />,
            color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
          },
        ].map((s) => (
          <div key={s.label} className="bg-card border rounded-xl p-5 shadow-sm flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${s.color}`}>
              {s.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              <p className="text-xl font-bold truncate">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────────────── */}
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
          TAB: Polling Centers
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'polling-centers' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Polling Centers</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Add or remove centers and assign presiding officers.
              </p>
            </div>

            {/* Add Polling Center dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-primary border-primary/30 hover:bg-primary/10" onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Polling Center
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Add Polling Centers</DialogTitle>
                  <DialogDescription>Select centers to include in this election.</DialogDescription>
                </DialogHeader>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name or address…" value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex-1 overflow-y-auto -mx-6 px-6 max-h-[50vh] space-y-1">
                  {filteredUnassigned.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="font-medium">No available polling centers</p>
                      <p className="text-xs">All centers in this constituency have already been assigned.</p>
                    </div>
                  ) : (
                    <>
                      <label className="flex items-center gap-3 px-3 py-2.5 border-b cursor-pointer hover:bg-muted/40 rounded-md transition-colors">
                        <Checkbox
                          checked={filteredUnassigned.length > 0 && filteredUnassigned.every((c) => selectedCenterIds.has(c.id))}
                          onCheckedChange={toggleAll}
                        />
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select All</span>
                      </label>
                      {filteredUnassigned.map((c) => (
                        <label key={c.id} className="flex items-start gap-3 px-3 py-3 cursor-pointer hover:bg-muted/40 rounded-md transition-colors">
                          <div className="mt-0.5">
                            <Checkbox checked={selectedCenterIds.has(c.id)} onCheckedChange={() => toggleCenter(c.id)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{c.name}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <MapPin className="h-3 w-3" />{c.address}
                            </div>
                          </div>
                        </label>
                      ))}
                    </>
                  )}
                </div>
                <DialogFooter className="border-t pt-4 flex items-center !justify-between">
                  <span className="text-sm text-muted-foreground">{selectedCenterIds.size} selected</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={addSelectedCenters} disabled={selectedCenterIds.size === 0 || addingCenters}>
                      {addingCenters ? <Spinner className="size-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                      Add Selected ({selectedCenterIds.size})
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Table */}
          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            {centersLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                <Spinner className="size-5" /> Loading…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Center</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Presiding Officer (PRO)</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Allocated Voters</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pollingCenters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-14 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Building2 className="h-8 w-8 opacity-30" />
                          <p className="font-medium">No polling centers yet</p>
                          <p className="text-xs">Click "Add Polling Center" to get started.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pollingCenters.map((pc) => {
                      const isEditing = editingPoeId === pc.poe_id;
                      return (
                        <TableRow key={pc.poe_id} className={isEditing ? 'bg-primary/5' : 'hover:bg-muted/40 transition-colors'}>
                          {/* Center name */}
                          <TableCell className="px-6 py-4">
                            <p className="text-sm font-semibold">{pc.name}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <MapPin className="h-3 w-3" />{pc.address}
                            </div>
                          </TableCell>

                          {/* PRO */}
                          <TableCell className="px-6 py-4">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 max-w-[220px]">
                                  <PROCombobox value={editProId} onChange={setEditProId} users={assignableUsers} />
                                </div>
                                <Button size="sm" onClick={savePro} disabled={savingPro} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                  {savingPro ? <Spinner className="size-3.5" /> : <Check className="h-3.5 w-3.5" />}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingPoeId(null)}>✕</Button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingPoeId(pc.poe_id); setEditProId(pc.pro_id); }}
                                className="text-left hover:underline cursor-pointer"
                                title="Click to edit PRO"
                              >
                                {pc.pro_name ? (
                                  <div className="flex items-center gap-2">
                                    <Initials name={pc.pro_name} className="w-7 h-7" />
                                    <span className="text-sm font-medium">{pc.pro_name}</span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground italic">Assign PRO…</span>
                                )}
                              </button>
                            )}
                          </TableCell>

                          {/* Voter count */}
                          <TableCell className="px-6 py-4">
                            <span className="text-sm font-semibold">{(pc.voter_count ?? 0).toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground ml-1">voters</span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="px-6 py-4 text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" title="Remove center">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Polling Center</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Remove <strong>{pc.name}</strong> from this election? This will also remove the PRO assignment.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deletePollingCenter(pc.poe_id)}
                                    disabled={deletingPoeId === pc.poe_id}
                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  >
                                    {deletingPoeId === pc.poe_id ? 'Removing…' : 'Remove'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
            {pollingCenters.length > 0 && (
              <div className="px-6 py-3 bg-muted/30 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {pollingCenters.length} center(s) · {proAssigned} PRO(s) assigned
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Voter Allocation (placeholder)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'voter-allocation' && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="border-b px-6 py-4">
            <h2 className="font-bold text-lg">Voter Allocation</h2>
            <p className="text-sm text-muted-foreground">Manage voter assignments across polling centers</p>
          </div>
          <div className="px-6 py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 text-blue-600">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold mb-2">Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              The voter allocation module will allow you to assign voters from the electoral roll to specific polling centers. This feature is currently under development.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-md text-left">
              {[
                { label: 'Total Allocated Voters', value: totalVoters !== null ? totalVoters.toLocaleString() : '—' },
                { label: 'Polling Centers', value: String(pollingCenters.length) },
                { label: 'Unallocated', value: '—' },
              ].map((s) => (
                <div key={s.label} className="bg-muted/40 rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Candidate Management
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Candidates</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Add or remove candidates for this constituency. Approval is handled separately.
              </p>
            </div>

            {/* Add candidate dialog */}
            <Dialog open={addCandOpen} onOpenChange={(o) => { setAddCandOpen(o); if (!o) { setCandName(''); setCandParty(''); } }}>
              <DialogTrigger asChild>
                <Button className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Candidate
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Candidate</DialogTitle>
                  <DialogDescription>
                    The candidate will be added with <strong>PENDING</strong> nomination status.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cand-name">Full Name</Label>
                    <Input id="cand-name" placeholder="e.g. John Doe" value={candName} onChange={(e) => setCandName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cand-party">Party</Label>
                    <Input id="cand-party" placeholder="e.g. Progressive Alliance" value={candParty} onChange={(e) => setCandParty(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setAddCandOpen(false)}>Cancel</Button>
                  <Button onClick={addCandidate} disabled={savingCand || !candName.trim() || !candParty.trim()}>
                    {savingCand ? <Spinner className="size-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add Candidate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search candidates…" value={candSearch} onChange={(e) => setCandSearch(e.target.value)} className="pl-9" />
          </div>

          {/* Candidate list */}
          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            {candidatesLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                <Spinner className="size-5" /> Loading candidates…
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="py-16 flex flex-col items-center text-center text-muted-foreground">
                <VoteIcon className="h-8 w-8 mb-3 opacity-30" />
                <p className="font-medium">{candSearch ? 'No candidates match your search' : 'No candidates yet'}</p>
                {!candSearch && <p className="text-xs mt-1">Click "Add Candidate" to register a candidate for this constituency.</p>}
              </div>
            ) : (
              <div className="divide-y">
                {filteredCandidates.map((c) => (
                  <div key={c.candidate_id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                    {/* Avatar */}
                    <Initials name={c.name} className="w-12 h-12 text-sm" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{c.name}</p>
                      <p className="text-xs text-primary font-semibold uppercase tracking-wide mt-0.5">{c.party}</p>
                    </div>

                    {/* Status badge */}
                    <Badge
                      variant="outline"
                      className={`border-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 flex-shrink-0 ${nominationBadge[c.nomination_status]}`}
                    >
                      {c.nomination_status}
                    </Badge>

                    {/* Delete */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Candidate</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove <strong>{c.name}</strong> from this election?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteCandidate(c.candidate_id)}
                            disabled={deletingCandId === c.candidate_id}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                          >
                            {deletingCandId === c.candidate_id ? 'Removing…' : 'Remove'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
            {filteredCandidates.length > 0 && (
              <div className="px-6 py-3 bg-muted/30 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {candidates.length} candidate(s) · {approvedCandidates} approved
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RODashboard;
