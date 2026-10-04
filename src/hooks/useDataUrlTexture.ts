import { useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * Loads a THREE.Texture from a data URL (or any URL), disposing the previous
 * texture whenever the source changes or the component unmounts. Deliberately
 * not drei's useTexture: that suspends the whole tree and caches by URL
 * forever, which doesn't fit user-replaceable images that come and go.
 */
export function useDataUrlTexture(url: string | null): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    let disposed = false;
    let loaded: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.load(url, (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      loaded = tex;
      setTexture(tex);
    });

    return () => {
      disposed = true;
      loaded?.dispose();
    };
  }, [url]);

  return texture;
}
