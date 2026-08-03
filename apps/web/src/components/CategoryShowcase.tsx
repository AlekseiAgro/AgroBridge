import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CATEGORY_MEDIA, SHOWCASE_CATEGORIES } from '@/lib/category-media';

export async function CategoryShowcase() {
  const t = await getTranslations('home');
  const tc = await getTranslations('catalog');

  return (
    <section className="category-showcase" aria-labelledby="category-showcase-title">
      <div className="category-showcase__intro">
        <h2 id="category-showcase-title" className="category-showcase__title">
          {t('categoriesTitle')}
        </h2>
        <p className="category-showcase__lead">{t('categoriesLead')}</p>
      </div>

      <ul className="category-showcase__grid">
        {SHOWCASE_CATEGORIES.map((category) => (
          <li key={category}>
            <Link
              href={`/catalog?category=${category}`}
              className="category-tile"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CATEGORY_MEDIA[category]}
                alt=""
                className="category-tile__image"
              />
              <span className="category-tile__veil" aria-hidden />
              <span className="category-tile__label">
                {tc(`categories.${category}`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
