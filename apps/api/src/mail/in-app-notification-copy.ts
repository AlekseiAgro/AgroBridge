import type { Locale } from '@agrobridge/shared';

export type InAppCopy = { title: string; body: string };

/**
 * Stored in-app titles/bodies. Locale is the recipient's profile locale at write time,
 * matching email-templates.ts so the cabinet never hard-codes one language.
 */
export function newPurchaseRequestCopy(
  locale: Locale,
  buyerName: string,
  title: string,
): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Новый запрос на покупку',
        body: `${buyerName} опубликовал(а) запрос на покупку «${title}».`,
      };
    case 'ka':
      return {
        title: 'ახალი შესყიდვის მოთხოვნა',
        body: `${buyerName} გამოაქვეყნა შესყიდვის მოთხოვნა «${title}».`,
      };
    case 'de':
      return {
        title: 'Neue Kaufanfrage',
        body: `${buyerName} hat die Kaufanfrage „${title}“ veröffentlicht.`,
      };
    case 'fr':
      return {
        title: 'Nouvelle demande d’achat',
        body: `${buyerName} a publié la demande d’achat « ${title} ».`,
      };
    case 'it':
      return {
        title: 'Nuova richiesta di acquisto',
        body: `${buyerName} ha pubblicato la richiesta di acquisto «${title}».`,
      };
    case 'es':
      return {
        title: 'Nueva solicitud de compra',
        body: `${buyerName} publicó la solicitud de compra «${title}».`,
      };
    default:
      return {
        title: 'New purchase request',
        body: `${buyerName} published the purchase request “${title}”.`,
      };
  }
}

export function chatMessageCopy(locale: Locale, senderName: string, preview: string): InAppCopy {
  switch (locale) {
    case 'ru':
      return { title: 'Новое сообщение', body: `${senderName}: ${preview}` };
    case 'ka':
      return { title: 'ახალი შეტყობინება', body: `${senderName}: ${preview}` };
    case 'de':
      return { title: 'Neue Nachricht', body: `${senderName}: ${preview}` };
    case 'fr':
      return { title: 'Nouveau message', body: `${senderName} : ${preview}` };
    case 'it':
      return { title: 'Nuovo messaggio', body: `${senderName}: ${preview}` };
    case 'es':
      return { title: 'Nuevo mensaje', body: `${senderName}: ${preview}` };
    default:
      return { title: 'New message', body: `${senderName}: ${preview}` };
  }
}

export function rfqCreatedCopy(locale: Locale, buyerName: string, productTitle: string): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Новый запрос по вашему товару',
        body: `${buyerName} отправил(а) запрос по товару «${productTitle}».`,
      };
    case 'ka':
      return {
        title: 'ახალი მოთხოვნა თქვენს პროდუქტზე',
        body: `${buyerName} გამოგიგზავნათ მოთხოვნა პროდუქტზე «${productTitle}».`,
      };
    case 'de':
      return {
        title: 'Neue Anfrage zu Ihrem Produkt',
        body: `${buyerName} hat eine Anfrage zu „${productTitle}“ gesendet.`,
      };
    case 'fr':
      return {
        title: 'Nouvelle demande pour votre produit',
        body: `${buyerName} a envoyé une demande pour « ${productTitle} ».`,
      };
    case 'it':
      return {
        title: 'Nuova richiesta per il tuo prodotto',
        body: `${buyerName} ha inviato una richiesta per «${productTitle}».`,
      };
    case 'es':
      return {
        title: 'Nueva solicitud para tu producto',
        body: `${buyerName} envió una solicitud para «${productTitle}».`,
      };
    default:
      return {
        title: 'New request for your product',
        body: `${buyerName} sent a request for “${productTitle}”.`,
      };
  }
}

export function rfqOfferCreatedCopy(
  locale: Locale,
  farmName: string,
  productTitle: string,
): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Новое предложение',
        body: `${farmName} отправил(а) предложение по товару «${productTitle}».`,
      };
    case 'ka':
      return {
        title: 'ახალი შეთავაზება',
        body: `${farmName} გამოგიგზავნათ შეთავაზება პროდუქტზე «${productTitle}».`,
      };
    case 'de':
      return {
        title: 'Neues Angebot',
        body: `${farmName} hat ein Angebot zu „${productTitle}“ gesendet.`,
      };
    case 'fr':
      return {
        title: 'Nouvelle offre',
        body: `${farmName} a envoyé une offre pour « ${productTitle} ».`,
      };
    case 'it':
      return {
        title: 'Nuova offerta',
        body: `${farmName} ha inviato un’offerta per «${productTitle}».`,
      };
    case 'es':
      return {
        title: 'Nueva oferta',
        body: `${farmName} envió una oferta para «${productTitle}».`,
      };
    default:
      return {
        title: 'New offer',
        body: `${farmName} sent an offer for “${productTitle}”.`,
      };
  }
}

