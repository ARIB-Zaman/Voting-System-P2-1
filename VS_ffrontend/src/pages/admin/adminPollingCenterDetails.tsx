import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
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
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Info,
  MapPin,
  Pencil,
  Plus,
  Store,
  Trash2,
  UserPlus,
  Users,
  Vote,
  X,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Election {
  election_id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface ConstituencyInfo {
  coe_id: number;
  constituency_id: number;
  name: string;
  region: string;
  ro_name: string | null;
}

interface CenterInfo {
  poe_id: number;
  polling_center_id: number;
  name: string;
  address: string;
}

interface Officer {
  role_map_id: number;
  user_id: string;
  user_name: string;
}

interface Booth {
  id: number;
  booth_number: number;
  officers: Officer[];
}

interface AssignableUser {
  id: string;
  name: string;
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

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

// ── Add Officer Popover ──────────────────────────────────────────────────────

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

// ── Main Component ───────────────────────────────────────────────────────────

const AdminPollingCenterDetails: React.FC = () => {
  const { id, cId, centerId } = useParams();
  const navigate = useNavigate();

  // ── Data state ──────────────────────────────────────────────────────────
  const [election, setElection] = useState<Election | null>(null);
  const [constituency, setConstituency] = useState<ConstituencyInfo | null>(null);
  const [center, setCenter] = useState<CenterInfo | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Add booth dialog state ─────────────────────────────────────────────
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newBoothNumber, setNewBoothNumber] = useState('');
  const [addingBooth, setAddingBooth] = useState(false);

  // ── Edit booth state ───────────────────────────────────────────────────
  const [editingBoothId, setEditingBoothId] = useState<number | null>(null);
  const [editBoothNumber, setEditBoothNumber] = useState('');
  const [savingBooth, setSavingBooth] = useState(false);

  // ── Fetch data ─────────────────────────────────────────────────────────
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
      if (!res.ok) throw new Error('Failed to fetch constituency');
      const all: ConstituencyInfo[] = await res.json();
      const match = all.find((c) => String(c.constituency_id) === String(cId));
      if (match) setConstituency(match);
    } catch {
      // Non-critical
    }
  }, [id, cId]);

  const fetchCenter = useCallback(async () => {
    if (!id || !cId || !centerId) return;
    try {
      const res = await fetch(
        `${API}/polling_center_of_election/election/${id}/constituency/${cId}`
      );
      if (!res.ok) throw new Error('Failed to fetch center');
      const all: CenterInfo[] = await res.json();
      const match = all.find(
        (c) => String(c.polling_center_id) === String(centerId)
      );
      if (match) setCenter(match);
      else setError('Polling center not found');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load center');
    }
  }, [id, cId, centerId]);

  const fetchBooths = useCallback(async () => {
    if (!id || !centerId) return;
    try {
      const res = await fetch(
        `${API}/polling_booth/election/${id}/center/${centerId}`
      );
      if (!res.ok) throw new Error('Failed to fetch booths');
      setBooths(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load booths');
    }
  }, [id, centerId]);

  const fetchAssignableUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/users/assignable`);
      if (!res.ok) return;
      setAssignableUsers(await res.json());
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([
        fetchElection(),
        fetchConstituency(),
        fetchCenter(),
        fetchBooths(),
        fetchAssignableUsers(),
      ]);
      setLoading(false);
    })();
  }, [fetchElection, fetchConstituency, fetchCenter, fetchBooths, fetchAssignableUsers]);

  // ── Add booth ──────────────────────────────────────────────────────────
  const addBooth = async () => {
    if (!newBoothNumber || !centerId || !id) return;
    setAddingBooth(true);
    try {
      const res = await fetch(`${API}/polling_booth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booth_number: Number(newBoothNumber),
          polling_center_id: Number(centerId),
          election_id: Number(id),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add booth');
      }
      const newBooth = await res.json();
      setBooths((prev) => [...prev, newBooth]);
      setAddDialogOpen(false);
      setNewBoothNumber('');
      toast.success(`Booth #${newBooth.booth_number} created`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add booth');
    } finally {
      setAddingBooth(false);
    }
  };

  // ── Edit booth ─────────────────────────────────────────────────────────
  const startEditBooth = (booth: Booth) => {
    setEditingBoothId(booth.id);
    setEditBoothNumber(String(booth.booth_number));
  };

  const cancelEditBooth = () => {
    setEditingBoothId(null);
    setEditBoothNumber('');
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
        prev.map((b) =>
          b.id === editingBoothId
            ? { ...b, booth_number: updated.booth_number }
            : b
        )
      );
      setEditingBoothId(null);
      toast.success(`Booth renamed to #${updated.booth_number}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to rename booth');
    } finally {
      setSavingBooth(false);
    }
  };

  // ── Delete booth ───────────────────────────────────────────────────────
  const deleteBooth = async (boothId: number) => {
    try {
      const res = await fetch(`${API}/polling_booth/${boothId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete booth');
      setBooths((prev) => prev.filter((b) => b.id !== boothId));
      toast.success('Booth deleted');
    } catch {
      toast.error('Failed to delete booth');
    }
  };

  // ── Add officer ────────────────────────────────────────────────────────
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
        prev.map((b) =>
          b.id === boothId
            ? { ...b, officers: [...b.officers, officer] }
            : b
        )
      );
      toast.success(`${officer.user_name} assigned`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add officer');
    }
  };

  // ── Remove officer ─────────────────────────────────────────────────────
  const removeOfficer = async (boothId: number, roleMapId: number) => {
    try {
      const res = await fetch(`${API}/polling_booth/officer/${roleMapId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove officer');
      setBooths((prev) =>
        prev.map((b) =>
          b.id === boothId
            ? {
                ...b,
                officers: b.officers.filter((o) => o.role_map_id !== roleMapId),
              }
            : b
        )
      );
      toast.success('Officer removed');
    } catch {
      toast.error('Failed to remove officer');
    }
  };

  // ── Loading / Error ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error || !election || !center) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <p className="text-destructive">{error ?? 'Not found'}</p>
      </div>
    );
  }

  const cfg = statusConfig[election.status] ?? statusConfig.PLANNED;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* ── Back button ────────────────────────────────────────────────── */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2"
        onClick={() =>
          navigate(`/homeAdmin/showElection/${id}/constituency/${cId}`)
        }
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Constituency
      </Button>

      {/* ── Election Info Bar ──────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl shadow-sm p-6">
        <p className="text-primary text-xs font-bold uppercase tracking-wider mb-1">
          Election
        </p>
        <h2 className="text-2xl font-black tracking-tight">{election.name}</h2>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <Badge
            variant="outline"
            className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 ${cfg.className}`}
          >
            {cfg.label}
          </Badge>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDateShort(election.start_date)} –{' '}
            {formatDateShort(election.end_date)}
          </span>
        </div>
      </div>

      {/* ── Constituency Info Bar ──────────────────────────────────────── */}
      {constituency && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-5 py-3 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-primary shrink-0" />
          <h3 className="text-sm font-bold">
            Constituency: {constituency.name}
            <span className="text-muted-foreground font-normal ml-2">
              (Region: {constituency.region}
              {constituency.ro_name
                ? `, RO: ${constituency.ro_name}`
                : ''}
              )
            </span>
          </h3>
        </div>
      )}

      {/* ── Polling Center Info Card ───────────────────────────────────── */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-2">
          <Store className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-bold">Polling Center Information</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted/30 border rounded-lg p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Name</p>
            <p className="text-sm font-bold">{center.name}</p>
          </div>
          <div className="bg-muted/30 border rounded-lg p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Address</p>
            <p className="text-sm font-bold">{center.address}</p>
          </div>
        </div>
      </div>

      {/* ── Polling Booths Section ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Vote className="h-6 w-6 text-primary" />
            Polling Booths
          </h2>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add New Polling Booth
          </Button>
        </div>

        {booths.length === 0 ? (
          <div className="bg-card border rounded-xl shadow-sm p-12 text-center text-muted-foreground">
            <Vote className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No polling booths yet</p>
            <p className="text-xs mt-1">
              Click "Add New Polling Booth" to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {booths.map((booth) => {
              const isEditing = editingBoothId === booth.id;

              return (
                <div
                  key={booth.id}
                  className="bg-card border rounded-xl shadow-sm overflow-hidden"
                >
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
                          />
                          <Button
                            size="sm"
                            onClick={saveBoothRename}
                            disabled={savingBooth}
                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {savingBooth ? (
                              <Spinner className="size-3.5" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditBooth}
                            className="h-8"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <h3 className="text-lg font-bold">
                          Booth {booth.booth_number}
                        </h3>
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
                        onClick={() => startEditBooth(booth)}
                        title="Edit Booth"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete Booth"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Booth</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete{' '}
                              <strong>Booth #{booth.booth_number}</strong>? This
                              will also remove all officer assignments.
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
                  <div className="p-4">
                    {booth.officers.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic px-1">
                        No officers assigned yet. Click "Add Officer" above.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {booth.officers.map((officer, idx) => (
                          <div
                            key={officer.role_map_id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                                {getInitials(officer.user_name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate">
                                  {officer.user_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Polling Officer{idx > 0 ? ` ${idx}` : ''}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                removeOfficer(booth.id, officer.role_map_id)
                              }
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-2"
                              title="Remove officer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Booth Dialog ───────────────────────────────────────────── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Polling Booth</DialogTitle>
            <DialogDescription>
              Enter a booth number for the new polling booth.
            </DialogDescription>
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setAddDialogOpen(false);
                setNewBoothNumber('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={addBooth}
              disabled={!newBoothNumber || addingBooth}
            >
              {addingBooth ? (
                <Spinner className="size-4 mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Create Booth
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPollingCenterDetails;
