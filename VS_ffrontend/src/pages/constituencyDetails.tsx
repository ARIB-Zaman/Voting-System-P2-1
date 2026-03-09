import React from 'react';
import { useParams } from 'react-router';
import ConstituencyDetailsContent from './shared/ConstituencyDetailsContent';

const ConstituencyDetails: React.FC = () => {
    const { id, cId } = useParams();

    return (
        <ConstituencyDetailsContent
            cId={cId!}
            backPath={`/homeAdmin/showElection/${id}`}
            backLabel="Back to Election"
            viewCenterPath={(centerId) => `/homeAdmin/showElection/${id}/constituency/${cId}/polling-center/${centerId}`}
        />
    );
};

export default ConstituencyDetails;
