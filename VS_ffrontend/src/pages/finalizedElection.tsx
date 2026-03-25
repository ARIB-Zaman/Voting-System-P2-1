import React from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy } from 'lucide-react';

const FinalizedElection: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        className="mb-8 text-muted-foreground -ml-2"
        onClick={() => navigate('/homeAdmin')}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Elections
      </Button>

      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
          <Trophy className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">Election Finalized</h1>
          <p className="text-muted-foreground max-w-md">
            Election <span className="font-semibold">#{id}</span> has been finalized.
            Detailed results view coming soon.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FinalizedElection;
