type DisplayText = {
  title?: string | null;
  description?: string | null;
  variety?: string | null;
  originPlace?: string | null;
  packaging?: string | null;
  destinationCountry?: string | null;
  message?: string | null;
};

type SourceText = {
  title?: string | null;
};

export function catalogDisplayTitle(item: {
  title: string;
  display?: DisplayText | null;
}): string {
  return item.display?.title?.trim() || item.title;
}

export function catalogDisplayDescription(item: {
  description: string | null;
  display?: DisplayText | null;
}): string | null {
  const translated = item.display?.description?.trim();
  return translated || item.description;
}

export function catalogDisplayField(
  displayValue: string | null | undefined,
  sourceValue: string | null | undefined,
): string | null {
  return displayValue?.trim() || sourceValue?.trim() || null;
}

/** Original title when it differs from the text shown for the viewer locale. */
export function catalogOriginalTitle(item: {
  title: string;
  display?: DisplayText | null;
  source?: SourceText | null;
}): string | null {
  const shown = catalogDisplayTitle(item);
  const original = item.source?.title?.trim() || item.title;
  return original !== shown ? original : null;
}
