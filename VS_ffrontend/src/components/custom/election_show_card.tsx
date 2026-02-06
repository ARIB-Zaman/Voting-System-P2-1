import React from 'react'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { CalendarClock, ShieldCheck, TimerOff, Vote } from 'lucide-react';
import { ShowButton } from '../refine-ui/buttons/show';


const ElectionCard = ({election}) => {
    const icons = {
        /*
    PLANNED: <CalendarClock className="text-blue-500" />,
    LIVE: <Vote className="text-green-500" />,
    CLOSED: <TimerOff className="text-amber-500" />,
    FINALIZED: <ShieldCheck className="text-slate-500" />,
    */
       PLANNED: <CalendarClock/>,
       LIVE: <Vote />,
       CLOSED: <TimerOff />,
       FINALIZED: <ShieldCheck />,
    };
  return (
  <Card>
    <CardHeader>
        <CardTitle className='text-2xl'>{election.name}</CardTitle>
        <CardDescription>
            <h1>Start Date: {new Date(election.start_date).toLocaleString('en-US', { 
                timeZone: 'UTC',
                dateStyle: 'medium',
                timeStyle: 'short'
            })}</h1>
            <h1>End Date: {new Date(election.end_date).toLocaleString('en-US', { 
                timeZone: 'UTC',
                dateStyle: 'medium',
                timeStyle: 'short'
            })}</h1>
        </CardDescription>
        <CardAction>
            <ShowButton resource='election' recordItemId={election.election_id}>Details</ShowButton>
        </CardAction>
    </CardHeader>

   
    <CardFooter>
        
        {icons[election.status]}
        <p className='p-2'>{election.status}</p>
        
    </CardFooter>
</Card>
  )
}

export default ElectionCard