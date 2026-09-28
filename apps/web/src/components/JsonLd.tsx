type Props = {
  data: Record<string, unknown>;
};

/** Server-rendered Schema.org JSON-LD. `<` is escaped so the payload cannot close the script. */
export function JsonLd({ data }: Props) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