export function rfqAcceptedCopy(locale: Locale, buyerName: string, productTitle: string): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Предложение принято',
        body: `${buyerName} принял(а) ваше предложение по товару «${productTitle}».`,
      };
    case 'ka':
      return {
        title: 'შეთავაზება მიღებულია',
        body: `${buyerName} მიიღო თქვენი შეთავაზება პროდუქტზე «${productTitle}».`,
      };
    case 'de':
      return {
        title: 'Angebot angenommen',
        body: `${buyerName} hat Ihr Angebot zu „${productTitle}“ angenommen.`,
      };
    case 'fr':
      return {
        title: 'Offre acceptée',
        body: `${buyerName} a accepté votre offre pour « ${productTitle} ».`,
      };
    case 'it':
      return {
        title: 'Offerta accettata',
        body: `${buyerName} ha accettato la tua offerta per «${productTitle}».`,
      };
    case 'es':
      return {
        title: 'Oferta aceptada',
        body: `${buyerName} aceptó tu oferta para «${productTitle}».`,
      };
    default:
      return {
        title: 'Offer accepted',
        body: `${buyerName} accepted your offer for “${productTitle}”.`,
      };
  }
}

export function rfqDeclinedByBuyerCopy(
  locale: Locale,
  buyerName: string,
  productTitle: string,
): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Предложение отклонено',
        body: `${buyerName} отклонил(а) ваше предложение по товару «${productTitle}».`,
      };
    case 'ka':
      return {
        title: 'შეთავაზება უარყოფილია',
        body: `${buyerName} უარყო თქვენი შეთავაზება პროდუქტზე «${productTitle}».`,
      };
    case 'de':
      return {
        title: 'Angebot abgelehnt',
        body: `${buyerName} hat Ihr Angebot zu „${productTitle}“ abgelehnt.`,
      };
    case 'fr':
      return {
        title: 'Offre refusée',
        body: `${buyerName} a refusé votre offre pour « ${productTitle} ».`,
      };
    case 'it':
      return {
        title: 'Offerta rifiutata',
        body: `${buyerName} ha rifiutato la tua offerta per «${productTitle}».`,
      };
    case 'es':
      return {
        title: 'Oferta rechazada',
        body: `${buyerName} rechazó tu oferta para «${productTitle}».`,
      };
    default:
      return {
        title: 'Offer declined',
        body: `${buyerName} declined your offer for “${productTitle}”.`,
      };
  }
}

export function rfqDeclinedByFarmerCopy(
  locale: Locale,
  farmName: string,
  productTitle: string,
): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Запрос отклонён',
        body: `${farmName} отклонил(а) ваш запрос по товару «${productTitle}».`,
      };
    case 'ka':
      return {
        title: 'მოთხოვნა უარყოფილია',
        body: `${farmName} უარყო თქვენი მოთხოვნა პროდუქტზე «${productTitle}».`,
      };
    case 'de':
      return {
        title: 'Anfrage abgelehnt',
        body: `${farmName} hat Ihre Anfrage zu „${productTitle}“ abgelehnt.`,
      };
    case 'fr':
      return {
        title: 'Demande refusée',
        body: `${farmName} a refusé votre demande pour « ${productTitle} ».`,
      };
    case 'it':
      return {
        title: 'Richiesta rifiutata',
        body: `${farmName} ha rifiutato la tua richiesta per «${productTitle}».`,
      };
    case 'es':
      return {
        title: 'Solicitud rechazada',
        body: `${farmName} rechazó tu solicitud para «${productTitle}».`,
      };
    default:
      return {
        title: 'Request declined',
        body: `${farmName} declined your request for “${productTitle}”.`,
      };
  }
}

export function rfqCancelledCopy(locale: Locale, buyerName: string, productTitle: string): InAppCopy {
  switch (locale) {
    case 'ru':
      return {
        title: 'Запрос отменён',
        body: `${buyerName} отменил(а) запрос по товару «${productTitle}».`,
      };
    case 'ka':
      return {
        title: 'მოთხოვნა გაუქმდა',
        body: `${buyerName} გააუქმა მოთხოვნა პროდუქტზე «${productTitle}».`,
      };
    case 'de':
      return {
        title: 'Anfrage storniert',
        body: `${buyerName} hat die Anfrage zu „${productTitle}“ storniert.`,
      };
    case 'fr':
      return {
        title: 'Demande annulée',
        body: `${buyerName} a annulé la demande pour « ${productTitle} ».`,
      };
    case 'it':
      return {
        title: 'Richiesta annullata',
        body: `${buyerName} ha annullato la richiesta per «${productTitle}».`,
      };
    case 'es':
      return {
        title: 'Solicitud cancelada',
        body: `${buyerName} canceló la solicitud para «${productTitle}».`,
      };
    default:
      return {
        title: 'Request cancelled',
        body: `${buyerName} cancelled the request for “${productTitle}”.`,
      };
  }
}
