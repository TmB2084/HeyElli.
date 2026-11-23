import type { ComponentProps } from 'react';
import clsx from 'clsx';
import styles from './controls.module.css';

// Adapted from the shadcn/ui Radix Input registry.
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" {...props} className={clsx(styles.field, styles.input, className)} />;
}

// The checkbox keeps native form participation and the platform's switch styling.
export function Switch({ className, ...props }: Omit<ComponentProps<'input'>, 'type' | 'role'>) {
  return <input {...props} data-slot="switch" type="checkbox" role="switch" className={clsx('heyelli-switch', className)} />;
}

// Adapted from the shadcn/ui Radix Textarea and Native Select registries.
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" {...props} className={clsx(styles.field, styles.textarea, className)} />;
}

export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="native-select" {...props} className={clsx(styles.field, styles.select, className)} />;
}
