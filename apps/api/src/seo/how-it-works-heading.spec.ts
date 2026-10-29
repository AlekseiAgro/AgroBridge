import { readFileSync } from 'fs';
import { join } from 'path';

const WEB_SRC = join(__dirname, '../../../web/src');

function readWeb(path: string) {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

describe('How It Works heading hierarchy', () => {
  const section = readWeb('components/HowItWorksSection.tsx');
  const page = readWeb('app/[locale]/how-it-works/page.tsx');
  const home = readWeb('app/[locale]/page.tsx');

  it('renders the section title as h2 by default and steps one level below', () => {
    expect(section).toContain("headingLevel = 'h2'");
    expect(section).toContain("const StepHeading = headingLevel === 'h1' ? 'h2' : 'h3';");
    expect(section).toContain('<Heading className="how-it-works__title">');
    expect(section).toContain('<StepHeading className="how-it-works__step-title">');
    expect(section).not.toMatch(/<h[1-6][\s>]/);
  });

  it('gives the How It Works page exactly one h1, from the section title', () => {
    expect(page).toContain('<HowItWorksSection showActions headingLevel="h1" />');
    expect(page).not.toMatch(/<h1[\s>]/);
  });

  it('leaves the homepage with its own single h1 and the section as h2', () => {
    expect(home.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(home).toContain('<h1 className="home__headline">');
    expect(home).toContain('<HowItWorksSection />');
    expect(home).not.toContain('headingLevel');
  });

  it('keeps the section title size when it is the page h1', () => {
    const css = readFileSync(join(WEB_SRC, 'app/globals.css'), 'utf8');
    expect(css).toContain(
      '.page__main .how-it-works__title {\n  margin: 0 0 0.75rem;\n  font-size: clamp(1.6rem, 3.5vw, 2.3rem);\n}',
    );
  });
});
