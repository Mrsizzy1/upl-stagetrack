/**
 * Composants d'interface communs : sobres, accessibles, sans décoration superflue.
 * Couleurs : voir le système de design décrit dans index.css (upl-blue, slate, upl-gold, danger, success).
 */
import {
  ButtonHTMLAttributes,
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
} from 'react';
import { ApiError } from '../lib/api';
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, InboxIcon, InfoIcon, XIcon } from './Icons';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-upl-blue-700 text-white shadow-xs hover:bg-upl-blue-800 active:bg-upl-blue-900 focus-visible:outline-upl-blue-600',
  secondary:
    'bg-white text-slate-700 shadow-xs ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 focus-visible:outline-upl-blue-600',
  danger: 'bg-danger-700 text-white shadow-xs hover:bg-danger-800 active:bg-danger-900 focus-visible:outline-danger-700',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 focus-visible:outline-upl-blue-600',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-md px-2.5 text-xs',
  md: 'min-h-9 gap-2 rounded-lg px-3.5 py-2 text-sm',
  lg: 'min-h-11 gap-2 rounded-lg px-5 py-2.5 text-sm',
};

/** Classes d'un bouton, réutilisables sur un lien (<Link className={buttonClass('primary')}>). */
export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) =>
  cx(
    'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    SIZES[size],
    VARIANTS[variant],
    className,
  );

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button type="button" {...props} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)}>
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function Spinner({ small = false }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={cx('inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent', small ? 'h-3.5 w-3.5' : 'h-6 w-6')}
    />
  );
}

const fieldClass =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs ring-1 ring-inset ring-slate-300 transition-shadow ' +
  'placeholder:text-slate-400 hover:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-upl-blue-600 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:shadow-none disabled:hover:ring-slate-300 ' +
  'aria-[invalid=true]:ring-danger-500';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} {...props} className={cx(fieldClass, className)} />;
});

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(fieldClass, 'pr-9', className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldClass, 'min-h-24 leading-relaxed', className)} />;
}

/** Libellé + champ + aide ou erreur. L'enfant reçoit l'id via render prop. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
        {required && (
          <span className="text-danger-600" aria-hidden>
            {' '}
            *
          </span>
        )}
      </label>
      {children(id)}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-danger-700">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-0 rounded-xl bg-white shadow-sm ring-1 ring-slate-200', className)}>
      {(title || actions) && (
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
          {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Barre de filtres au-dessus d'une liste : même surface que les cartes, grille fournie par l'appelant. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mb-6 grid gap-x-4 gap-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200', className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-upl-blue-700">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Intertitre de section à l'intérieur d'une page. */
export function SectionTitle({ children, description }: { children: ReactNode; description?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
    </div>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-success-50 text-success-800 ring-success-200',
  warning: 'bg-upl-gold-50 text-upl-gold-800 ring-upl-gold-200',
  danger: 'bg-danger-50 text-danger-800 ring-danger-200',
  info: 'bg-upl-blue-50 text-upl-blue-800 ring-upl-blue-200',
};

const DOT_TONES: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-success-600',
  warning: 'bg-upl-gold-600',
  danger: 'bg-danger-600',
  info: 'bg-upl-blue-600',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', BADGE_TONES[tone])}>
      <span aria-hidden className={cx('h-1.5 w-1.5 rounded-full', DOT_TONES[tone])} />
      {children}
    </span>
  );
}

export const attendanceTone = (s: string): Tone => (s === 'PRESENT' ? 'success' : s === 'LATE' ? 'warning' : 'danger');
export const studentTone = (s: string): Tone => (s === 'ACTIVE' ? 'success' : s === 'SUSPENDED' ? 'danger' : 'neutral');

const ALERT_TONES: Record<Tone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  success: 'border-success-200 bg-success-50 text-success-900',
  warning: 'border-upl-gold-200 bg-upl-gold-50 text-upl-gold-900',
  danger: 'border-danger-200 bg-danger-50 text-danger-900',
  info: 'border-upl-blue-200 bg-upl-blue-50 text-upl-blue-900',
};

