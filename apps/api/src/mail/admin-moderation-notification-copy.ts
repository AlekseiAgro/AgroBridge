import type { Locale } from '@agrobridge/shared';
import type { InAppCopy } from './in-app-notification-copy';

function withNote(body: string, note: string | null | undefined): string {
  const trimmed = note?.trim();
  return trimmed ? `${body} ${trimmed}` : body;
}

export function productApprovedCopy(locale: Locale, productTitle: string): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Товар одобрен',
        body: `Объявление «${productTitle}» опубликовано.`,
      };
    case 'ka':
      return {
        title: 'პროდუქტი დამტკიცდა',
        body: `განცხადება «${productTitle}» გამოქვეყნდა.`,
      };
    case 'de':
      return {
        title: 'Produkt freigegeben',
        body: `Die Anzeige „${productTitle}“ ist jetzt öffentlich.`,
      };
    case 'fr':
      return {
        title: 'Produit approuvé',
        body: `L’annonce « ${productTitle} » est publiée.`,
      };
    case 'it':
      return {
        title: 'Prodotto approvato',
        body: `L’annuncio «${productTitle}» è pubblicato.`,
      };
    case 'es':
      return {
        title: 'Producto aprobado',
        body: `El anuncio «${productTitle}» ya está publicado.`,
      };
    default:
      return {
        title: 'Product approved',
        body: `The listing “${productTitle}” is now published.`,
      };
  }
}

export function productRejectedCopy(
  locale: Locale,
  productTitle: string,
  note: string | null | undefined,
): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Товар отклонён',
        body: withNote(`Объявление «${productTitle}» не одобрено.`, note),
      };
    case 'ka':
      return {
        title: 'პროდუქტი უარყოფილია',
        body: withNote(`განცხადება «${productTitle}» არ დამტკიცდა.`, note),
      };
    case 'de':
      return {
        title: 'Produkt abgelehnt',
        body: withNote(`Die Anzeige „${productTitle}“ wurde nicht freigegeben.`, note),
      };
    case 'fr':
      return {
        title: 'Produit refusé',
        body: withNote(`L’annonce « ${productTitle} » n’a pas été approuvée.`, note),
      };
    case 'it':
      return {
        title: 'Prodotto rifiutato',
        body: withNote(`L’annuncio «${productTitle}» non è stato approvato.`, note),
      };
    case 'es':
      return {
        title: 'Producto rechazado',
        body: withNote(`El anuncio «${productTitle}» no fue aprobado.`, note),
      };
    default:
      return {
        title: 'Product rejected',
        body: withNote(`The listing “${productTitle}” was not approved.`, note),
      };
  }
}

export function verificationApprovedCopy(locale: Locale, farmName: string): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Верификация пройдена',
        body: `Хозяйство «${farmName}» подтверждено.`,
      };
    case 'ka':
      return {
        title: 'ვერიფიკაცია დასრულდა',
        body: `მეურნეობა «${farmName}» დადასტურებულია.`,
      };
    case 'de':
      return {
        title: 'Verifizierung bestätigt',
        body: `Der Betrieb „${farmName}“ ist verifiziert.`,
      };
    case 'fr':
      return {
        title: 'Vérification acceptée',
        body: `L’exploitation « ${farmName} » est vérifiée.`,
      };
    case 'it':
      return {
        title: 'Verifica approvata',
        body: `L’azienda «${farmName}» è verificata.`,
      };
    case 'es':
      return {
        title: 'Verificación aprobada',
        body: `La explotación «${farmName}» está verificada.`,
      };
    default:
      return {
        title: 'Verification approved',
        body: `“${farmName}” is now a verified producer.`,
      };
  }
}

export function verificationRejectedCopy(
  locale: Locale,
  farmName: string,
  reason: string,
  comment: string | null | undefined,
): InAppCopy {
  const body = withNote(`${reason}`.trim(), comment);
  switch (locale) {
    case 'ru':
      return { title: `Верификация отклонена: ${farmName}`, body };
    case 'ka':
      return { title: `ვერიფიკაცია უარყოფილია: ${farmName}`, body };
    case 'de':
      return { title: `Verifizierung abgelehnt: ${farmName}`, body };
    case 'fr':
      return { title: `Vérification refusée : ${farmName}`, body };
    case 'it':
      return { title: `Verifica rifiutata: ${farmName}`, body };
    case 'es':
      return { title: `Verificación rechazada: ${farmName}`, body };
    default:
      return { title: `Verification not approved: ${farmName}`, body };
  }
}

export function farmDocumentApprovedCopy(locale: Locale, documentTitle: string): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Документ одобрен',
        body: `Документ «${documentTitle}» принят модератором.`,
      };
    case 'ka':
      return {
        title: 'დოკუმენტი დამტკიცდა',
        body: `დოკუმენტი «${documentTitle}» მიღებულია.`,
      };
    case 'de':
      return {
        title: 'Dokument freigegeben',
        body: `Das Dokument „${documentTitle}“ wurde akzeptiert.`,
      };
    case 'fr':
      return {
        title: 'Document approuvé',
        body: `Le document « ${documentTitle} » a été accepté.`,
      };
    case 'it':
      return {
        title: 'Documento approvato',
        body: `Il documento «${documentTitle}» è stato accettato.`,
      };
    case 'es':
      return {
        title: 'Documento aprobado',
        body: `El documento «${documentTitle}» fue aceptado.`,
      };
    default:
      return {
        title: 'Document approved',
        body: `The document “${documentTitle}” was accepted.`,
      };
  }
}

