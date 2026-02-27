import React from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin } from 'lucide-react';

const ConstituencyDetails: React.FC = () => {
    const { id, cId } = useParams();
    const navigate = useNavigate();

    return (
        
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <Button
                variant="ghost"
                size="sm"
                className="mb-4 text-muted-foreground -ml-2"
                onClick={() => navigate(`/homeAdmin/showElection/${id}`)}
            >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Election
            </Button>

            <div className="bg-card border rounded-xl shadow-sm p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <MapPin className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight">
                        Constituency Details
                    </h2>
                    <p className="text-muted-foreground text-sm max-w-md">
                        Constituency #{cId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ConstituencyDetails;
