import { useCallback, useRef, useState } from 'react';

type VoiceSessionOptions = {
  onRexAudioStart?: () => void;
  onRexAudioEnd?: () => void;
  onRexThinkStart?: () => void;
  onRexThinkEnd?: () => void;
};

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.host.endsWith('thehirepilot.com')
    ? 'https://api.thehirepilot.com'
    : 'http://localhost:8080');

export function useVoiceSession(options: VoiceSessionOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rexStream, setRexStream] = useState<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const stopRexStub = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (oscRef.current) {
      oscRef.current.stop();
      oscRef.current.disconnect();
      oscRef.current = null;
    }
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    options.onRexAudioEnd?.();
    setRexStream(null);
  }, [options]);

  const triggerStubRexSpeech = useCallback(() => {
    stopRexStub();
    options.onRexThinkStart?.();

    timeoutRef.current = window.setTimeout(() => {
      options.onRexThinkEnd?.();
      options.onRexAudioStart?.();

      const context = new AudioContext();
      const destination = context.createMediaStreamDestination();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 180;
      gain.gain.value = 0.15;

      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();

      audioContextRef.current = context;
      oscRef.current = oscillator;
      gainRef.current = gain;
      setRexStream(destination.stream);

      timeoutRef.current = window.setTimeout(() => {
        stopRexStub();
      }, 2200);
    }, 850);
  }, [options, stopRexStub]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch interview token');
      }
      await response.json();
      setConnected(true);
      triggerStubRexSpeech();
    } catch (err: any) {
      setConnected(false);
      setError(err?.message || 'Unable to connect voice session');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [triggerStubRexSpeech]);

  const disconnect = useCallback(() => {
    setConnected(false);
    stopRexStub();
  }, [stopRexStub]);

  return {
    connected,
    isConnecting,
    error,
    rexStream,
    connect,
    disconnect,
    triggerStubRexSpeech,
  };
}
