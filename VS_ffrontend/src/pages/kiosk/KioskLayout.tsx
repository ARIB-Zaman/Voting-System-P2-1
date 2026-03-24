import React from 'react';
import { Outlet, useNavigate } from 'react-router';
import { Vote } from 'lucide-react';

const KioskLayout: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/kiosk')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Vote className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-black text-lg tracking-tight">Welec Kiosk</span>
          </button>
          <span className="text-muted-foreground text-sm ml-auto">Voter Self-Service Terminal</span>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default KioskLayout;
