"use client";

import {
  ConfirmationDialog,
  type ConfirmationDialogProps
} from "@/components/ui/confirmation-dialog";

export type DeleteModalProps = Omit<ConfirmationDialogProps, "destructive"> & {
  destructive?: boolean;
};

/** Opinionated wrapper — defaults to destructive styling for remove flows. */
export function DeleteModal(props: DeleteModalProps) {
  const { destructive = true, ...rest } = props;
  return <ConfirmationDialog {...rest} destructive={destructive} />;
}
