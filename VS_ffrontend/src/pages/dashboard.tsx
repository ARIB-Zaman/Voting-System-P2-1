import ElectionCard from '@/components/custom/election_show_card';
import { ShowButton } from '@/components/refine-ui/buttons/show';
import { ListView, ListViewHeader } from '@/components/refine-ui/views/list-view';
import React, { useEffect, useState } from 'react'

const Dashboard = () => {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch("http://localhost:3001/api/election")
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Failed to fetch");
                }
                return res.json();
            })
            .then((json) => setData(json))
            .catch((err) => setError(err.message));
    }, []);

  //  <h1 className='text-4xl font-bold'>Elections</h1>
  return (
    <ListView>
      <div>
        <ListViewHeader/>
      </div>
        {error && <pre className="text-red-600">{error}</pre>}

        {!data && !error && <p>Loading...</p>}

        {data &&
          data.map((election)=>(
            <ElectionCard
              key={election.election_id}
              election={election}
            />
          )) 
        }  
    </ListView>
  )
}

export default Dashboard