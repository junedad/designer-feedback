import { X } from 'lucide-react';
import { Dialog as P } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const Dialog = P.Root;
export const DialogClose = P.Close;

function Overlay() {
  return <P.Overlay className="fixed inset-0 z-50 bg-[#0d1427]/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />;
}

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <Overlay />
      <P.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-card p-6 shadow-xl sm:max-w-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      >
        {children}
      </P.Content>
    </P.Portal>
  );
}

export const DialogTitle = ({ className, ...props }: React.ComponentProps<typeof P.Title>) => (
  <P.Title className={cn('text-base font-semibold', className)} {...props} />
);
export const DialogDescription = ({ className, ...props }: React.ComponentProps<typeof P.Description>) => (
  <P.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
);

/** Panneau latéral (Sheet shadcn). */
export function SheetContent({ className, children, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <Overlay />
      <P.Content
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l bg-card shadow-xl sm:max-w-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
          className,
        )}
        {...props}
      >
        {children}
        <P.Close className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:bg-accent hover:opacity-100">
          <X className="size-4" />
          <span className="sr-only">Fermer</span>
        </P.Close>
      </P.Content>
    </P.Portal>
  );
}
