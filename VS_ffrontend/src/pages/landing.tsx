import React, { Suspense, lazy, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { LogIn, UserPlus } from 'lucide-react';
import type { Application } from '@splinetool/runtime';

const Spline = lazy(() => import('@splinetool/react-spline'));

const LandingPage: React.FC = () => {
    const navigate = useNavigate();

    const handleSplineLoad = useCallback((splineApp: Application) => {
        // Zoom in so the characters fill the viewport
        splineApp.setZoom(1.4);
    }, []);

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#0a0a0f]">
            {/* ── Spline 3D Scene (receives all pointer events) ────────────── */}
            <div className="absolute inset-0 z-0">
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center h-full">
                            <Spinner className="size-8 text-white/30" />
                        </div>
                    }
                >
                    <Spline
                        scene="https://prod.spline.design/Br4QaL992SH0JNzu/scene.splinecode"
                        onLoad={handleSplineLoad}
                    />
                </Suspense>
            </div>

            {/* ── Gradient overlays (pointer-events-none so clicks pass through) */}
            <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/60" />
            <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-r from-black/30 via-transparent to-transparent" />

            {/* ── Content (pointer-events-none on wrapper, auto on buttons) ─── */}
            <div className="relative z-20 flex flex-col justify-between h-full px-8 md:px-16 py-10 pointer-events-none">
                {/* Top nav */}
                <nav className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                            <span className="text-white font-black text-sm">W</span>
                        </div>
                        <span className="text-white font-black text-xl tracking-tight">
                            Welec
                        </span>
                    </div>

                    <div className="flex items-center gap-3 pointer-events-auto">
                        <Button
                            variant="ghost"
                            className="text-white/80 hover:text-white hover:bg-white/10 font-medium"
                            onClick={() => navigate('/login')}
                        >
                            <LogIn className="h-4 w-4 mr-2" />
                            Sign In
                        </Button>
                        <Button
                            className="bg-white text-black hover:bg-white/90 font-bold px-5 shadow-lg shadow-white/10"
                            onClick={() => navigate('/signup')}
                        >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Sign Up
                        </Button>
                    </div>
                </nav>

                {/* Hero text — bottom-left */}
                <div className="max-w-xl mb-8">
                    <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-[0.95] mb-4">
                        <span className="bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent">
                            Welec
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-white/60 font-medium leading-relaxed max-w-md">
                        Next-generation election management platform.
                        Secure, transparent, and built for scale.
                    </p>

                    <div className="flex items-center gap-4 mt-8 pointer-events-auto">
                        <Button
                            size="lg"
                            className="bg-white text-black hover:bg-white/90 font-bold px-8 h-12 text-base shadow-xl shadow-white/10"
                            onClick={() => navigate('/signup')}
                        >
                            Get Started
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="border-white/20 text-white hover:bg-white/10 font-medium px-8 h-12 text-base"
                            onClick={() => navigate('/login')}
                        >
                            Sign In
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
