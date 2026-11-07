import { useQuery } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { api, apiBlob } from './api';
import type { Reference } from './types';

/** Facultés, départements, promotions (filtres et formulaires). */
export function useReference(enabled = true) {
  return useQuery({ queryKey: ['reference'], queryFn: () => api.get<Reference>('/reference'), staleTime: 60_000, enabled });
}

/** Image protégée par authentification (photo, QR) : chargée via l'API, affichée par URL locale. */
export function AuthImage({ src, alt, className, fallback }: { src: string | null; alt: string; className?: string; fallback?: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!src) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setFailed(false);
    apiBlob(src)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [src]);
  if (!src || failed) return <>{fallback ?? null}</>;
  if (!url) return <div className={`${className ?? ''} animate-pulse bg-upl-blue-100`} aria-label="Chargement de l'image" />;
  return <img src={url} alt={alt} className={className} />;
}

export function PhotoPlaceholder({ className }: { className?: string }) {
  return (
    <div className={`${className ?? ''} flex items-center justify-center bg-upl-blue-100 text-xs text-upl-blue-800`} aria-label="Pas de photo">
      Pas de photo
    </div>
  );
}
