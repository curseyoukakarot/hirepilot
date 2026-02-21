import { useCallback, useRef, useState } from 'react';

export function useUserMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const request = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'This browser does not support microphone access.';
      setError(message);
      throw new Error(message);
    }
    setIsRequesting(true);
    setError(null);
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = nextStream;
      setStream(nextStream);
      return nextStream;
    } catch (err: any) {
      const message = err?.message || 'Failed to access microphone.';
      setError(message);
      throw err;
    } finally {
      setIsRequesting(false);
    }
  }, []);

  const stop = useCallback(() => {
    const current = streamRef.current;
    if (current) {
      current.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    setStream(null);
  }, []);

  return { stream, error, isRequesting, request, stop };
}
