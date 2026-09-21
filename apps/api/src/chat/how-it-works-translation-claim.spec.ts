import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

const CONNECT_KEY = 'howItWorks.steps.connect.text';

const ENGLISH_CONNECT =
  'Buyers publish purchase requests or ask for quotes on catalog products. Farmers reply with offers and both sides chat directly in the cabinet.';

const EXPECTED_CONNECT: Record<(typeof LOCALES)[number], string> = {
  en: ENGLISH_CONNECT,
  ka: 'მყიდველები აქვეყნებენ შესყიდვის მოთხოვნებს ან ითხოვენ ფასს კატალოგის პროდუქტებზე. ფერმერები პასუხობენ შეთავაზებებით და ორივე მხარე უშუალოდ ესაუბრება კაბინეტში.',
  ru: 'Покупатели публикуют запросы на покупку или запрашивают цену по товарам каталога. Фермеры отвечают предложениями, а обе стороны общаются напрямую в кабинете.',
  de: 'Käufer veröffentlichen Kaufanfragen oder fragen Preise zu Katalogprodukten an. Landwirte antworten mit Angeboten, und beide Seiten chatten direkt im Kabinett.',
  fr: "Les acheteurs publient des demandes d'achat ou demandent un devis sur les produits du catalogue. Les agriculteurs répondent par des offres et les deux parties discutent directement dans le cabinet.",
  it: 'Gli acquirenti pubblicano richieste di acquisto o chiedono preventivi sui prodotti del catalogo. Gli agricoltori rispondono con offerte e entrambe le parti chattono direttamente nel cabinet.',
  es: 'Los compradores publican solicitudes de compra o piden presupuestos de productos del catálogo. Los agricultores responden con ofertas y ambas partes chatean directamente en el gabinete.',
};

/** Public marketing namespaces only — cabinet chat.translation chrome is out of scope. */
const PUBLIC_NAMESPACES = ['howItWorks', 'home', 'roleHubs', 'nav'] as const;

const CLAIM_PATTERNS = [
  /chat translates/i,
  /translates (the )?messages/i,
  /automatic translation/i,
  /ai translation/i,
  /multilingual chat/i,
  /language detection/i,
  /instant translation/i,
  /real-?time translation/i,
  /чат переводит/i,
  /переводит сообщения/i,
  /der chat übersetzt/i,
  /übersetzt in die sprache/i,
  /le chat traduit/i,
  /traduit dans la langue/i,
  /langue de chacun/i,
  /sprache jedes partners/i,
  /თარგმნ/,
];

type Nested = Record<string, unknown>;

function messages(locale: string): Nested {
  return JSON.parse(readFileSync(join(WEB, 'messages', `${locale}.json`), 'utf8')) as Nested;
}

function read(obj: Nested, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Nested)[key];
  }, obj);
  if (typeof value !== 'string') {
    throw new Error(`Missing string ${path}`);
  }
  return value;
}

function flattenNamespace(obj: unknown, prefix: string, out: string[] = []): string[] {
  if (typeof obj === 'string') {
    out.push(`${prefix}: ${obj}`);
    return out;
  }
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Nested)) {
      flattenNamespace(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

function source(name: string): string {
  return readFileSync(join(WEB, 'src', name), 'utf8');
}

describe('public How it works copy does not promise chat translation', () => {
  it('keeps the English connect step as the semantic source', () => {
    expect(read(messages('en'), CONNECT_KEY)).toBe(ENGLISH_CONNECT);
    expect(read(messages('en'), CONNECT_KEY)).not.toMatch(/translat/i);
  });

  it.each(LOCALES)('%s connect copy matches the cabinet-chat meaning', (locale) => {
    expect(read(messages(locale), CONNECT_KEY)).toBe(EXPECTED_CONNECT[locale]);
  });

  it.each(LOCALES)('%s public marketing copy has no chat-translation claim', (locale) => {
    const data = messages(locale);
    const leftovers: string[] = [];
    for (const ns of PUBLIC_NAMESPACES) {
      for (const line of flattenNamespace(data[ns], ns)) {
        if (CLAIM_PATTERNS.some((pattern) => pattern.test(line))) {
          leftovers.push(line);
        }
      }
    }
    expect(leftovers).toEqual([]);
  });

  it('renders the connect step from shared HowItWorksSection on public pages', () => {
    const section = source('components/HowItWorksSection.tsx');
    expect(section).toContain("getTranslations('howItWorks')");
    expect(section).toContain("t(`steps.${step}.text`)");

    expect(source('app/[locale]/page.tsx')).toContain('<HowItWorksSection');
    expect(source('app/[locale]/how-it-works/page.tsx')).toContain('<HowItWorksSection');
  });

  it('does not enable chat translation in the API', () => {
    const service = readFileSync(join(__dirname, 'chat.service.ts'), 'utf8');
    expect(service).toContain('AI translation is temporarily disabled — store and show source text only.');
    expect(service).toContain('AI translation temporarily disabled: always surface the original text.');
    expect(service).not.toContain('this.translationService.translate');
  });
});
