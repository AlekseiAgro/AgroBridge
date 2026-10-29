export type MenuPlacement = 'below' | 'above';

type MenuPlacementInput = {
  triggerTop: number;
  triggerBottom: number;
  menuHeight: number;
  viewportHeight: number;
  /** Distance between trigger and menu plus the margin kept from the viewport edge. */
  gap: number;
};

/** Open below when the menu fits there; otherwise use whichever side has more room. */
export function chooseMenuPlacement({
  triggerTop,
  triggerBottom,
  menuHeight,
  viewportHeight,
  gap,
}: MenuPlacementInput): MenuPlacement {
  const spaceBelow = viewportHeight - triggerBottom - gap;
  if (menuHeight <= spaceBelow) {
    return 'below';
  }
  const spaceAbove = triggerTop - gap;
  return spaceAbove > spaceBelow ? 'above' : 'below';
}
