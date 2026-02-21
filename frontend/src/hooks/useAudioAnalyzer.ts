import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  smoothingFactor?: number;
  fftSize?: number;
  autoStart?: boolean;
};

export function useAudioAnalyzer(stream: MediaStream | null, opts: Options = {}) {
  const smoothingFactor = opts.smoothingFactor ?? 0.15;
  const fftSize = opts.fftSize ?? 256;
  const autoStart = opts.autoStart ?? true;

  const [intensity, setIntensity] = useState(0);
  const [raw, setRaw] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const smoothedRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(stream);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsActive(false);
    smoothedRef.current = 0;
  }, []);

  const loop = useCallback(
    (now: number) => {
      const analyser = analyserRef.current;
      const data = dataRef.current;
      if (!analyser || !data) return;

      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        sum += data[i];
      }
      const avg = sum / data.length;
      const normalized = avg / 255;
      const smoothed = smoothedRef.current * (1 - smoothingFactor) + normalized * smoothingFactor;
      smoothedRef.current = smoothed;

      if (now - lastUpdateRef.current >= 16) {
        setRaw(avg);
        setIntensity(smoothed);
        lastUpdateRef.current = now;
      }

      rafRef.current = requestAnimationFrame(loop);
    },
    [smoothingFactor]
  );

  const start = useCallback(async () => {
    const inputStream = streamRef.current;
    if (!inputStream || isActive) return;

    const context = new AudioContext();
    const source = context.createMediaStreamSource(inputStream);
    const analyser = context.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    audioContextRef.current = context;
    sourceRef.current = source;
    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    setIsActive(true);
    rafRef.current = requestAnimationFrame(loop);
  }, [fftSize, isActive, loop]);

  useEffect(() => {
    if (!stream || !autoStart) return;
    void start();
    return () => {
      stop();
    };
  }, [autoStart, start, stop, stream]);

  return { intensity, raw, isActive, start, stop };
}
