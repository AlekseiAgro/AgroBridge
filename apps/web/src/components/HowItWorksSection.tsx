import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const STEPS = ['find', 'connect', 'agree'] as const;

type Props = {
  id?: string;
  showActions?: boolean;
};

export async function HowItWorksSection({
  id = 'how-it-works',
  showActions = true,
}: Props) {
  const t = await getTranslations('howItWorks');

  return (
    <section id={id} className="how-it-works">
      <p className="how-it-works__eyebrow">{t('eyebrow')}</p>
      <h2 className="how-it-works__title">{t('title')}</h2>
      <p className="how-it-works__lead">{t('lead')}</p>

      <ol className="how-it-works__steps">
        {STEPS.map((step, index) => (
          <li key={step} className="how-it-works__step">
            <span className="how-it-works__number" aria-hidden>
              {index + 1}
            </span>
            <div>
              <h3 className="how-it-works__step-title">{t(`steps.${step}.title`)}</h3>
              <p className="how-it-works__step-text">{t(`steps.${step}.text`)}</p>
            </div>
          </li>
        ))}
      </ol>

      {showActions ? (
        <div className="how-it-works__actions">
          <Link className="button button--primary" href="/buyers">
            {t('ctaBuyer')}
          </Link>
          <Link className="button button--accent" href="/sellers">
            {t('ctaFarmer')}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
