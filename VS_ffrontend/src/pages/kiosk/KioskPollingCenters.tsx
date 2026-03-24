import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Building2, ChevronRight, MapPin } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

interface PollingCenter {
  poe_id: number;
  polling_center_id: number;
  name: string;
  address: string;
}

const KioskPollingCenters: React.FC = () => {
  const { electionId, constituencyId } = useParams<{ electionId: string; constituencyId: string }>();
  const navigate = useNavigate();
  const [centers, setCenters] = useState<PollingCenter[] | null>(null);
  const [constituencyName, setConstituencyName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!electionId || !constituencyId) return;
    Promise.all([
      fetch(`http://localhost:3001/api/constituency_of_election/election/${electionId}`).then((r) => r.json()),
      fetch(`http://localhost:3001/api/polling_center_of_election/election/${electionId}/constituency/${constituencyId}`).then((r) => r.json()),
    ])
      .then(([cons, pcs]) => {
        const match = cons.find((c: any) => String(c.constituency_id) === String(constituencyId));
        setConstituencyName(match?.name ?? '');
        setCenters(pcs);
      })
      .catch((e) => setError(e.message));
  }, [electionId, constituencyId]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Button
        variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground"
        onClick={() => navigate(`/kiosk/election/${electionId}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Constituencies
      </Button>

      <div className="mb-8">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{constituencyName}</p>
        <h1 className="text-3xl font-black tracking-tight">Select Your Polling Center</h1>
        <p className="text-muted-foreground mt-1">Find the polling center where you have been registered.</p>
      </div>

      {!centers && !error && (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <Spinner className="size-5" /> Loading…
        </div>
      )}
      {error && <p className="text-center text-destructive py-16">{error}</p>}
      {centers?.length === 0 && (
        <p className="text-center text-muted-foreground py-16">No polling centers configured for this constituency yet.</p>
      )}

      {centers && centers.length > 0 && (
        <div className="space-y-3">
          {centers.map((pc) => (
            <button
              key={pc.polling_center_id}
              onClick={() => navigate(`/kiosk/election/${electionId}/constituency/${constituencyId}/center/${pc.polling_center_id}`)}
              className="w-full text-left bg-card border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/50 hover:bg-primary/5 transition-all duration-150 flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold">{pc.name}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {pc.address}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default KioskPollingCenters;
