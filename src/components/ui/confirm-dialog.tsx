"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
};

type DialogState = { open: boolean; options: ConfirmOptions };

function ConfirmDialogView({
  open,
  options,
  onSettle,
}: Readonly<{ open: boolean; options: ConfirmOptions | null; onSettle: (value: boolean) => void }>) {
  const {
    title = "Emin misiniz?",
    description = "",
    confirmLabel = "Sil",
    cancelLabel = "İptal",
    variant = "destructive",
  } = options ?? {};

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onSettle(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onSettle(false)}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={() => onSettle(true)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useConfirm() {
  const [state, setState] = useState<DialogState>({ open: false, options: { description: "" } });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ open: true, options });
    });
  }, []);

  function handleSettle(value: boolean) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }

  function ConfirmDialog() {
    return <ConfirmDialogView open={state.open} options={state.options} onSettle={handleSettle} />;
  }

  return { confirm, ConfirmDialog };
}
