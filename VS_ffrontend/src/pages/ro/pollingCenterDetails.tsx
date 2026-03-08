import React from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Building2 } from 'lucide-react';

const PollingCenterDetails: React.FC = () => {
    const { cId, centerId } = useParams();
    const navigate = useNavigate();

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <Button
                variant="ghost"
                size="sm"
                className="mb-4 text-muted-foreground -ml-2"
                onClick={() => navigate(`/homeRO/constituency/${cId}`)}
            >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Constituency
            </Button>

            <Card>
                <CardContent className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                            <Building2 className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tight">
                            Polling Center Details
                        </h2>
                        <p className="text-muted-foreground text-sm max-w-md">
                            Polling Center #{centerId} — detailed view coming soon.
                            This page will show voter lists, turnout data, and
                            activity logs for this polling center.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PollingCenterDetails;
