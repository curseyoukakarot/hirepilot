import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  smoothingFactor?: number;
  fftSize?: number;
  autoStart?: boolean;
  noiseFloor?: number;
  gain?: number;
  targetFps?: number;
  deltaThreshold?: number;
};

export function useAudioAnalyzer(stream: MediaStream | null, opts: Options = {}) {
  const smoothingFactor = opts.smoothingFactor ?? 0.1;
  const fftSize = opts.fftSize ?? 256;
  const autoStart = opts.autoStart ?? true;
  const noiseFloor = opts.noiseFloor ?? 0.03;
  const gain = opts.gain ?? 1.6;
  const targetFps = opts.targetFps ?? 30;
  const deltaThreshold = opts.deltaThreshold ?? 0.01;

  const [intensity, setIntensity] = useState(0);
  const [raw, setRaw] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [updateRate, setUpdateRate] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const smoothedRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const lastPublishedRef = useRef(0);
  const updateCountRef = useRef(0);
  const updateWindowStartRef = useRef(0);
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
    setUpdateRate(0);
    setIntensity(0);
    setRaw(0);
    smoothedRef.current = 0;
    lastPublishedRef.current = 0;
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
      const gated = Math.max(0, normalized - noiseFloor) / (1 - noiseFloor);
      const boosted = Math.min(1, gated * gain);
      const smoothed = smoothedRef.current * (1 - smoothingFactor) + boosted * smoothingFactor;
      smoothedRef.current = smoothed;

      const minFrameMs = 1000 / targetFps;
      const shouldPublish =
        now - lastUpdateRef.current >= minFrameMs &&
        (Math.abs(smoothed - lastPublishedRef.current) >= deltaThreshold || now - lastUpdateRef.current >= minFrameMs * 2);

      if (shouldPublish) {
        setRaw(avg);
        setIntensity(smoothed);
        lastUpdateRef.current = now;
        lastPublishedRef.current = smoothed;
        if (!updateWindowStartRef.current) updateWindowStartRef.current = now;
        updateCountRef.current += 1;
        const elapsed = now - updateWindowStartRef.current;
        if (elapsed >= 1000) {
          setUpdateRate((updateCountRef.current * 1000) / elapsed);
          updateWindowStartRef.current = now;
          updateCountRef.current = 0;
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    },
    [deltaThreshold, gain, noiseFloor, smoothingFactor, targetFps]
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

  return { intensity, raw, isActive, updateRate, start, stop };
}
