'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { ComponentProps } from 'react';
import clsx from 'clsx';
import { Button } from './button';
import styles from './popover.module.css';

// Adapted from the shadcn/ui Radix Popover registry. Keep content in the
// anchor's tree for native dialogs, scoped themes and nested popovers.
export const Popover = PopoverPrimitive.Root;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className, align = 'start', sideOffset = 6, collisionPadding = 12, scroll, onCloseAutoFocus, ...props
}: ComponentProps<typeof PopoverPrimitive.Content> & { scroll?: boolean }) {
  return (
    <PopoverPrimitive.Content
      data-slot="popover-content"
      data-scroll={scroll || undefined}
      className={clsx(styles.content, 'heyelli-menu-surface', className)}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      onCloseAutoFocus={event => {
        onCloseAutoFocus?.(event);
        const content = event.target;
        if (!(content instanceof HTMLElement)) return;
        const { activeElement, body } = content.ownerDocument;
        if (activeElement && activeElement !== body && !content.contains(activeElement)) event.preventDefault();
      }}
      {...props}
    />
  );
}

export function PopoverItem({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button variant="ghost" {...props} data-popover-item="" className={clsx(styles.item, className)} />;
}

export function PopoverSeparator() {
  return <div role="separator" className={styles.separator} />;
}
