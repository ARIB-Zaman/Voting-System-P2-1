import React from 'react';
import { useParams } from 'react-router';
import ConstituencyDetailsContent from '../shared/ConstituencyDetailsContent';

const RoConstituencyDetails: React.FC = () => {
    const { cId } = useParams();

    return (
        <ConstituencyDetailsContent
            cId={cId!}
            backPath="/homeRO"
            backLabel="Back to Dashboard"
            viewCenterPath={(centerId) => `/homeRO/constituency/${cId}/polling-center/${centerId}`}
        />
    );
};

export default RoConstituencyDetails;
