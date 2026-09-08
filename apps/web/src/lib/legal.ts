export type LegalSection = {
  title: string;
  body: string[];
};

export type LegalDocContent = {
  title: string;
  description: string;
  sections: LegalSection[];
};

export function interpolateLegal(
  text: string,
  vars: Record<string, string>,
): string {
  return text.replace(/\{(\w+)\}/g, (full, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : full,
  );
}
