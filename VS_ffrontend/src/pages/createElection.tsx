import { Breadcrumb } from '@/components/refine-ui/layout/breadcrumb'
import { ListView } from '@/components/refine-ui/views/list-view'
import { Card,  CardContent,  CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import React from 'react'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
} from "@/components/ui/field"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { toast } from "sonner"




const CreateElection = () => {
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")

  const [startDate, setStartDate] = React.useState<Date | undefined>()
  const [startTime, setStartTime] = React.useState("")

  const [endDate, setEndDate] = React.useState<Date | undefined>()
  const [endTime, setEndTime] = React.useState("")


  type ElectionStatus = "PLANNED" | "LIVE" | "CLOSED"

  function computeStatus(start: Date, end: Date): ElectionStatus {
    const now = new Date()

    if (now < start) return "PLANNED"
    if (now >= start && now <= end) return "LIVE"
    return "CLOSED"
  }

  const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault()

    if (!startDate || !endDate || !startTime || !endTime) {
      toast.error("Please fill in all date and time fields")
      return
    }

    const combineDateTime = (date: Date, time: string) => {
      const [hours, minutes] = time.split(":").map(Number)
      const result = new Date(date)
      result.setHours(hours, minutes, 0, 0)
      return result
    }

    const start = combineDateTime(startDate, startTime)
    const end = combineDateTime(endDate, endTime)

    // 🔴 VALIDATION HERE
    if (start >= end) {
      toast.error("Start date must be before end date", {
        description: "Please select a valid election duration."
      })
      return
    }

    const status = computeStatus(start, end)
    const payload = {
      name,
      description,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      status
    }

    console.log("Submitting:", payload)

    // API call goes here
    try {
      const res = await fetch("http://localhost:3001/api/election", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    
      if (!res.ok) {
        throw new Error("Failed to create election")
      }
    
      const data = await res.json()
      console.log("Success:", data)
    
      toast.success("Election created successfully")
    } catch (err) {
      console.error(err)
      toast.error("Failed to create election")
  }

  }
  
  return (
    <ListView>
        <Breadcrumb/>
        <div className='flex justify-center'>
        <Card className='max-w-2xl min-w-2xl flex justify-center'>
          <CardHeader >
            <CardTitle className='flex justify-center text-2xl'>Create New Election</CardTitle>       
          </CardHeader>
          <Separator/>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              

            <FieldSet>

              <FieldGroup>
                {/* Election Name */}
                <Field>
                  <FieldLabel htmlFor="name">Election Name</FieldLabel>
                  <Input
                    id="name"
                    placeholder="National Election 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    
                  />
                  <FieldDescription>
                    This name will be shown to voters.
                  </FieldDescription>
                </Field>

                {/* Description */}
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the election"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                {/* Start Date & Time */}
                <Field>
                  <FieldLabel className='flex justify-center'>Start Date & Time</FieldLabel>

                  <div className="space-y-2">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      className="rounded-lg border flex justify-center"
                    />

                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className='flex justify-center'
                      
                    />
                  </div>

                  <FieldDescription>
                    Election will open at this time.
                  </FieldDescription>
                </Field>

                {/* End Date & Time */}
                <Field>
                  <FieldLabel className='flex justify-center'>End Date & Time</FieldLabel>

                  <div className="space-y-2">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      className="rounded-lg border flex justify-center"
                    />

                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className='flex justify-center'
                      
                    />
                  </div>

                  <FieldDescription>
                    Election will close at this time.
                  </FieldDescription>
                </Field>
                </div>
              </FieldGroup>
            </FieldSet>
            
            <div className="flex justify-end">
              <Button type="submit" >Create Election</Button>
            </div>
          </form>
          </CardContent>
          <CardFooter>
            
          </CardFooter>
        </Card>
        </div>
    </ListView>
  )
}

export default CreateElection