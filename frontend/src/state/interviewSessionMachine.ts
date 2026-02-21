export type InterviewSessionState =
  | 'IDLE'
  | 'USER_LISTENING'
  | 'USER_SPEAKING'
  | 'REX_THINKING'
  | 'REX_SPEAKING'
  | 'SESSION_COMPLETE';

export type InterviewSessionEvent =
  | 'START_SESSION'
  | 'USER_SPEECH_START'
  | 'USER_SPEECH_END'
  | 'REX_THINK_START'
  | 'REX_THINK_END'
  | 'REX_SPEECH_START'
  | 'REX_SPEECH_END'
  | 'END_SESSION'
  | 'RESET';

type TransitionMap = Record<InterviewSessionState, Partial<Record<InterviewSessionEvent, InterviewSessionState>>>;

const transitionMap: TransitionMap = {
  IDLE: {
    START_SESSION: 'USER_LISTENING',
    END_SESSION: 'SESSION_COMPLETE',
  },
  USER_LISTENING: {
    USER_SPEECH_START: 'USER_SPEAKING',
    REX_THINK_START: 'REX_THINKING',
    END_SESSION: 'SESSION_COMPLETE',
    RESET: 'IDLE',
  },
  USER_SPEAKING: {
    USER_SPEECH_END: 'USER_LISTENING',
    REX_THINK_START: 'REX_THINKING',
    END_SESSION: 'SESSION_COMPLETE',
    RESET: 'IDLE',
  },
  REX_THINKING: {
    REX_THINK_END: 'USER_LISTENING',
    REX_SPEECH_START: 'REX_SPEAKING',
    END_SESSION: 'SESSION_COMPLETE',
    RESET: 'IDLE',
  },
  REX_SPEAKING: {
    REX_SPEECH_END: 'USER_LISTENING',
    END_SESSION: 'SESSION_COMPLETE',
    RESET: 'IDLE',
  },
  SESSION_COMPLETE: {
    RESET: 'IDLE',
  },
};

export function getNextInterviewSessionState(
  currentState: InterviewSessionState,
  event: InterviewSessionEvent
): InterviewSessionState {
  return transitionMap[currentState][event] ?? currentState;
}

export function createInterviewSessionMachine(initialState: InterviewSessionState = 'IDLE') {
  let currentState = initialState;

  return {
    get currentState() {
      return currentState;
    },
    transition(event: InterviewSessionEvent) {
      currentState = getNextInterviewSessionState(currentState, event);
      return currentState;
    },
    reset() {
      currentState = 'IDLE';
      return currentState;
    },
  };
}
