import { NotFoundPanel } from '@/components/NotFoundPanel';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

export default async function LocaleNotFound() {
  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <NotFoundPanel />
      </main>
      <SiteFooter />
    </div>
  );
}
