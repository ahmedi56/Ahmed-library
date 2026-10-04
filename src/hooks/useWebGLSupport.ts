import { useEffect, useState } from 'react';

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    if (!window.WebGLRenderingContext) return false;

    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;

    // Hand the context back. Browsers cap how many live WebGL contexts a
    // page may hold (commonly around 16) and drop the oldest when that is
    // exceeded. This probe used to acquire one and abandon it on every
    // mount, so a session that remounted enough times could exhaust the
    // budget and have this very check start reporting "no WebGL" on a
    // machine that supports it perfectly well — sending the visitor to the
    // flat view for good.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function useWebGLSupport() {
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(detectWebGL());
  }, []);

  return supported;
}
