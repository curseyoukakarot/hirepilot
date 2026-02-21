import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  smoothingFactor?: number;
  fftSize?: number;
  autoStart?: boolean;
  noiseFloor?: number;
  gain?: number;
  targetFps?: number;
  deltaThreshold?: number;
  compressionK?: number;
  gamma?: number;
  attack?: number;
  release?: number;
  calibrationMs?: number;
};

export function useAudioAnalyzer(stream: MediaStream | null, opts: Options = {}) {
  const smoothingFactor = opts.smoothingFactor ?? 0.1;
  const fftSize = opts.fftSize ?? 256;
  const autoStart = opts.autoStart ?? true;
  const noiseFloor = opts.noiseFloor ?? 0.03;
  const gain = opts.gain ?? 1.8;
  const targetFps = opts.targetFps ?? 30;
  const deltaThreshold = opts.deltaThreshold ?? 0.01;
  const compressionK = opts.compressionK ?? 2.6;
  const gamma = opts.gamma ?? 0.75;
  const attack = opts.attack ?? 0.22;
  const release = opts.release ?? 0.1;
  const calibrationMs = opts.calibrationMs ?? 1000;

  const [intensity, setIntensity] = useState(0);
  const [raw, setRaw] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [updateRate, setUpdateRate] = useState(0);
  const [liveNoiseFloor, setLiveNoiseFloor] = useState(noiseFloor);
  const [liveGain, setLiveGain] = useState(gain);
  const [shapedIntensity, setShapedIntensity] = useState(0);
  const [smoothedIntensity, setSmoothedIntensity] = useState(0);
  const [speakingDetected, setSpeakingDetected] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sinkGainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const smoothedRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const lastPublishedRef = useRef(0);
  const updateCountRef = useRef(0);
  const updateWindowStartRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(stream);
  const isRunningRef = useRef(false);
  const isConnectedRef = useRef(false);
  const calibrationStartRef = useRef<number | null>(null);
  const isCalibratedRef = useRef(false);
  const baselineSamplesRef = useRef<number[]>([]);
  const noiseFloorRef = useRef(noiseFloor);
  const gainRef = useRef(gain);
  const expectedSpeechRef = useRef(0.18);
  const shapedRef = useRef(0);
  const speakingRef = useRef(false);
  const aboveStartRef = useRef<number | null>(null);
  const belowStartRef = useRef<number | null>(null);

  const clamp = useCallback((value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value));
  }, []);

  const percentile = useCallback((values: number[], p: number) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = clamp(Math.floor((sorted.length - 1) * p), 0, sorted.length - 1);
    return sorted[idx];
  }, [clamp]);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
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
    if (sinkGainRef.current) {
      sinkGainRef.current.disconnect();
      sinkGainRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    isConnectedRef.current = false;
    setIsActive(false);
    setUpdateRate(0);
    setIntensity(0);
    setRaw(0);
    setLiveNoiseFloor(noiseFloor);
    setLiveGain(gain);
    setShapedIntensity(0);
    setSmoothedIntensity(0);
    setSpeakingDetected(false);
    smoothedRef.current = 0;
    lastPublishedRef.current = 0;
    shapedRef.current = 0;
    speakingRef.current = false;
    aboveStartRef.current = null;
    belowStartRef.current = null;
    baselineSamplesRef.current = [];
    calibrationStartRef.current = null;
    isCalibratedRef.current = false;
    noiseFloorRef.current = noiseFloor;
    gainRef.current = gain;
    expectedSpeechRef.current = 0.18;
  }, [gain, noiseFloor]);

  const loop = useCallback(
    (now: number) => {
      if (!isRunningRef.current) return;
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

      if (calibrationStartRef.current && !isCalibratedRef.current) {
        const elapsedCalibration = now - calibrationStartRef.current;
        if (elapsedCalibration <= calibrationMs) {
          baselineSamplesRef.current.push(normalized);
        } else {
          const baselineP90 = Math.max(0.02, percentile(baselineSamplesRef.current, 0.9));
          noiseFloorRef.current = clamp(baselineP90 * 1.15, 0.02, 0.08);
          isCalibratedRef.current = true;
        }
      }

      if (normalized > noiseFloorRef.current + 0.02) {
        expectedSpeechRef.current = expectedSpeechRef.current * 0.94 + normalized * 0.06;
      }
      const adaptiveGain = clamp(0.6 / Math.max(0.12, expectedSpeechRef.current), 1.2, 3.0);
      gainRef.current = gainRef.current * 0.95 + adaptiveGain * 0.05;

      const x = clamp((normalized - noiseFloorRef.current) * gainRef.current, 0, 1);
      let shaped = 1 - Math.exp(-compressionK * x);
      shaped = Math.pow(shaped, gamma);
      shaped = clamp(shaped, 0, 1);
      shapedRef.current = shaped;

      let smoothed = smoothedRef.current;
      if (shaped > smoothed) {
        smoothed = smoothed + (shaped - smoothed) * attack;
      } else {
        smoothed = smoothed + (shaped - smoothed) * release;
      }
      smoothed = smoothedRef.current * (1 - smoothingFactor) + smoothed * smoothingFactor;
      smoothedRef.current = smoothed;

      if (!speakingRef.current) {
        if (smoothed >= 0.1) {
          if (!aboveStartRef.current) aboveStartRef.current = now;
          if (now - aboveStartRef.current >= 120) {
            speakingRef.current = true;
            aboveStartRef.current = null;
            belowStartRef.current = null;
          }
        } else {
          aboveStartRef.current = null;
        }
      } else if (smoothed <= 0.06) {
        if (!belowStartRef.current) belowStartRef.current = now;
        if (now - belowStartRef.current >= 250) {
          speakingRef.current = false;
          belowStartRef.current = null;
          aboveStartRef.current = null;
        }
      } else {
        belowStartRef.current = null;
      }

      const minFrameMs = 1000 / targetFps;
      const shouldPublish =
        now - lastUpdateRef.current >= minFrameMs &&
        (Math.abs(smoothed - lastPublishedRef.current) >= deltaThreshold || now - lastUpdateRef.current >= minFrameMs * 2);

      if (shouldPublish) {
        setRaw(avg);
        setIntensity(smoothed);
        setSmoothedIntensity(smoothed);
        setShapedIntensity(shapedRef.current);
        setLiveNoiseFloor(noiseFloorRef.current);
        setLiveGain(gainRef.current);
        setSpeakingDetected(speakingRef.current);
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
    [
      attack,
      calibrationMs,
      clamp,
      compressionK,
      deltaThreshold,
      gamma,
      percentile,
      release,
      smoothingFactor,
      targetFps,
    ]
  );

  const start = useCallback(async (streamOverride?: MediaStream | null) => {
    const inputStream = streamOverride ?? streamRef.current;
    if (!inputStream || isRunningRef.current) return;

    let context = audioContextRef.current;
    if (!context || context.state === 'closed') {
      context = new AudioContext();
      audioContextRef.current = context;
    }
    if (context.state === 'suspended') {
      await context.resume();
    }

    const source = context.createMediaStreamSource(inputStream);
    const analyser = context.createAnalyser();
    const sinkGain = context.createGain();
    sinkGain.gain.value = 0;
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    analyser.connect(sinkGain);
    sinkGain.connect(context.destination);

    sourceRef.current = source;
    analyserRef.current = analyser;
    sinkGainRef.current = sinkGain;
    dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    calibrationStartRef.current = performance.now();
    baselineSamplesRef.current = [];
    isCalibratedRef.current = false;
    noiseFloorRef.current = noiseFloor;
    gainRef.current = gain;
    expectedSpeechRef.current = 0.18;
    speakingRef.current = false;
    aboveStartRef.current = null;
    belowStartRef.current = null;
    isConnectedRef.current = true;
    isRunningRef.current = true;
    setIsActive(true);
    rafRef.current = requestAnimationFrame(loop);
  }, [fftSize, gain, loop, noiseFloor]);

  useEffect(() => {
    if (!stream || !autoStart) return;
    void start();
    return () => {
      stop();
    };
  }, [autoStart, start, stop, stream]);

  return {
    intensity,
    raw,
    isActive: isActive && isConnectedRef.current && isRunningRef.current,
    updateRate,
    noiseFloor: liveNoiseFloor,
    gain: liveGain,
    shapedIntensity,
    smoothedIntensity,
    speakingDetected,
    start,
    stop,
  };
}
