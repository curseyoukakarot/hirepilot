import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface Candidate {
  id: string;
  name: string;
  stage: string;
}

const stages = ['sourced', 'interview', 'offer'];

export default function JobPipelinePage() {
  const { id } = useParams<{ id: string }>();
  const [candidates, setCandidates] = useState<Candidate[]>([
    { id: '1', name: 'Alice', stage: 'sourced' },
    { id: '2', name: 'Bob', stage: 'interview' },
  ]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const candidateId = result.draggableId;
    const newStage = result.destination.droppableId;
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, stage: newStage } : c))
    );
    await fetch(`/api/jobs/${id}/candidates/${candidateId}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    });
    await fetch('/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'stage_moved',
        job_id: id,
        actor_id: 'actor',
        payload: { candidate_id: candidateId, stage: newStage },
      }),
    });
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Pipeline</h1>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4">
          {stages.map((stage) => (
            <Droppable droppableId={stage} key={stage}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="bg-gray-100 rounded p-4 w-64 min-h-[200px]"
                >
                  <h2 className="font-medium mb-2 capitalize">{stage}</h2>
                  {candidates
                    .filter((c) => c.stage === stage)
                    .map((c, index) => (
                      <Draggable key={c.id} draggableId={c.id} index={index}>
                        {(prov) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            className="bg-white p-2 rounded mb-2 shadow"
                          >
                            {c.name}
                          </div>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
