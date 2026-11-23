import type { ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import styles from './controls.module.css';

// Adapted from the shadcn/ui Radix Button registry.
const buttonVariants = cva(styles.button, {
  variants: {
    variant: {
      default: styles.primary,
      outline: styles.outline,
      ghost: styles.ghost,
      filter: styles.filter,
      link: styles.link,
      close: 'heyelli-close',
    },
    size: {
      default: null,
      icon: styles.icon,
    },
    shape: {
      capsule: styles.capsule,
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export function Button({
  asChild = false,
  type,
  variant = 'default',
  size = 'default',
  shape,
  className,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      {...props}
      type={asChild ? undefined : type ?? 'button'}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={buttonVariants({ variant, size, shape, className })}
    />
  );
}
