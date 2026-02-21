import React from 'react';

type RexOrbProps = {
  mode: 'idle' | 'user' | 'rex';
  intensity: number;
};

const BAR_MULTIPLIERS = [0.65, 0.72, 0.78, 0.9, 0.74, 0.82, 0.68];

export default function RexOrb({ mode, intensity }: RexOrbProps) {
  const safeIntensity = Math.max(0, Math.min(1, intensity || 0));
  const scale =
    mode === 'user' ? 1 + safeIntensity * 0.08 : mode === 'rex' ? 1 + safeIntensity * 0.04 : 1;
  const glowSpread = 60 + safeIntensity * (mode === 'user' ? 45 : 25);
  const glowAlpha = 0.15 + safeIntensity * (mode === 'user' ? 0.25 : 0.15);

  return (
    <div
      className="orb-container flex items-center justify-center"
      style={{
        transform: `scale(${scale})`,
        boxShadow: `0 0 ${glowSpread}px rgba(59, 130, 246, ${glowAlpha})`,
      }}
    >
      <div className="orb-core"></div>
      <div className="flex items-center justify-center space-x-1 h-12">
        <div
          className="waveform-bar h-4"
          style={{ animationDelay: '0.1s', transform: `scaleY(${0.6 + safeIntensity * BAR_MULTIPLIERS[0]})` }}
        ></div>
        <div
          className="waveform-bar h-8"
          style={{ animationDelay: '0.2s', transform: `scaleY(${0.6 + safeIntensity * BAR_MULTIPLIERS[1]})` }}
        ></div>
        <div
          className="waveform-bar h-6"
          style={{ animationDelay: '0.3s', transform: `scaleY(${0.6 + safeIntensity * BAR_MULTIPLIERS[2]})` }}
        ></div>
        <div
          className="waveform-bar h-10"
          style={{ animationDelay: '0.4s', transform: `scaleY(${0.6 + safeIntensity * BAR_MULTIPLIERS[3]})` }}
        ></div>
        <div
          className="waveform-bar h-5"
          style={{ animationDelay: '0.5s', transform: `scaleY(${0.6 + safeIntensity * BAR_MULTIPLIERS[4]})` }}
        ></div>
        <div
          className="waveform-bar h-7"
          style={{ animationDelay: '0.2s', transform: `scaleY(${0.6 + safeIntensity * BAR_MULTIPLIERS[5]})` }}
        ></div>
        <div
          className="waveform-bar h-3"
          style={{ animationDelay: '0.1s', transform: `scaleY(${0.6 + safeIntensity * BAR_MULTIPLIERS[6]})` }}
        ></div>
      </div>
    </div>
  );
}
