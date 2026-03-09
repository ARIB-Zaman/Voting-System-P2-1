import React from 'react';
import { useParams } from 'react-router';
import PollingCenterDetailsContent from '../shared/PollingCenterDetailsContent';

const AdminPollingCenterDetails: React.FC = () => {
    const { id, cId, centerId } = useParams();

    return (
        <PollingCenterDetailsContent
            centerId={centerId!}
            backPath={`/homeAdmin/showElection/${id}/constituency/${cId}`}
            backLabel="Back to Constituency"
        />
    );
};

export default AdminPollingCenterDetails;
