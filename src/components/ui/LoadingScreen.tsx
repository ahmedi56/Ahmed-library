import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onDone: () => void;
}

export function LoadingScreen({ onDone }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const duration = 1400;
    let raf: number;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setProgress(Math.round(t * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setLeaving(true);
        setTimeout(onDone, 500);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink text-paper transition-opacity duration-500 ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <p className="font-serif text-2xl tracking-[0.2em] sm:text-3xl">MY LIBRARY</p>
      <p className="mt-2 text-xs tracking-[0.3em] text-paper/50">
        {progress < 100 ? 'PREPARING THE SHELVES…' : 'ENTERING THE LIBRARY'}
      </p>

      <div className="mt-8 h-px w-56 overflow-hidden bg-paper/15 sm:w-72">
        <div
          className="h-full bg-brass transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-3 font-mono text-[0.65rem] text-paper/40">{progress}%</p>
    </div>
  );
}
