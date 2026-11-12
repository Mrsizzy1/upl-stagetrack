/** Composants d'interface communs : sobres, accessibles, sans décoration superflue. */
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

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-upl-blue-700 text-white hover:bg-upl-blue-900 focus-visible:outline-upl-blue-700',
  secondary: 'bg-white text-upl-blue-900 ring-1 ring-inset ring-upl-blue-100 hover:bg-upl-blue-50 focus-visible:outline-upl-blue-900',
  danger: 'bg-danger-700 text-white hover:bg-danger-700/90 focus-visible:outline-danger-700',
  ghost: 'text-upl-blue-800 hover:bg-upl-blue-100 focus-visible:outline-upl-blue-900',
};

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
    >
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
      className={cx('inline-block animate-spin rounded-full border-2 border-current border-r-transparent', small ? 'h-3.5 w-3.5' : 'h-6 w-6')}
    />
  );
}

const fieldClass =
  'block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-upl-blue-950 ring-1 ring-inset ring-upl-blue-100 placeholder:text-upl-blue-800/50 focus:ring-2 focus:ring-upl-blue-700 disabled:bg-upl-blue-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} {...props} className={cx(fieldClass, className)} />;
});

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(fieldClass, 'pr-8', className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldClass, 'min-h-20', className)} />;
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
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-upl-blue-900">
        {label}
        {required && <span className="text-danger-700"> *</span>}
      </label>
      {children(id)}
      {error ? <p className="mt-1 text-xs text-danger-700">{error}</p> : hint ? <p className="mt-1 text-xs text-upl-blue-800/80">{hint}</p> : null}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-0 rounded-lg bg-white shadow-sm ring-1 ring-upl-blue-100', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-upl-blue-100 px-5 py-3">
          {title && <h2 className="text-base font-semibold text-upl-blue-900">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-upl-blue-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-upl-blue-800">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const TONES: Record<Tone, string> = {
  neutral: 'bg-upl-blue-100 text-upl-blue-900',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-upl-gold-100 text-upl-gold-800',
  danger: 'bg-danger-100 text-danger-700',
  info: 'bg-upl-blue-100 text-upl-blue-900',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', TONES[tone])}>{children}</span>;
}

export const attendanceTone = (s: string): Tone => (s === 'PRESENT' ? 'success' : s === 'LATE' ? 'warning' : 'danger');
export const studentTone = (s: string): Tone => (s === 'ACTIVE' ? 'success' : s === 'SUSPENDED' ? 'danger' : 'neutral');

export function Alert({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('rounded-md p-3 text-sm', TONES[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
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
    <div className="flex items-center gap-3 py-8 text-upl-blue-800">
      <Spinner /> {label}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-upl-blue-800">{children}</p>;
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'green' | 'red' | 'amber' }) {
  const accent = tone === 'green' ? 'border-l-success-600' : tone === 'red' ? 'border-l-danger-700' : tone === 'amber' ? 'border-l-upl-gold-500' : 'border-l-upl-blue-700';
  return (
    <div className={cx('rounded-lg border-l-4 bg-white p-4 shadow-sm ring-1 ring-upl-blue-100', accent)}>
      <p className="text-xs font-medium uppercase tracking-wide text-upl-blue-800">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-upl-blue-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-upl-blue-800/80">{hint}</p>}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-upl-blue-800" aria-label="Pagination">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} sur {total}
      </span>
      <span className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Précédent
        </Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
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
      className="m-auto w-full max-w-lg rounded-lg p-0 shadow-xl backdrop:bg-upl-blue-950/40"
    >
      {open && (
        <div>
          <header className="flex items-center justify-between border-b border-upl-blue-100 px-5 py-3">
            <h2 className="text-base font-semibold text-upl-blue-900">{title}</h2>
            <button type="button" onClick={onClose} className="rounded p-1 text-upl-blue-800 hover:bg-upl-blue-100" aria-label="Fermer">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div className="space-y-4 px-5 py-4">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-upl-blue-100 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export const tableClass = 'min-w-full divide-y divide-upl-blue-100 text-sm';
export const thClass = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-upl-blue-800';
export const tdClass = 'px-3 py-2 align-top text-upl-blue-950';

/**
 * Tableau défilant horizontalement sur petit écran. `relative` est indispensable : sans lui, les éléments
 * en position absolue du tableau (libellés « sr-only » des colonnes d'actions) échappent au défilement
 * et élargissent toute la page sur mobile.
 */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="relative -mx-5 overflow-x-auto px-5">{children}</div>;
}
