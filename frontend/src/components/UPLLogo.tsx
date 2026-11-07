/**
 * Logo officiel de l'Université Protestante de Lubumbashi.
 * Source unique : public/brand/upl-logo.png (1697 × 1676 px, téléchargé depuis upl-univ.ac).
 * L'image n'est ni redessinée ni recadrée : seule sa hauteur est fixée, la largeur suit les proportions.
 * La source étant bien plus grande que l'affichage, le rendu reste net sur les écrans haute densité.
 */
export const UPL_LOGO_SRC = '/brand/upl-logo.png';
export const UNIVERSITY_NAME = 'Université Protestante de Lubumbashi';

const WIDTH = 1697;
const HEIGHT = 1676;

export type UPLLogoSize = 'sm' | 'md' | 'lg';

const SIZES: Record<UPLLogoSize, string> = {
  sm: 'h-9',
  md: 'h-14',
  lg: 'h-24 sm:h-32',
};

export function UPLLogo({
  size = 'md',
  className = '',
  decorative = false,
  priority = false,
}: {
  size?: UPLLogoSize;
  className?: string;
  /** true si le nom de l'université est déjà écrit à côté : le logo est alors ignoré par les lecteurs d'écran. */
  decorative?: boolean;
  /** Chargement prioritaire (logo visible dès l'ouverture de la page). */
  priority?: boolean;
}) {
  return (
    <img
      src={UPL_LOGO_SRC}
      width={WIDTH}
      height={HEIGHT}
      alt={decorative ? '' : `Logo de l'${UNIVERSITY_NAME}`}
      aria-hidden={decorative || undefined}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      draggable={false}
      className={`${SIZES[size]} w-auto shrink-0 select-none object-contain ${className}`}
    />
  );
}
