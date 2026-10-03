'use client';

import { useEffect, useState, type RefObject } from 'react';
import { coverHidesTooMuch } from './record-mark';

export type PhotoFit = 'contain' | 'cover';

/**
 * Cover-crop a photo only when that keeps most of it; otherwise show it whole (the caller draws a
 * blurred fill of the same image behind it). Measured against the frame the photo actually sits
 * in, on load and on every resize, because the same picture can be fine in a phone's 4:3 window
 * and lose the top of someone's head in a desktop's 2.8:1 banner.
 *
 * Starts at `initial` — `contain` unless the caller already knows the dimensions — so nothing is
 * ever cut before the real pixels are known.
 */
export function usePhotoFit(
  frameRef: RefObject<HTMLElement | null>,
  imgRef: RefObject<HTMLImageElement | null>,
  key: unknown,
  initial: PhotoFit = 'contain',
  known?: { readonly width?: number | undefined; readonly height?: number | undefined },
): PhotoFit {
  const [fit, setFit] = useState<PhotoFit>(initial);

  useEffect(() => {
    // A new photo starts from the safe default, not from the previous photo's verdict.
    setFit(initial);
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img) return;
    const decide = () => {
      const width = img.naturalWidth || known?.width || 0;
      const height = img.naturalHeight || known?.height || 0;
      const box = frame.getBoundingClientRect();
      if (!width || !height || box.width < 1 || box.height < 1) return;
      setFit(coverHidesTooMuch(width / height, box.width / box.height) ? 'contain' : 'cover');
    };
    decide();
    img.addEventListener('load', decide);
    if (typeof ResizeObserver === 'undefined') {
      return () => img.removeEventListener('load', decide);
    }
    const observer = new ResizeObserver(decide);
    observer.observe(frame);
    return () => {
      img.removeEventListener('load', decide);
      observer.disconnect();
    };
    // `key` re-runs the measurement when the photo source changes.
  }, [key]);

  return fit;
}
