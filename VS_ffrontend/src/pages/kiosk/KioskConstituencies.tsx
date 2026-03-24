import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, ChevronRight, MapPin } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

interface Constituency {
  coe_id: number;
  constituency_id: number;
  name: string;
  region: string;
}

const KioskConstituencies: React.FC = () => {
  const { electionId } = useParams<{ electionId: string }>();
  const navigate = useNavigate();
  const [constituencies, setConstituencies] = useState<Constituency[] | null>(null);
  const [electionName, setElectionName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!electionId) return;
    Promise.all([
      fetch(`http://localhost:3001/api/election/${electionId}`).then((r) => r.json()),
      fetch(`http://localhost:3001/api/constituency_of_election/election/${electionId}`).then((r) => r.json()),
    ])
      .then(([election, cons]) => {
        setElectionName(election.name ?? '');
        setConstituencies(cons);
      })
      .catch((e) => setError(e.message));
  }, [electionId]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground" onClick={() => navigate('/kiosk')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Elections
      </Button>

      <div className="mb-8">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{electionName}</p>
        <h1 className="text-3xl font-black tracking-tight">Select Your Constituency</h1>
        <p className="text-muted-foreground mt-1">Choose the constituency where you are registered to vote.</p>
      </div>

      {!constituencies && !error && (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <Spinner className="size-5" /> Loading…
        </div>
      )}
      {error && <p className="text-center text-destructive py-16">{error}</p>}
      {constituencies?.length === 0 && (
        <p className="text-center text-muted-foreground py-16">No constituencies are configured for this election yet.</p>
      )}

      {constituencies && constituencies.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {constituencies.map((c) => (
            <button
              key={c.constituency_id}
              onClick={() => navigate(`/kiosk/election/${electionId}/constituency/${c.constituency_id}`)}
              className="text-left bg-card border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/50 hover:bg-primary/5 transition-all duration-150 flex items-start justify-between gap-3 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.region}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default KioskConstituencies;
