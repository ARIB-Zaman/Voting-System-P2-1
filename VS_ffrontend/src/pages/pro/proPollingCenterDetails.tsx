import React from 'react';
import { useParams } from 'react-router';
import PollingCenterDetailsContent from '../shared/PollingCenterDetailsContent';

const ProPollingCenterDetails: React.FC = () => {
    const { centerId } = useParams();

    return (
        <PollingCenterDetailsContent
            centerId={centerId!}
            backPath="/homePRO"
            backLabel="Back to Dashboard"
        />
    );
};

export default ProPollingCenterDetails;
