import { EffectComposer, Vignette, BrightnessContrast, ToneMapping } from '@react-three/postprocessing';

/**
 * The post-processing pass (tone mapping, a touch of contrast, vignette).
 *
 * Its own file so LibraryScene can load it lazily: only the High quality
 * tier uses it, and the postprocessing library is a large part of the
 * room's download that Low (phones) and Medium visitors never needed.
 */
export default function SceneEffects() {
  return (
    <EffectComposer multisampling={0}>
      <ToneMapping />
      <BrightnessContrast brightness={0.01} contrast={0.06} />
      <Vignette eskil={false} offset={0.18} darkness={0.55} />
    </EffectComposer>
  );
}
