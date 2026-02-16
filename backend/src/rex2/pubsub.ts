import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export type Rex2SseEvent = {
  schema_version: 'rex.sse.v1';
  event_id: string;
  run_id: string;
  type:
    | 'run.started'
    | 'step.updated'
    | 'toolcall.logged'
    | 'artifact.created'
    | 'run.completed'
    | 'run.failed'
    | 'run.snapshot';
  ts: string;
  payload: Record<string, any>;
};

const bus = new EventEmitter();
bus.setMaxListeners(0);

function topic(runId: string) {
  return `rex2:run:${runId}`;
}

export function buildRex2Event(
  runId: string,
  type: Rex2SseEvent['type'],
  payload: Record<string, any>
): Rex2SseEvent {
  return {
    schema_version: 'rex.sse.v1',
    event_id: randomUUID(),
    run_id: runId,
    type,
    ts: new Date().toISOString(),
    payload
  };
}

export function publishRex2Event(event: Rex2SseEvent) {
  bus.emit(topic(event.run_id), event);
}

export function subscribeRex2Events(runId: string, cb: (event: Rex2SseEvent) => void) {
  const name = topic(runId);
  bus.on(name, cb);
  return () => bus.off(name, cb);
}

