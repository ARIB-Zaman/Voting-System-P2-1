import { ShowView, ShowViewHeader } from '@/components/refine-ui/views/show-view'
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router';


interface Election {
  election_id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  description?: string;
}

const ElectionDetailsAD = () => {
  const { id } = useParams(); // get the :id from the URL
  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    fetch(`http://localhost:3001/api/election/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch election");
        return res.json();
      })
      .then((data) => setElection(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

    if (loading) return <p>Loading...</p>;
    if (error) return <p className="text-red-600">{error}</p>;
    if (!election) return <p>No election found</p>;

  return (
    <ShowView>
      <ShowViewHeader/>
      <Card>
        <CardHeader>
          <h1 className='text-3xl font-bold'>{election.name}</h1>
          <p>{election.status}</p>
        </CardHeader>
        <CardContent>
          <p className='text-slate-500'>{election.start_date}</p>
          <p className='text-slate-500'>{election.end_date}</p>
          
        </CardContent>
      </Card>
    </ShowView>
  )
}

export default ElectionDetailsAD