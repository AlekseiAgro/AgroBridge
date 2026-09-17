'use client';

import { createContext, useContext, useState, type ComponentProps, type ReactNode } from 'react';
import { FarmForm } from '@/components/FarmForm';

type FarmOwnerMode = {
  editing: boolean;
  startEdit: () => void;
  cancelEdit: () => void;
};

const FarmOwnerModeContext = createContext<FarmOwnerMode | null>(null);

function useFarmOwnerMode(): FarmOwnerMode {
  const value = useContext(FarmOwnerModeContext);
  if (!value) {
    throw new Error('Farm owner controls must be rendered inside FarmOwnerWorkspace');
  }
  return value;
}

/**
 * Local view/edit state for "My Farm". Default is view. A refresh remounts the
 * page and returns to view; there is no edit query string.
 */
export function FarmOwnerWorkspace({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);

  return (
    <FarmOwnerModeContext.Provider
      value={{
        editing,
        startEdit: () => setEditing(true),
        cancelEdit: () => setEditing(false),
      }}
    >
      {children}
    </FarmOwnerModeContext.Provider>
  );
}

export function FarmOwnerView({ children }: { children: ReactNode }) {
  const { editing } = useFarmOwnerMode();
  if (editing) return null;
  return <>{children}</>;
}

export function FarmOwnerEditor({ children }: { children: ReactNode }) {
  const { editing } = useFarmOwnerMode();
  if (!editing) return null;
  return <>{children}</>;
}

export function FarmEditButton({ children }: { children: ReactNode }) {
  const { startEdit } = useFarmOwnerMode();
  return (
    <button type="button" className="button button--ghost" onClick={startEdit}>
      {children}
    </button>
  );
}

export function FarmCancelButton({ children }: { children: ReactNode }) {
  const { cancelEdit } = useFarmOwnerMode();
  return (
    <button type="button" className="button button--ghost" onClick={cancelEdit}>
      {children}
    </button>
  );
}

/** Edit form that leaves edit mode as soon as the save request succeeds. */
export function FarmOwnerEditForm(
  props: Omit<ComponentProps<typeof FarmForm>, 'mode' | 'onSaved'>,
) {
  const { cancelEdit } = useFarmOwnerMode();
  return <FarmForm {...props} mode="edit" onSaved={cancelEdit} />;
}
