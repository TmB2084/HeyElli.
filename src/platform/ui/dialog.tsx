import type { ComponentProps } from 'react';

// Native modal dialogs participate in the shell's session-lock suspension and restore.
export function Dialog(props: ComponentProps<'dialog'>) {
  return <dialog {...props} data-slot="dialog-content" />;
}
