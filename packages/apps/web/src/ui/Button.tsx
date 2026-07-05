import type { ButtonHTMLAttributes } from 'react';

type Variant = 'solid' | 'outline' | 'ghost';

const variants: Record<Variant, string> = {
  solid: 'bg-accent text-accent-ink hover:opacity-90',
  outline: 'border border-line hover:bg-accent-soft/60',
  ghost: 'hover:bg-accent-soft/60',
};

/**
 * The one button. Module UIs compose these primitives instead of styling raw
 * elements, so interaction states stay consistent app-wide.
 */
export function Button({
  variant = 'outline',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={[
        'rounded-lg px-2.5 py-1.5 text-sm transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        variants[variant],
        className,
      ].join(' ')}
    />
  );
}