const ALERT_ICON_TONES: Record<Tone, string> = {
  neutral: 'text-slate-500',
  success: 'text-success-600',
  warning: 'text-upl-gold-700',
  danger: 'text-danger-600',
  info: 'text-upl-blue-600',
};

export function Alert({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  const Icon = tone === 'success' ? CheckCircleIcon : tone === 'warning' ? AlertTriangleIcon : tone === 'danger' ? AlertCircleIcon : InfoIcon;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-lg border p-3 text-sm leading-relaxed', ALERT_TONES[tone])}>
      <Icon size={18} className={cx('mt-0.5 shrink-0', ALERT_ICON_TONES[tone])} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      </div>
    </div>
  );
}

export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue.';
  const details = error instanceof ApiError && Array.isArray(error.details) ? (error.details as unknown[]).filter((d) => typeof d === 'string') : [];
  return (
    <Alert tone="danger" title={message}>
      {details.length > 0 && (
        <ul className="list-disc pl-5">
          {details.map((d) => (
            <li key={String(d)}>{String(d)}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
      <span className="text-upl-blue-700">
        <Spinner />
      </span>
      {label}
    </div>
  );
}

/** État vide : icône neutre, message, action facultative. */
export function Empty({ children, title, action }: { children: ReactNode; title?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <InboxIcon size={20} />
      </span>
      {title && <p className="text-sm font-semibold text-slate-900">{title}</p>}
      <p className="max-w-sm text-sm text-slate-500">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type StatTone = 'green' | 'red' | 'amber' | 'blue' | 'neutral';

const STAT_TONES: Record<StatTone, { dot: string; icon: string }> = {
  blue: { dot: 'bg-upl-blue-600', icon: 'bg-upl-blue-50 text-upl-blue-700' },
  green: { dot: 'bg-success-600', icon: 'bg-success-50 text-success-700' },
  red: { dot: 'bg-danger-600', icon: 'bg-danger-50 text-danger-700' },
  amber: { dot: 'bg-upl-gold-500', icon: 'bg-upl-gold-50 text-upl-gold-700' },
  neutral: { dot: 'bg-slate-400', icon: 'bg-slate-100 text-slate-600' },
};

/** Indicateur chiffré. La couleur n'est qu'un repère (pastille ou icône) : la valeur reste en encre neutre. */
export function StatCard({
  label,
  value,
  hint,
  tone = 'blue',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
  icon?: ReactNode;
}) {
  const t = STAT_TONES[tone];
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
          {!icon && <span aria-hidden className={cx('h-2 w-2 shrink-0 rounded-full', t.dot)} />}
          <span>{label}</span>
        </p>
        <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">{value}</p>
        {hint && <p className="mt-2 text-xs leading-snug text-slate-500">{hint}</p>}
      </div>
      {icon && <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', t.icon)}>{icon}</span>}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600" aria-label="Pagination">
      <span className="tabular-nums">
        <span className="font-medium text-slate-900">
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
        </span>{' '}
        sur <span className="font-medium text-slate-900">{total}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="hidden text-xs text-slate-500 sm:inline">
          Page {page} / {pages}
        </span>
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Précédent
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Suivant
        </Button>
      </span>
    </nav>
  );
}

/** Fenêtre modale basée sur <dialog> (focus et Échap gérés par le navigateur). */
export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 text-slate-800 shadow-xl ring-1 ring-slate-900/5 backdrop:bg-upl-blue-950/50"
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-4rem)] flex-col">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1.5 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label="Fermer"
            >
              <XIcon size={18} />
            </button>
          </header>
          <div className="space-y-4 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export const tableClass = 'ui-table min-w-full text-sm';
export const thClass = 'px-3 py-2.5 text-left text-xs font-semibold text-slate-600';
export const tdClass = 'px-3 py-3 align-top text-slate-700';

/**
 * Tableau défilant horizontalement sur petit écran. `relative` est indispensable : sans lui, les éléments
 * en position absolue du tableau (libellés « sr-only » des colonnes d'actions) échappent au défilement
 * et élargissent toute la page sur mobile.
 */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="relative -mx-5 overflow-x-auto px-5">{children}</div>;
}
