import React, { useEffect, useState } from 'react';
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
import { Building2, MapPin } from 'lucide-react';

const API = 'http://localhost:3001/api';

interface Constituency {
  id: number;
  name: string;
}

const EMPTY_FORM = {
  name: '',
  address: '',
  constituency_id: '',
  lat: '',
  lang: '',
};

const AddPollingCenter: React.FC = () => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [constituencyId, setConstituencyId] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API}/constituency`)
      .then((r) => r.json())
      .then((data) => {
        console.log('Constituencies loaded:', data);
        setConstituencies(data);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load constituencies');
      });
  }, []);

  const resetForm = () => {
    setName('');
    setAddress('');
    setConstituencyId('');
    setLat('');
    setLng('');
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
      lat: lat !== '' ? parseFloat(lat) : null,
      lng: lng !== '' ? parseFloat(lng) : null,
    };

    console.log('Submitting payload:', payload);
    setSubmitting(true);

    try {
      const res = await fetch(`${API}/admin-polling-centers`, {
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

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Add Polling Center</h1>
          <p className="text-sm text-muted-foreground">Register a new polling center to the master list</p>
        </div>
      </div>

      <div className="bg-card border rounded-xl shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

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
                  <SelectItem
                    key={c.id}
                    value={String(c.id)}
                  >
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {constituencies.length === 0 && (
              <p className="text-xs text-muted-foreground">No constituencies loaded yet.</p>
            )}
          </div>

          {/* Lat / Lang */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pc-lat" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Latitude
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="pc-lat"
                  className="pl-9"
                  placeholder="e.g. 23.8103"
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
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
                  className="pl-9"
                  placeholder="e.g. 90.4125"
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                />
              </div>
            </div>
          </div>


          <div className="pt-2">
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 font-bold"
              disabled={submitting}
            >
              {submitting
                ? <><Spinner className="size-4 mr-2" />Adding…</>
                : 'Add Polling Center'
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPollingCenter;
