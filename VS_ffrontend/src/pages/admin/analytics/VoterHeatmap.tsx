import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '@/lib/auth-client';
import { ListView } from '@/components/refine-ui/views/list-view';
import { Breadcrumb } from '@/components/refine-ui/layout/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Flame, MapPin, Users, Building2, Loader2, AlertTriangle, Info } from 'lucide-react';

// ── Fix leaflet default icon paths (Vite asset hashing issue) ──────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Custom polling-center icon ─────────────────────────────────────────────────
const centerIcon = new L.DivIcon({
  html: `<div style="
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    width: 36px; height: 36px; border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid #ffffff;
    box-shadow: 0 4px 15px rgba(99,102,241,0.5);
    display: flex; align-items: center; justify-content: center;
  ">
    <span style="
      transform: rotate(45deg);
      color: white; font-size: 16px; font-weight: bold; line-height: 1;
    ">📍</span>
  </div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -38],
});

// ── Types ──────────────────────────────────────────────────────────────────────
interface Election {
  election_id: number;
  name: string;
  status: string;
}

interface CenterPoint {
  id: number;
  name: string;
  lat: number;
  lng: number;
  currentVoterCount: number;
}

interface HeatmapData {
  voterPoints: [number, number][];
  centerPoints: CenterPoint[];
}

// ── HeatLayer Component (injects leaflet.heat dynamically) ─────────────────────
const HEAT_CDN =
  'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js';

interface HeatLayerProps {
  points: [number, number][];
}

function HeatLayer({ points }: HeatLayerProps) {
  const map = useMap();
  const heatRef = useRef<L.Layer | null>(null);

  const addHeat = useCallback(() => {
    // Remove old layer
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }
    if (points.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L_ = L as unknown as any;
    if (typeof L_.heatLayer === 'function') {
      const heat = L_.heatLayer(points, {
        radius: 25,
        blur: 20,
        maxZoom: 17,
        gradient: {
          0.0: '#313695',
          0.2: '#4575b4',
          0.4: '#74add1',
          0.5: '#abd9e9',
          0.6: '#fee090',
          0.7: '#fdae61',
          0.85: '#f46d43',
          1.0: '#d73027',
        },
      }).addTo(map);
      heatRef.current = heat;
    }
  }, [map, points]);

  // Load the CDN script once, then add the heat layer
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (L as unknown as any).heatLayer === 'function') {
      addHeat();
      return;
    }

    if (document.getElementById('leaflet-heat-script')) {
      // Script is being loaded — wait
      const interval = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (L as unknown as any).heatLayer === 'function') {
          clearInterval(interval);
          addHeat();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    const script = document.createElement('script');
    script.id = 'leaflet-heat-script';
    script.src = HEAT_CDN;
    script.async = true;
    script.onload = addHeat;
    document.head.appendChild(script);

    return () => {
      if (heatRef.current) map.removeLayer(heatRef.current);
    };
  }, [addHeat, map]);

  return null;
}

// ── FitBounds helper ───────────────────────────────────────────────────────────
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [map, points]);
  return null;
}

// ── Main Component ─────────────────────────────────────────────────────────────
const VoterHeatmap: React.FC = () => {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<string>('');
  const [heatData, setHeatData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingElections, setLoadingElections] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load election list ───────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch('/api/election')
      .then((r) => r.json())
      .then((data: Election[]) => {
        setElections(data);
        setLoadingElections(false);
      })
      .catch(() => setLoadingElections(false));
  }, []);

  // ── Load heatmap data when election changes ──────────────────────────────────
  useEffect(() => {
    if (!selectedElection) return;
    setLoading(true);
    setError(null);
    setHeatData(null);

    apiFetch(`/api/analytics/voter-heatmap/${selectedElection}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load heatmap data');
        return r.json();
      })
      .then((data: HeatmapData) => {
        setHeatData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Server error');
        setLoading(false);
      });
  }, [selectedElection]);

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalVoters = heatData?.voterPoints.length ?? 0;
  const totalCenters = heatData?.centerPoints.length ?? 0;
  const totalAllocated = heatData?.centerPoints.reduce(
    (s, c) => s + c.currentVoterCount,
    0
  ) ?? 0;

  // Map defaults: Bangladesh center
  const defaultCenter: [number, number] = [23.685, 90.356];

  return (
    <ListView>
      <Breadcrumb />

      <div className="p-6 space-y-6 animate-in fade-in duration-500">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg,#f97316 0%,#ef4444 100%)',
                boxShadow: '0 8px 24px rgba(249,115,22,0.35)',
              }}
            >
              <Flame className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Voter Density Heatmap
              </h1>
              <p className="text-sm text-muted-foreground">
                Geospatial analysis for polling center planning
              </p>
            </div>
          </div>

          {/* Election selector */}
          <div className="w-full sm:w-72">
            {loadingElections ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading elections…
              </div>
            ) : (
              <Select value={selectedElection} onValueChange={setSelectedElection}>
                <SelectTrigger className="border-2 border-primary/20 focus:border-primary/50 rounded-xl shadow-sm h-11">
                  <SelectValue placeholder="Select an election…" />
                </SelectTrigger>
                <SelectContent>
                  {elections.map((e) => (
                    <SelectItem key={e.election_id} value={e.election_id.toString()}>
                      <span className="flex items-center gap-2">
                        {e.name}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            e.status === 'ACTIVE'
                              ? 'border-green-500 text-green-600'
                              : 'border-muted-foreground/40'
                          }`}
                        >
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

        {/* ── Stat cards ─────────────────────────────────────────────────────── */}
        {selectedElection && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Voters on Map"
              value={totalVoters.toLocaleString()}
              color="from-blue-500 to-cyan-500"
            />
            <StatCard
              icon={<Building2 className="h-5 w-5" />}
              label="Polling Centers"
              value={totalCenters.toLocaleString()}
              color="from-violet-500 to-purple-500"
            />
            <StatCard
              icon={<MapPin className="h-5 w-5" />}
              label="Voters Allocated"
              value={totalAllocated.toLocaleString()}
              color="from-orange-500 to-red-500"
            />
          </div>
        )}

        {/* ── Map area ───────────────────────────────────────────────────────── */}
        <Card className="shadow-xl border-muted/20 overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-muted/10 to-transparent border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Live Heatmap
              {heatData && (
                <Badge variant="secondary" className="ml-auto font-mono text-xs">
                  {totalVoters.toLocaleString()} points
                </Badge>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {/* Legend */}
            {heatData && heatData.voterPoints.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-b bg-muted/5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/70">Legend:</span>
                <LegendItem color="#313695" label="Very Low" />
                <LegendItem color="#74add1" label="Low" />
                <LegendItem color="#fee090" label="Medium" />
                <LegendItem color="#f46d43" label="High" />
                <LegendItem color="#d73027" label="Very High" />
                <span className="ml-auto flex items-center gap-1.5">
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      display: 'inline-block',
                    }}
                  />
                  Polling Center
                </span>
              </div>
            )}

            {/* Map */}
            <div
              style={{ height: 520, position: 'relative' }}
              className="relative"
            >
              {/* Placeholder / Loading / Error overlay */}
              {!selectedElection && (
                <Overlay>
                  <Info className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-lg font-semibold text-muted-foreground">
                    Select an election to load the heatmap
                  </p>
                </Overlay>
              )}

              {loading && (
                <Overlay>
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
                  <p className="text-lg font-semibold text-muted-foreground">
                    Loading geospatial data…
                  </p>
                </Overlay>
              )}

              {error && (
                <Overlay>
                  <AlertTriangle className="h-12 w-12 text-destructive mb-3" />
                  <p className="text-lg font-semibold text-destructive">
                    {error}
                  </p>
                </Overlay>
              )}

              {heatData && heatData.voterPoints.length === 0 && (
                <Overlay>
                  <MapPin className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-lg font-semibold text-muted-foreground">
                    No voter coordinates found for this election
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ensure voters have lat/lng set in their records
                  </p>
                </Overlay>
              )}

              <MapContainer
                center={defaultCenter}
                zoom={7}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
                scrollWheelZoom
              >
                {/* Base tile - dark themed */}
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {heatData && heatData.voterPoints.length > 0 && (
                  <>
                    <HeatLayer points={heatData.voterPoints} />
                    <FitBounds
                      points={[
                        ...heatData.voterPoints,
                        ...heatData.centerPoints.map(
                          (c) => [c.lat, c.lng] as [number, number]
                        ),
                      ]}
                    />
                  </>
                )}

                {/* Polling center markers */}
                {heatData?.centerPoints.map((center) => (
                  <Marker
                    key={center.id}
                    position={[center.lat, center.lng]}
                    icon={centerIcon}
                  >
                    <Popup>
                      <div className="min-w-[160px]">
                        <p className="font-bold text-sm mb-1">{center.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Voters assigned:{' '}
                          <span className="font-semibold text-foreground">
                            {center.currentVoterCount.toLocaleString()}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Lat: {center.lat.toFixed(5)}, Lng:{' '}
                          {center.lng.toFixed(5)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        {/* ── Analysis insight card ────────────────────────────────────────────── */}
        {heatData && heatData.centerPoints.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-50/5 shadow-md">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">How to read this map</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    <strong>🔴 Red/orange areas</strong> indicate high voter
                    density. If a red cluster has{' '}
                    <strong>no purple marker nearby</strong>, it means that
                    region is underserved — a new polling center should be
                    added there.
                    <br />
                    <strong>💜 Purple markers</strong> are existing polling
                    centers. Hover over them to see how many voters are
                    currently allocated.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Center breakdown table ─────────────────────────────────────────── */}
        {heatData && heatData.centerPoints.length > 0 && (
          <Card className="shadow-lg border-muted/20">
            <CardHeader className="border-b bg-muted/5">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-violet-500" />
                Polling Center Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">
                        Center Name
                      </th>
                      <th className="text-right px-4 py-3 font-semibold">
                        Voters Allocated
                      </th>
                      <th className="text-right px-4 py-3 font-semibold">
                        Coordinates
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {heatData.centerPoints
                      .sort(
                        (a, b) => b.currentVoterCount - a.currentVoterCount
                      )
                      .map((c, i) => (
                        <tr
                          key={c.id}
                          className={`border-t transition-colors hover:bg-muted/20 ${
                            i % 2 === 0 ? 'bg-background' : 'bg-muted/5'
                          }`}
                        >
                          <td className="px-4 py-3 font-medium">{c.name}</td>
                          <td className="px-4 py-3 text-right">
                            <Badge
                              variant="secondary"
                              className={`font-mono ${
                                c.currentVoterCount === 0
                                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              }`}
                            >
                              {c.currentVoterCount.toLocaleString()}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                            {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ListView>
  );
};

// ── Small helpers ──────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="shadow-md border-muted/20 overflow-hidden">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-4">
          <div
            className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}
            style={{ boxShadow: undefined }}
          >
            <span className="text-white">{icon}</span>
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          background: color,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  );
}

export default VoterHeatmap;