export function farmDocumentRejectedCopy(
  locale: Locale,
  documentTitle: string,
  note: string | null | undefined,
): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Документ отклонён',
        body: withNote(`Документ «${documentTitle}» не принят.`, note),
      };
    case 'ka':
      return {
        title: 'დოკუმენტი უარყოფილია',
        body: withNote(`დოკუმენტი «${documentTitle}» არ იქნა მიღებული.`, note),
      };
    case 'de':
      return {
        title: 'Dokument abgelehnt',
        body: withNote(`Das Dokument „${documentTitle}“ wurde nicht akzeptiert.`, note),
      };
    case 'fr':
      return {
        title: 'Document refusé',
        body: withNote(`Le document « ${documentTitle} » n’a pas été accepté.`, note),
      };
    case 'it':
      return {
        title: 'Documento rifiutato',
        body: withNote(`Il documento «${documentTitle}» non è stato accettato.`, note),
      };
    case 'es':
      return {
        title: 'Documento rechazado',
        body: withNote(`El documento «${documentTitle}» no fue aceptado.`, note),
      };
    default:
      return {
        title: 'Document rejected',
        body: withNote(`The document “${documentTitle}” was not accepted.`, note),
      };
  }
}

export function productCertificateApprovedCopy(
  locale: Locale,
  certificateTitle: string,
  productTitle: string,
): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Сертификат одобрен',
        body: `Сертификат «${certificateTitle}» для товара «${productTitle}» принят.`,
      };
    case 'ka':
      return {
        title: 'სერტიფიკატი დამტკიცდა',
        body: `სერტიფიკატი «${certificateTitle}» პროდუქტისთვის «${productTitle}» მიღებულია.`,
      };
    case 'de':
      return {
        title: 'Zertifikat freigegeben',
        body: `Das Zertifikat „${certificateTitle}“ für „${productTitle}“ wurde akzeptiert.`,
      };
    case 'fr':
      return {
        title: 'Certificat approuvé',
        body: `Le certificat « ${certificateTitle} » pour « ${productTitle} » a été accepté.`,
      };
    case 'it':
      return {
        title: 'Certificato approvato',
        body: `Il certificato «${certificateTitle}» per «${productTitle}» è stato accettato.`,
      };
    case 'es':
      return {
        title: 'Certificado aprobado',
        body: `El certificado «${certificateTitle}» de «${productTitle}» fue aceptado.`,
      };
    default:
      return {
        title: 'Certificate approved',
        body: `The certificate “${certificateTitle}” for “${productTitle}” was accepted.`,
      };
  }
}

export function productCertificateRejectedCopy(
  locale: Locale,
  certificateTitle: string,
  productTitle: string,
  note: string | null | undefined,
): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Сертификат отклонён',
        body: withNote(
          `Сертификат «${certificateTitle}» для товара «${productTitle}» не принят.`,
          note,
        ),
      };
    case 'ka':
      return {
        title: 'სერტიფიკატი უარყოფილია',
        body: withNote(
          `სერტიფიკატი «${certificateTitle}» პროდუქტისთვის «${productTitle}» არ იქნა მიღებული.`,
          note,
        ),
      };
    case 'de':
      return {
        title: 'Zertifikat abgelehnt',
        body: withNote(
          `Das Zertifikat „${certificateTitle}“ für „${productTitle}“ wurde nicht akzeptiert.`,
          note,
        ),
      };
    case 'fr':
      return {
        title: 'Certificat refusé',
        body: withNote(
          `Le certificat « ${certificateTitle} » pour « ${productTitle} » n’a pas été accepté.`,
          note,
        ),
      };
    case 'it':
      return {
        title: 'Certificato rifiutato',
        body: withNote(
          `Il certificato «${certificateTitle}» per «${productTitle}» non è stato accettato.`,
          note,
        ),
      };
    case 'es':
      return {
        title: 'Certificado rechazado',
        body: withNote(
          `El certificado «${certificateTitle}» de «${productTitle}» no fue aceptado.`,
          note,
        ),
      };
    default:
      return {
        title: 'Certificate rejected',
        body: withNote(
          `The certificate “${certificateTitle}” for “${productTitle}” was not accepted.`,
          note,
        ),
      };
  }
}

export function purchaseRequestModeratedCopy(
  locale: Locale,
  title: string,
  note: string | null | undefined,
): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Запрос снят модератором',
        body: withNote(`Запрос на покупку «${title}» снят с доски.`, note),
      };
    case 'ka':
      return {
        title: 'მოთხოვნა მოხსნა მოდერატორმა',
        body: withNote(`შესყიდვის მოთხოვნა «${title}» მოხსნილია.`, note),
      };
    case 'de':
      return {
        title: 'Anfrage durch Moderator entfernt',
        body: withNote(`Die Kaufanfrage „${title}“ wurde entfernt.`, note),
      };
    case 'fr':
      return {
        title: 'Demande retirée par un modérateur',
        body: withNote(`La demande d’achat « ${title} » a été retirée.`, note),
      };
    case 'it':
      return {
        title: 'Richiesta rimossa dal moderatore',
        body: withNote(`La richiesta di acquisto «${title}» è stata rimossa.`, note),
      };
    case 'es':
      return {
        title: 'Solicitud retirada por un moderador',
        body: withNote(`La solicitud de compra «${title}» fue retirada.`, note),
      };
    default:
      return {
        title: 'Request removed by moderator',
        body: withNote(`The purchase request “${title}” was removed from the board.`, note),
      };
  }
}
