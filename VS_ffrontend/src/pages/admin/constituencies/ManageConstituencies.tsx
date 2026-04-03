import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Earth, Search, Edit, Trash2, MapPin } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
} from '@/components/ui/alert-dialog';

import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { apiFetch } from '@/lib/auth-client';
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;


const API = '/api';
const DEFAULT_CENTER: [number, number] = [23.6850, 90.3563]; // Bangladesh

// --- Map Helpers ---
function MapClickHandler({ setCoordinates }: { setCoordinates: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      setCoordinates(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterUpdater({ center }: { center: [number, number] | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (center && map) {
      map.setView(center, map.getZoom(), { animate: false });
    }
  }, [center, map]);
  return null;
}

interface Constituency {
  id: number;
  name: string;
  region: string;
  lat: number | null;
  lng: number | null;
}

export default function ManageConstituencies() {
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    id: 0,
    name: '',
    region: '',
    lat: '',
    lng: '',
  });
  const [editMapCenter, setEditMapCenter] = useState<[number, number] | null>(null);

  // Delete Alert State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------
  const fetchConstituencies = async () => {
    try {
      const res = await apiFetch(`${API}/constituency`);
      const data = await res.json();
      setConstituencies(data);
    } catch (err) {
      toast.error('Failed to load constituencies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConstituencies();
  }, []);

  const filtered = constituencies.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.region.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --------------------------------------------------------------------------
  // Map Syncing for Edit
  // --------------------------------------------------------------------------
  const syncManualInput = (lStr: string, lnStr: string) => {
    setEditForm(prev => ({ ...prev, lat: lStr, lng: lnStr }));
    const pLat = parseFloat(lStr);
    const pLng = parseFloat(lnStr);
    if (!isNaN(pLat) && !isNaN(pLng)) {
      setEditMapCenter([pLat, pLng]);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setEditForm(prev => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
  };

  // --------------------------------------------------------------------------
  // Edit Handlers
  // --------------------------------------------------------------------------
  const openEdit = (cons: Constituency) => {
    setEditForm({
      id: cons.id,
      name: cons.name,
      region: cons.region,
      lat: cons.lat != null ? String(cons.lat) : '',
      lng: cons.lng != null ? String(cons.lng) : '',
    });
    
    if (cons.lat != null && cons.lng != null) {
      setEditMapCenter([cons.lat, cons.lng]);
    } else {
      setEditMapCenter(DEFAULT_CENTER);
    }

    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.region.trim()) {
      toast.error('Name and region are required');
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await apiFetch(`${API}/constituency/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          region: editForm.region,
          lat: editForm.lat ? parseFloat(editForm.lat) : null,
          lng: editForm.lng ? parseFloat(editForm.lng) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success('Constituency updated seamlessly');
      setEditOpen(false);
      fetchConstituencies();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Delete Handlers
  // --------------------------------------------------------------------------
  const confirmDelete = (id: number) => {
    setDeleteId(id);
    setDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await apiFetch(`${API}/constituency/${deleteId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success('Constituency deleted');
      setConstituencies(prev => prev.filter(c => c.id !== deleteId));
    } catch (err: any) {
      toast.error(err.message); // Will bubble up FOREIGN KEY block errors safely
    } finally {
      setDeleteOpen(false);
      setDeleteId(null);
    }
  };

  const editMarker: [number, number] | null = 
    (editForm.lat !== '' && editForm.lng !== '' && !isNaN(parseFloat(editForm.lat)) && !isNaN(parseFloat(editForm.lng))) 
      ? [parseFloat(editForm.lat), parseFloat(editForm.lng)] 
      : null;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Earth className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Manage Constituencies</h1>
            <p className="text-sm text-muted-foreground">View, edit, and safely manage electoral zones</p>
          </div>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or region..."
            className="pl-9 bg-card border-muted"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card border rounded-xl shadow-sm overflow-hidden min-h-[500px]">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold uppercase text-xs">ID</TableHead>
              <TableHead className="font-bold uppercase text-xs">Constituency Name</TableHead>
              <TableHead className="font-bold uppercase text-xs">Region</TableHead>
              <TableHead className="font-bold uppercase text-xs text-right">Coordinates</TableHead>
              <TableHead className="font-bold uppercase text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <Spinner className="size-6 mx-auto mb-2 opacity-50" />
                  Loading constituencies...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No constituencies found matching "{searchTerm}"
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">#{c.id}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.region}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {c.lat != null && c.lng != null ? `${c.lat}, ${c.lng}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="h-8 px-2">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => confirmDelete(c.id)} className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- EDIT MODAL --- */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 flex flex-col h-[85vh] sm:h-auto max-h-[800px]">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Edit Constituency</DialogTitle>
            <DialogDescription>
              Update the region details and map coordinates.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitEdit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Region</Label>
              <Input
                value={editForm.region}
                onChange={(e) => setEditForm(f => ({ ...f, region: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               {/* Lat / Lng Inputs */}
               <div className="space-y-1.5">
                <Label htmlFor="cons-lat" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Latitude
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9 font-mono text-sm"
                    type="number" step="any"
                    value={editForm.lat}
                    onChange={(e) => syncManualInput(e.target.value, editForm.lng)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cons-lng" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Longitude
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9 font-mono text-sm"
                    type="number" step="any"
                    value={editForm.lng}
                    onChange={(e) => syncManualInput(editForm.lat, e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="h-[250px] border rounded-xl overflow-hidden mt-4 relative z-0">
               {editOpen && (
                 <MapContainer 
                  center={editMapCenter || DEFAULT_CENTER} 
                  zoom={9} 
                  style={{ height: '100%', width: '100%' }}
                 >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapClickHandler setCoordinates={handleMapClick} />
                  <MapCenterUpdater center={editMapCenter} />
                  {editMarker && <Marker position={editMarker} />}
                </MapContainer>
               )}
            </div>
            
            <div className="bg-muted/40 p-2 text-center text-xs text-muted-foreground border rounded">
              Click the map to update the coordinates
            </div>
          </form>

          <div className="px-6 py-4 border-t bg-muted/20 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={submitEdit} disabled={editSubmitting}>
              {editSubmitting ? <Spinner className="size-4" /> : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- DELETE ALERTT --- */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected constituency.
              <br/><br/>
              <span className="font-semibold text-destructive">
                Note: Deletion will be rejected if this constituency is linked to active elections or polling centers.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
