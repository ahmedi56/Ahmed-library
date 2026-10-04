import { useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { PerformanceTier } from '../../hooks/usePerformance';
import { isMuted, onMutedChange, setMuted, unlockAudio } from '../../lib/audio';

interface PerformanceControlsProps {
  tier: PerformanceTier;
  onChange: (tier: PerformanceTier) => void;
}

const TIERS: PerformanceTier[] = ['low', 'medium', 'high'];

export function PerformanceControls({ tier, onChange }: PerformanceControlsProps) {
  // The room makes sounds now, so it needs an off switch that's always in
  // reach — it lives with the other "how should this room behave" control.
  const muted = useSyncExternalStore(onMutedChange, isMuted, () => false);

  return (
    <div className="pointer-events-auto fixed bottom-5 right-5 z-30 flex items-center gap-1 rounded-full border border-ink/10 bg-paper/70 p-1 text-[0.6rem] tracking-[0.15em] text-ink/60 backdrop-blur-sm sm:bottom-6 sm:right-6">
      <button
        type="button"
        onClick={() => {
          unlockAudio();
          setMuted(!muted);
        }}
        aria-pressed={muted}
        aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        title={muted ? 'Sound off' : 'Sound on'}
        className="rounded-full px-2 py-1.5 transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
      >
        {muted ? <VolumeX size={13} aria-hidden="true" /> : <Volume2 size={13} aria-hidden="true" />}
      </button>
      <span aria-hidden="true" className="h-4 w-px bg-ink/15" />
      {TIERS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          aria-pressed={tier === t}
          className={`rounded-full px-2.5 py-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${
            tier === t ? 'bg-ink text-paper' : 'hover:text-ink'
          }`}
        >
          {t.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
