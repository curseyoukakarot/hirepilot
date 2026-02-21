import { useCallback, useMemo, useState } from 'react';
import {
  createInterviewSessionMachine,
  type InterviewSessionEvent,
  type InterviewSessionState,
} from '../state/interviewSessionMachine';

export function useInterviewSessionMachine(initialState: InterviewSessionState = 'IDLE') {
  const machine = useMemo(() => createInterviewSessionMachine(initialState), [initialState]);
  const [currentState, setCurrentState] = useState<InterviewSessionState>(machine.currentState);

  const transition = useCallback(
    (event: InterviewSessionEvent) => {
      const next = machine.transition(event);
      setCurrentState(next);
      return next;
    },
    [machine]
  );

  return { currentState, transition };
}
