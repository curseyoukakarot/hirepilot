import { useCallback, useEffect, useRef, useState } from 'react';

type MicStatus = 'granted' | 'denied' | 'streaming' | 'prompt';

export function useUserMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [micStatus, setMicStatus] = useState<MicStatus>('prompt');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let mounted = true;
    void navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((result) => {
        if (!mounted) return;
        setMicStatus(result.state as MicStatus);
        result.onchange = () => setMicStatus(result.state as MicStatus);
      })
      .catch(() => {
        // no-op fallback for unsupported permissions API.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const request = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'This browser does not support microphone access.';
      setError(message);
      throw new Error(message);
    }
    setIsRequesting(true);
    setMicStatus('prompt');
    setError(null);
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = nextStream;
      setStream(nextStream);
      setMicStatus('streaming');
      return nextStream;
    } catch (err: any) {
      const message = err?.message || 'Failed to access microphone.';
      setError(message);
      setMicStatus('denied');
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
    setMicStatus('granted');
  }, []);

  return { stream, error, isRequesting, micStatus, request, stop };
}
