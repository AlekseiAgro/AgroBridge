export type RenderedTranslationFields = {
  titleDisplay?: string | null;
  titleSource?: string | null;
  originDisplay?: string | null;
  originSource?: string | null;
  descriptionDisplay?: string | null;
  descriptionSource?: string | null;
  historyDisplay?: string | null;
  historySource?: string | null;
  marketsDisplay?: string | null;
  marketsSource?: string | null;
};

/** Text shown before the visitor asks for the stored original. */
export function visibleTranslationText(
  showingOriginal: boolean,
  display?: string | null,
  source?: string | null,
): string {
  const shown = display?.trim() || source?.trim() || '';
  const original = source?.trim() || shown;
  return showingOriginal ? original : shown;
}

/** True when the rendered display text is not the stored source text. */
export function translationCopyDiffers(display?: string | null, source?: string | null): boolean {
  const shown = visibleTranslationText(false, display, source);
  const original = source?.trim() || shown;
  return Boolean(original) && shown !== original;
}

/**
 * Whether Product Detail has a visible translated field to switch.
 * Farm description is omitted because the page does not render it.
 */
export function renderedProductTranslationDiffers(fields: RenderedTranslationFields): boolean {
  return (
    translationCopyDiffers(fields.titleDisplay, fields.titleSource) ||
    translationCopyDiffers(fields.originDisplay, fields.originSource) ||
    translationCopyDiffers(fields.descriptionDisplay, fields.descriptionSource) ||
    translationCopyDiffers(fields.historyDisplay, fields.historySource) ||
    translationCopyDiffers(fields.marketsDisplay, fields.marketsSource)
  );
}

export function translationIndicator(
  showingOriginal: boolean,
  display?: string | null,
  source?: string | null,
): 'translated' | 'original' | null {
  if (!translationCopyDiffers(display, source)) {
    return null;
  }
  return showingOriginal ? 'original' : 'translated';
}
