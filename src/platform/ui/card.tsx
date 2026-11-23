import type { ComponentProps } from 'react';
import clsx from 'clsx';
import styles from './card.module.css';

// The shadcn/ui Card surface uses HeyElli's panel and theme variables.
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} data-slot="card" className={clsx(styles.card, className)} />;
}
