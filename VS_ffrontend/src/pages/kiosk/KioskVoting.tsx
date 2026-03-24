import React from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KioskVoting: React.FC = () => {
  const { electionId, constituencyId, centerId, boothId } = useParams<{
    electionId: string;
    constituencyId: string;
    centerId: string;
    boothId: string;
  }>();
  const navigate = useNavigate();

  const breadcrumbs = [
    { label: 'Election', value: `#${electionId}` },
    { label: 'Constituency', value: `#${constituencyId}` },
    { label: 'Center', value: `#${centerId}` },
    { label: 'Booth', value: `#${boothId}` },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Button
        variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground"
        onClick={() => navigate(`/kiosk/election/${electionId}/constituency/${constituencyId}/center/${centerId}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Booths
      </Button>

      {/* Breadcrumb trail */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {breadcrumbs.map((b, i) => (
          <React.Fragment key={b.label}>
            <div className="bg-muted/60 border rounded-lg px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">{b.label}: </span>
              <span className="font-bold">{b.value}</span>
            </div>
            {i < breadcrumbs.length - 1 && <span className="text-muted-foreground text-xs">›</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Placeholder */}
      <div className="bg-card border rounded-2xl shadow-sm p-12 md:p-20 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 mb-6">
          <Construction className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-black tracking-tight mb-2">Voting Interface</h2>
        <p className="text-muted-foreground max-w-sm">
          The voting interface is under construction. This placeholder confirms correct navigation to the voting step.
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground border rounded-lg px-4 py-2 bg-muted/40">
          <Construction className="h-3.5 w-3.5" />
          Booth #{boothId} · Election #{electionId}
        </div>
      </div>
    </div>
  );
};

export default KioskVoting;
