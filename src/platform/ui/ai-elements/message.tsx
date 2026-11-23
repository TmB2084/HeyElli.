import type { ComponentProps, ReactNode } from 'react';
import clsx from 'clsx';
import { Button } from '../button';
import styles from './elements.module.css';

// shadcn/ui AI Elements Chat and Message patterns, with the existing app's scroll ownership.
export function Conversation({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} data-slot="message-scroller" role="log" className={clsx(styles.conversation, className)} />;
}

export function Message({ from, children }: { from: 'user' | 'assistant'; children: ReactNode }) {
  const align = from === 'user' ? 'end' : 'start';
  return (
    <div data-slot="message" data-align={align} className={styles.message}>
      <div data-slot="message-content" className={styles.messageContent}>
        {from === 'user' ? (
          <div data-slot="bubble" data-align="end" data-variant="muted" className={styles.bubble}>
            <div data-slot="bubble-content" className={styles.bubbleContent}>{children}</div>
          </div>
        ) : children}
      </div>
    </div>
  );
}

export function Sources({ className, ...props }: ComponentProps<'nav'>) {
  return <nav {...props} data-slot="sources" className={clsx(styles.sources, className)} />;
}

export function Suggestion(props: ComponentProps<typeof Button>) {
  return <Button variant="outline" {...props} />;
}
