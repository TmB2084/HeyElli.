import type { ComponentProps, FormEventHandler } from 'react';
import { Button } from '../button';
import { Textarea } from '../fields';
import styles from './elements.module.css';

type PromptInputProps = Omit<ComponentProps<typeof Textarea>, 'id' | 'onKeyDown'> & {
  id: string;
  label: string;
  sendLabel: string;
  sendDisabled: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

// shadcn/ui AI Elements Prompt Input, composed as an Input Group.
export function PromptInput({
  id,
  label,
  sendLabel,
  sendDisabled,
  onSubmit,
  ...textareaProps
}: PromptInputProps) {
  return (
    <form className={styles.prompt} onSubmit={onSubmit}>
      <label className="sr-only" htmlFor={id}>{label}</label>
      <div className={`heyelli-field ${styles.inputGroup}`} data-slot="input-group">
        <Textarea
          {...textareaProps}
          id={id}
          data-slot="input-group-control"
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault();
              if (!sendDisabled) event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div data-slot="input-group-addon" data-align="inline-end" className={styles.promptActions}>
          <Button size="icon" type="submit" disabled={sendDisabled} aria-label={sendLabel}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M10 15V5m-5 5 5-5 5 5" />
            </svg>
          </Button>
        </div>
      </div>
    </form>
  );
}
