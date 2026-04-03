import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, MapPin, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet marker icons in React
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
const DEFAULT_CENTER: [number, number] = [23.6850, 90.3563]; // Bangladesh center

interface Constituency {
  id: number;
  name: string;
}

// ----------------------------------------------------------------------
// Component: Map Click Handler
// Listens for clicks on the map and updates the marker/inputs.
// ----------------------------------------------------------------------
function MapClickHandler({ setCoordinates }: { setCoordinates: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      setCoordinates(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ----------------------------------------------------------------------
// Component: Map Center Updater
// Pans the map when the external coordinates exactly change via typing/search
// ----------------------------------------------------------------------
function MapCenterUpdater({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function AddPollingCenter() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [constituencyId, setConstituencyId] = useState('');
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    apiFetch(`${API}/constituency`)
      .then((r) => r.json())
      .then((data) => setConstituencies(data))
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load constituencies');
      });
  }, []);

  const resetForm = () => {
    setName('');
    setAddress('');
    setConstituencyId('');
    setLatStr('');
    setLngStr('');
    setMapCenter(null);
    setSearchQuery('');
  };

  const handleMapClick = (lat: number, lng: number) => {
    setLatStr(lat.toFixed(6));
    setLngStr(lng.toFixed(6));
  };

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const resultLat = parseFloat(data[0].lat);
        const resultLng = parseFloat(data[0].lon);
        setLatStr(resultLat.toFixed(6));
        setLngStr(resultLng.toFixed(6));
        setMapCenter([resultLat, resultLng]);
        toast.success('Location found!');
      } else {
        toast.error('Location not found');
      }
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const syncManualInput = (lStr: string, lnStr: string) => {
    setLatStr(lStr);
    setLngStr(lnStr);
    const pLat = parseFloat(lStr);
    const pLng = parseFloat(lnStr);
    if (!isNaN(pLat) && !isNaN(pLng)) {
      setMapCenter([pLat, pLng]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) { toast.error('Center name is required'); return; }
    if (!address.trim()) { toast.error('Address is required'); return; }
    if (!constituencyId) { toast.error('Please select a constituency'); return; }

    const payload = {
      name: name.trim(),
      address: address.trim(),
      constituency_id: Number(constituencyId),
      lat: latStr !== '' ? parseFloat(latStr) : null,
      lng: lngStr !== '' ? parseFloat(lngStr) : null,
    };

    setSubmitting(true);

    try {
      const res = await apiFetch(`${API}/admin-polling-centers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add polling center');
      toast.success(`Polling center "${data.name}" created successfully!`);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const currentMarker: [number, number] | null = (latStr !== '' && lngStr !== '' && !isNaN(parseFloat(latStr)) && !isNaN(parseFloat(lngStr))) 
    ? [parseFloat(latStr), parseFloat(lngStr)] 
    : null;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Add Polling Center</h1>
          <p className="text-sm text-muted-foreground">Register a new polling center with precise coordinate mapping</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Form Details */}
        <div className="lg:col-span-2 space-y-5 bg-card border rounded-xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5" id="add-center-form">
            
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="pc-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Center Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pc-name"
                placeholder="e.g. Central Community Hall"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="pc-address" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pc-address"
                placeholder="e.g. 45 Main Street, District 3"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Constituency */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Constituency <span className="text-destructive">*</span>
              </Label>
              <Select value={constituencyId} onValueChange={setConstituencyId}>
                <SelectTrigger id="pc-constituency">
                  <SelectValue placeholder={constituencies.length === 0 ? 'Loading…' : 'Select constituency…'} />
                </SelectTrigger>
                <SelectContent>
                  {constituencies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lat / Lng Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pc-lat" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Latitude
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="pc-lat"
                    className="pl-9 font-mono text-sm"
                    placeholder="23.8103"
                    type="number"
                    step="any"
                    value={latStr}
                    onChange={(e) => syncManualInput(e.target.value, lngStr)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-lang" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Longitude
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="pc-lang"
                    className="pl-9 font-mono text-sm"
                    placeholder="90.4125"
                    type="number"
                    step="any"
                    value={lngStr}
                    onChange={(e) => syncManualInput(latStr, e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                form="add-center-form"
                className="w-full bg-primary hover:bg-primary/90 font-bold"
                disabled={submitting}
              >
                {submitting ? <><Spinner className="size-4 mr-2" />Adding…</> : 'Save Polling Center'}
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: Interactive Map */}
        <div className="lg:col-span-3 bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
          {/* Map Search Bar */}
          <div className="p-3 border-b bg-muted/20 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search location to jump map..." 
                className="pl-9 border-muted-foreground/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
              />
            </div>
            <Button variant="secondary" onClick={searchLocation} disabled={searching}>
              {searching ? <Spinner className="size-4" /> : 'Search'}
            </Button>
          </div>

          {/* Leaflet Map Viewer */}
          <div className="flex-1 relative z-0">
            <MapContainer 
              center={DEFAULT_CENTER} 
              zoom={7} 
              scrollWheelZoom={true} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler setCoordinates={handleMapClick} />
              <MapCenterUpdater center={mapCenter} />
              {currentMarker && (
                <Marker position={currentMarker} />
              )}
            </MapContainer>
          </div>
          
          <div className="bg-muted/40 p-2 text-center text-xs text-muted-foreground border-t font-medium">
            Click anywhere on the map to meticulously set the precise Latitude and Longitude.
          </div>
        </div>

      </div>
    </div>
  );
}
