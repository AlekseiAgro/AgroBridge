import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const WEB = join(ROOT, 'web');

function read(rel: string): string {
  return readFileSync(join(WEB, rel), 'utf8');
}

describe('web production bundler for Google fonts', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  const layout = read('src/app/[locale]/layout.tsx');
  const css = read('src/app/globals.css');
  const dockerfile = read('Dockerfile');

  it('keeps next/font/google typography including Georgian and Cyrillic', () => {
    expect(layout).toContain("from 'next/font/google'");
    expect(layout).toContain('Noto_Sans_Georgian');
    expect(layout).toContain("subsets: ['georgian']");
    expect(layout).toContain('Source_Sans_3');
    expect(layout).toContain("'cyrillic'");
    expect(layout).toContain("'cyrillic-ext'");
    expect(layout).toContain('Fraunces');
    expect(layout).toContain('--font-agro-georgian');
    expect(css).toContain('var(--font-agro-georgian)');
  });

  it('uses webpack for production builds so Turbopack does not resolve Google fonts', () => {
    expect(pkg.scripts.build).toBe('next build --webpack');
    expect(pkg.scripts.dev).toContain('--turbopack');
    expect(dockerfile).toContain('pnpm --filter @agrobridge/web build');
    expect(dockerfile).not.toContain('next build\n');
  });
});
