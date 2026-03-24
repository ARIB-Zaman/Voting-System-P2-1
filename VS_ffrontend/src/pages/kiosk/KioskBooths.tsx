import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Hash, Vote } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

interface Booth {
  id: number;
  booth_number: number;
}

const KioskBooths: React.FC = () => {
  const { electionId, constituencyId, centerId } = useParams<{
    electionId: string;
    constituencyId: string;
    centerId: string;
  }>();
  const navigate = useNavigate();
  const [booths, setBooths] = useState<Booth[] | null>(null);
  const [centerName, setCenterName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!electionId || !constituencyId || !centerId) return;
    Promise.all([
      fetch(`http://localhost:3001/api/polling_center_of_election/election/${electionId}/constituency/${constituencyId}`).then((r) => r.json()),
      fetch(`http://localhost:3001/api/polling_booth/election/${electionId}/center/${centerId}`).then((r) => r.json()),
    ])
      .then(([pcs, booths]) => {
        const match = pcs.find((pc: any) => String(pc.polling_center_id) === String(centerId));
        setCenterName(match?.name ?? '');
        setBooths(booths);
      })
      .catch((e) => setError(e.message));
  }, [electionId, constituencyId, centerId]);

  const handleBoothSelect = (boothId: number) => {
    navigate(`/kiosk/election/${electionId}/constituency/${constituencyId}/center/${centerId}/booth/${boothId}/vote`);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Button
        variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground"
        onClick={() => navigate(`/kiosk/election/${electionId}/constituency/${constituencyId}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Polling Centers
      </Button>

      <div className="mb-8">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{centerName}</p>
        <h1 className="text-3xl font-black tracking-tight">Select Your Polling Booth</h1>
        <p className="text-muted-foreground mt-1">Choose the booth number shown on your voter slip.</p>
      </div>

      {!booths && !error && (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <Spinner className="size-5" /> Loading…
        </div>
      )}
      {error && <p className="text-center text-destructive py-16">{error}</p>}
      {booths?.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Vote className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-bold">No booths configured for this center yet.</p>
          <p className="text-sm mt-1">Please speak to a polling officer.</p>
        </div>
      )}

      {booths && booths.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {booths.map((b) => (
            <button
              key={b.id}
              onClick={() => handleBoothSelect(b.id)}
              className="aspect-square bg-card border rounded-2xl shadow-sm hover:shadow-lg hover:border-primary hover:bg-primary/5 transition-all duration-150 flex flex-col items-center justify-center gap-2 group"
            >
              <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <Hash className="h-7 w-7" />
              </div>
              <p className="font-black text-2xl group-hover:text-primary transition-colors">{b.booth_number}</p>
              <p className="text-xs text-muted-foreground">Booth</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default KioskBooths;
