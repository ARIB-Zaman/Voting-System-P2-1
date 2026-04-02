import React from 'react';
import { Outlet, useNavigate } from 'react-router';
import { Globe, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VoterPortalLayout: React.FC = () => {
  const navigate = useNavigate();
  const voterNid = sessionStorage.getItem('voterNid');

  const handleLogout = () => {
    sessionStorage.removeItem('voterNid');
    navigate('/voter-portal');
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/voter-portal')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Globe className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tighter leading-none">VOTER PORTAL</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">National Election Service</span>
            </div>
          </button>

          {voterNid && (
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-right">
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none">Accessing as NID</p>
                <p className="text-sm font-black tracking-tighter">{voterNid}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2 font-bold text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Exit Portal
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="py-6 border-t bg-card/50 text-center text-xs font-medium text-muted-foreground">
        <p>&copy; 2026 Election Commission. Secure Voter Self-Service Portal.</p>
      </footer>
    </div>
  );
};

export default VoterPortalLayout;
