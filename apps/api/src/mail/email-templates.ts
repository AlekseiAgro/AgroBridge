import type { Locale } from '@agrobridge/shared';
import type { EmailTemplateKey } from './mail.types';

type EmailTemplate = {
  subject: string;
  text: string;
};

const en: Record<EmailTemplateKey, EmailTemplate> = {
  welcome: {
    subject: 'Welcome to AgroBridge',
    text: 'Hello {{name}},\n\nYour {{role}} account is ready. Sign in and start connecting Georgian farms with buyers.\n\nOpen AgroBridge: {{link}}\n\n— AgroBridge',
  },
  rfqCreated: {
    subject: 'New quote request for {{productTitle}}',
    text: 'Hello {{name}},\n\n{{buyerName}} requested a quote for {{productTitle}} ({{quantity}}{{unit}}).\n\nView request: {{link}}\n\n— AgroBridge',
  },
  rfqOfferCreated: {
    subject: 'New offer for {{productTitle}}',
    text: 'Hello {{name}},\n\n{{farmName}} sent an offer for {{productTitle}}: {{priceAmount}} {{currency}}.\n\nView offer: {{link}}\n\n— AgroBridge',
  },
  rfqAccepted: {
    subject: 'Offer accepted for {{productTitle}}',
    text: 'Hello {{name}},\n\n{{buyerName}} accepted your offer for {{productTitle}}.\n\nView request: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByBuyer: {
    subject: 'Offer declined for {{productTitle}}',
    text: 'Hello {{name}},\n\n{{buyerName}} declined your offer for {{productTitle}}.\n\nView request: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByFarmer: {
    subject: 'Quote request declined for {{productTitle}}',
    text: 'Hello {{name}},\n\n{{farmName}} declined your quote request for {{productTitle}}.\n\nView request: {{link}}\n\n— AgroBridge',
  },
  rfqCancelled: {
    subject: 'Quote request cancelled for {{productTitle}}',
    text: 'Hello {{name}},\n\n{{buyerName}} cancelled the quote request for {{productTitle}}.\n\nView inbox: {{link}}\n\n— AgroBridge',
  },
  productApproved: {
    subject: 'Product approved: {{productTitle}}',
    text: 'Hello {{name}},\n\nYour product “{{productTitle}}” was approved and is now visible in the catalog.\n\nView product: {{link}}\n\n— AgroBridge',
  },
  productRejected: {
    subject: 'Product needs changes: {{productTitle}}',
    text: 'Hello {{name}},\n\nYour product “{{productTitle}}” was not approved.\n\nReason: {{note}}\n\nEdit product: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "New catalog listing: {{productTitle}}",
    text: "Hello {{name}},\n\nA new product matching your alert is in the AgroBridge catalog.\n\n{{productTitle}} from {{farmName}}{{categoryPart}}{{regionPart}}.\n\nView listing: {{link}}\n\nManage alerts: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "New purchase request: {{title}}",
    text: "Hello {{name}},\n\n{{buyerName}} published a purchase request matching your alert.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nView request: {{link}}\n\nManage alerts: {{settingsLink}}\n\n— AgroBridge",
  },
};

const ru: Record<EmailTemplateKey, EmailTemplate> = {
  welcome: {
    subject: 'Добро пожаловать в AgroBridge',
    text: 'Здравствуйте, {{name}}!\n\nВаш аккаунт ({{role}}) готов. Войдите и начните связывать грузинские хозяйства с покупателями.\n\nОткрыть AgroBridge: {{link}}\n\n— AgroBridge',
  },
  rfqCreated: {
    subject: 'Новый запрос цены: {{productTitle}}',
    text: 'Здравствуйте, {{name}}!\n\n{{buyerName}} запросил(а) цену на {{productTitle}} ({{quantity}}{{unit}}).\n\nОткрыть запрос: {{link}}\n\n— AgroBridge',
  },
  rfqOfferCreated: {
    subject: 'Новое предложение: {{productTitle}}',
    text: 'Здравствуйте, {{name}}!\n\n{{farmName}} отправил(а) предложение по {{productTitle}}: {{priceAmount}} {{currency}}.\n\nОткрыть предложение: {{link}}\n\n— AgroBridge',
  },
  rfqAccepted: {
    subject: 'Предложение принято: {{productTitle}}',
    text: 'Здравствуйте, {{name}}!\n\n{{buyerName}} принял(а) ваше предложение по {{productTitle}}.\n\nОткрыть запрос: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByBuyer: {
    subject: 'Предложение отклонено: {{productTitle}}',
    text: 'Здравствуйте, {{name}}!\n\n{{buyerName}} отклонил(а) ваше предложение по {{productTitle}}.\n\nОткрыть запрос: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByFarmer: {
    subject: 'Запрос цены отклонён: {{productTitle}}',
    text: 'Здравствуйте, {{name}}!\n\n{{farmName}} отклонил(а) ваш запрос по {{productTitle}}.\n\nОткрыть запрос: {{link}}\n\n— AgroBridge',
  },
  rfqCancelled: {
    subject: 'Запрос цены отменён: {{productTitle}}',
    text: 'Здравствуйте, {{name}}!\n\n{{buyerName}} отменил(а) запрос по {{productTitle}}.\n\nОткрыть входящие: {{link}}\n\n— AgroBridge',
  },
  productApproved: {
    subject: 'Товар одобрен: {{productTitle}}',
    text: 'Здравствуйте, {{name}}!\n\nВаш товар «{{productTitle}}» одобрен и доступен в каталоге.\n\nОткрыть товар: {{link}}\n\n— AgroBridge',
  },
  productRejected: {
    subject: 'Нужны правки по товару: {{productTitle}}',
    text: 'Здравствуйте, {{name}}!\n\nТовар «{{productTitle}}» не одобрен.\n\nПричина: {{note}}\n\nРедактировать: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "Новое объявление: {{productTitle}}",
    text: "Здравствуйте, {{name}}!\n\nВ каталоге AgroBridge появился товар по вашей подписке.\n\n{{productTitle}} от {{farmName}}{{categoryPart}}{{regionPart}}.\n\nОткрыть объявление: {{link}}\n\nНастройки подписки: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "Новый запрос на покупку: {{title}}",
    text: "Здравствуйте, {{name}}!\n\n{{buyerName}} опубликовал(а) запрос на покупку по вашей подписке.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nОткрыть запрос: {{link}}\n\nНастройки подписки: {{settingsLink}}\n\n— AgroBridge",
  },
};

const de: Record<EmailTemplateKey, EmailTemplate> = {
  welcome: {
    subject: 'Willkommen bei AgroBridge',
    text: 'Hallo {{name}},\n\nIhr {{role}}-Konto ist bereit. Melden Sie sich an und verbinden Sie georgische Betriebe mit Käufern.\n\nAgroBridge öffnen: {{link}}\n\n— AgroBridge',
  },
  rfqCreated: {
    subject: 'Neue Preisanfrage für {{productTitle}}',
    text: 'Hallo {{name}},\n\n{{buyerName}} hat eine Preisanfrage für {{productTitle}} gestellt ({{quantity}}{{unit}}).\n\nAnfrage ansehen: {{link}}\n\n— AgroBridge',
  },
  rfqOfferCreated: {
    subject: 'Neues Angebot für {{productTitle}}',
    text: 'Hallo {{name}},\n\n{{farmName}} hat ein Angebot für {{productTitle}} gesendet: {{priceAmount}} {{currency}}.\n\nAngebot ansehen: {{link}}\n\n— AgroBridge',
  },
  rfqAccepted: {
    subject: 'Angebot angenommen: {{productTitle}}',
    text: 'Hallo {{name}},\n\n{{buyerName}} hat Ihr Angebot für {{productTitle}} angenommen.\n\nAnfrage ansehen: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByBuyer: {
    subject: 'Angebot abgelehnt: {{productTitle}}',
    text: 'Hallo {{name}},\n\n{{buyerName}} hat Ihr Angebot für {{productTitle}} abgelehnt.\n\nAnfrage ansehen: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByFarmer: {
    subject: 'Preisanfrage abgelehnt: {{productTitle}}',
    text: 'Hallo {{name}},\n\n{{farmName}} hat Ihre Anfrage für {{productTitle}} abgelehnt.\n\nAnfrage ansehen: {{link}}\n\n— AgroBridge',
  },
  rfqCancelled: {
    subject: 'Preisanfrage storniert: {{productTitle}}',
    text: 'Hallo {{name}},\n\n{{buyerName}} hat die Anfrage für {{productTitle}} storniert.\n\nPosteingang öffnen: {{link}}\n\n— AgroBridge',
  },
  productApproved: {
    subject: 'Produkt freigegeben: {{productTitle}}',
    text: 'Hallo {{name}},\n\nIhr Produkt „{{productTitle}}“ wurde freigegeben und ist im Katalog sichtbar.\n\nProdukt ansehen: {{link}}\n\n— AgroBridge',
  },
  productRejected: {
    subject: 'Produkt benötigt Änderungen: {{productTitle}}',
    text: 'Hallo {{name}},\n\nIhr Produkt „{{productTitle}}“ wurde nicht freigegeben.\n\nGrund: {{note}}\n\nProdukt bearbeiten: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "Neues Angebot: {{productTitle}}",
    text: "Hallo {{name}},\n\nEin neues Produkt passend zu Ihrem Alert ist im AgroBridge-Katalog.\n\n{{productTitle}} von {{farmName}}{{categoryPart}}{{regionPart}}.\n\nAngebot öffnen: {{link}}\n\nAlerts verwalten: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "Neue Kaufanfrage: {{title}}",
    text: "Hallo {{name}},\n\n{{buyerName}} hat eine Kaufanfrage passend zu Ihrem Alert veröffentlicht.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nAnfrage öffnen: {{link}}\n\nAlerts verwalten: {{settingsLink}}\n\n— AgroBridge",
  },
};

const fr: Record<EmailTemplateKey, EmailTemplate> = {
  welcome: {
    subject: 'Bienvenue sur AgroBridge',
    text: 'Bonjour {{name}},\n\nVotre compte {{role}} est prêt. Connectez-vous et reliez les fermes géorgiennes aux acheteurs.\n\nOuvrir AgroBridge : {{link}}\n\n— AgroBridge',
  },
  rfqCreated: {
    subject: 'Nouvelle demande de devis : {{productTitle}}',
    text: 'Bonjour {{name}},\n\n{{buyerName}} a demandé un devis pour {{productTitle}} ({{quantity}}{{unit}}).\n\nVoir la demande : {{link}}\n\n— AgroBridge',
  },
  rfqOfferCreated: {
    subject: 'Nouvelle offre : {{productTitle}}',
    text: 'Bonjour {{name}},\n\n{{farmName}} a envoyé une offre pour {{productTitle}} : {{priceAmount}} {{currency}}.\n\nVoir l’offre : {{link}}\n\n— AgroBridge',
  },
  rfqAccepted: {
    subject: 'Offre acceptée : {{productTitle}}',
    text: 'Bonjour {{name}},\n\n{{buyerName}} a accepté votre offre pour {{productTitle}}.\n\nVoir la demande : {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByBuyer: {
    subject: 'Offre refusée : {{productTitle}}',
    text: 'Bonjour {{name}},\n\n{{buyerName}} a refusé votre offre pour {{productTitle}}.\n\nVoir la demande : {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByFarmer: {
    subject: 'Demande de devis refusée : {{productTitle}}',
    text: 'Bonjour {{name}},\n\n{{farmName}} a refusé votre demande pour {{productTitle}}.\n\nVoir la demande : {{link}}\n\n— AgroBridge',
  },
  rfqCancelled: {
    subject: 'Demande de devis annulée : {{productTitle}}',
    text: 'Bonjour {{name}},\n\n{{buyerName}} a annulé la demande pour {{productTitle}}.\n\nOuvrir la boîte de réception : {{link}}\n\n— AgroBridge',
  },
  productApproved: {
    subject: 'Produit approuvé : {{productTitle}}',
    text: 'Bonjour {{name}},\n\nVotre produit « {{productTitle}} » a été approuvé et est visible dans le catalogue.\n\nVoir le produit : {{link}}\n\n— AgroBridge',
  },
  productRejected: {
    subject: 'Modifications nécessaires : {{productTitle}}',
    text: 'Bonjour {{name}},\n\nVotre produit « {{productTitle}} » n’a pas été approuvé.\n\nMotif : {{note}}\n\nModifier le produit : {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "Nouvelle annonce : {{productTitle}}",
    text: "Bonjour {{name}},\n\nUn nouveau produit correspondant à votre alerte est dans le catalogue AgroBridge.\n\n{{productTitle}} de {{farmName}}{{categoryPart}}{{regionPart}}.\n\nVoir l’annonce : {{link}}\n\nGérer les alertes : {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "Nouvelle demande d’achat : {{title}}",
    text: "Bonjour {{name}},\n\n{{buyerName}} a publié une demande d’achat correspondant à votre alerte.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nVoir la demande : {{link}}\n\nGérer les alertes : {{settingsLink}}\n\n— AgroBridge",
  },
};

const it: Record<EmailTemplateKey, EmailTemplate> = {
  welcome: {
    subject: 'Benvenuto su AgroBridge',
    text: 'Ciao {{name}},\n\nIl tuo account {{role}} è pronto. Accedi e collega le aziende agricole georgiane agli acquirenti.\n\nApri AgroBridge: {{link}}\n\n— AgroBridge',
  },
  rfqCreated: {
    subject: 'Nuova richiesta di preventivo: {{productTitle}}',
    text: 'Ciao {{name}},\n\n{{buyerName}} ha richiesto un preventivo per {{productTitle}} ({{quantity}}{{unit}}).\n\nVedi richiesta: {{link}}\n\n— AgroBridge',
  },
  rfqOfferCreated: {
    subject: 'Nuova offerta: {{productTitle}}',
    text: 'Ciao {{name}},\n\n{{farmName}} ha inviato un’offerta per {{productTitle}}: {{priceAmount}} {{currency}}.\n\nVedi offerta: {{link}}\n\n— AgroBridge',
  },
  rfqAccepted: {
    subject: 'Offerta accettata: {{productTitle}}',
    text: 'Ciao {{name}},\n\n{{buyerName}} ha accettato la tua offerta per {{productTitle}}.\n\nVedi richiesta: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByBuyer: {
    subject: 'Offerta rifiutata: {{productTitle}}',
    text: 'Ciao {{name}},\n\n{{buyerName}} ha rifiutato la tua offerta per {{productTitle}}.\n\nVedi richiesta: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByFarmer: {
    subject: 'Richiesta rifiutata: {{productTitle}}',
    text: 'Ciao {{name}},\n\n{{farmName}} ha rifiutato la tua richiesta per {{productTitle}}.\n\nVedi richiesta: {{link}}\n\n— AgroBridge',
  },
  rfqCancelled: {
    subject: 'Richiesta annullata: {{productTitle}}',
    text: 'Ciao {{name}},\n\n{{buyerName}} ha annullato la richiesta per {{productTitle}}.\n\nApri inbox: {{link}}\n\n— AgroBridge',
  },
  productApproved: {
    subject: 'Prodotto approvato: {{productTitle}}',
    text: 'Ciao {{name}},\n\nIl tuo prodotto “{{productTitle}}” è stato approvato ed è visibile nel catalogo.\n\nVedi prodotto: {{link}}\n\n— AgroBridge',
  },
  productRejected: {
    subject: 'Modifiche richieste: {{productTitle}}',
    text: 'Ciao {{name}},\n\nIl tuo prodotto “{{productTitle}}” non è stato approvato.\n\nMotivo: {{note}}\n\nModifica prodotto: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "Nuovo annuncio: {{productTitle}}",
    text: "Ciao {{name}},\n\nUn nuovo prodotto corrispondente al tuo avviso è nel catalogo AgroBridge.\n\n{{productTitle}} di {{farmName}}{{categoryPart}}{{regionPart}}.\n\nVedi annuncio: {{link}}\n\nGestisci avvisi: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "Nuova richiesta di acquisto: {{title}}",
    text: "Ciao {{name}},\n\n{{buyerName}} ha pubblicato una richiesta di acquisto corrispondente al tuo avviso.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nVedi richiesta: {{link}}\n\nGestisci avvisi: {{settingsLink}}\n\n— AgroBridge",
  },
};

const es: Record<EmailTemplateKey, EmailTemplate> = {
  welcome: {
    subject: 'Bienvenido a AgroBridge',
    text: 'Hola {{name}},\n\nTu cuenta de {{role}} está lista. Inicia sesión y conecta granjas georgianas con compradores.\n\nAbrir AgroBridge: {{link}}\n\n— AgroBridge',
  },
  rfqCreated: {
    subject: 'Nueva solicitud de precio: {{productTitle}}',
    text: 'Hola {{name}},\n\n{{buyerName}} solicitó un precio para {{productTitle}} ({{quantity}}{{unit}}).\n\nVer solicitud: {{link}}\n\n— AgroBridge',
  },
  rfqOfferCreated: {
    subject: 'Nueva oferta: {{productTitle}}',
    text: 'Hola {{name}},\n\n{{farmName}} envió una oferta para {{productTitle}}: {{priceAmount}} {{currency}}.\n\nVer oferta: {{link}}\n\n— AgroBridge',
  },
  rfqAccepted: {
    subject: 'Oferta aceptada: {{productTitle}}',
    text: 'Hola {{name}},\n\n{{buyerName}} aceptó tu oferta para {{productTitle}}.\n\nVer solicitud: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByBuyer: {
    subject: 'Oferta rechazada: {{productTitle}}',
    text: 'Hola {{name}},\n\n{{buyerName}} rechazó tu oferta para {{productTitle}}.\n\nVer solicitud: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByFarmer: {
    subject: 'Solicitud rechazada: {{productTitle}}',
    text: 'Hola {{name}},\n\n{{farmName}} rechazó tu solicitud para {{productTitle}}.\n\nVer solicitud: {{link}}\n\n— AgroBridge',
  },
  rfqCancelled: {
    subject: 'Solicitud cancelada: {{productTitle}}',
    text: 'Hola {{name}},\n\n{{buyerName}} canceló la solicitud para {{productTitle}}.\n\nAbrir bandeja: {{link}}\n\n— AgroBridge',
  },
  productApproved: {
    subject: 'Producto aprobado: {{productTitle}}',
    text: 'Hola {{name}},\n\nTu producto “{{productTitle}}” fue aprobado y ya es visible en el catálogo.\n\nVer producto: {{link}}\n\n— AgroBridge',
  },
  productRejected: {
    subject: 'Se requieren cambios: {{productTitle}}',
    text: 'Hola {{name}},\n\nTu producto “{{productTitle}}” no fue aprobado.\n\nMotivo: {{note}}\n\nEditar producto: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "Nuevo anuncio: {{productTitle}}",
    text: "Hola {{name}},\n\nHay un nuevo producto de tu alerta en el catálogo de AgroBridge.\n\n{{productTitle}} de {{farmName}}{{categoryPart}}{{regionPart}}.\n\nVer anuncio: {{link}}\n\nGestionar alertas: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "Nueva solicitud de compra: {{title}}",
    text: "Hola {{name}},\n\n{{buyerName}} publicó una solicitud de compra de tu alerta.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nVer solicitud: {{link}}\n\nGestionar alertas: {{settingsLink}}\n\n— AgroBridge",
  },
};

const ka: Record<EmailTemplateKey, EmailTemplate> = {
  welcome: {
    subject: 'კეთილი იყოს თქვენი მობრძანება AgroBridge-ზე',
    text: 'გამარჯობა, {{name}}!\n\nთქვენი {{role}} ანგარიში მზადაა. შედით და დააკავშირეთ ქართული მეურნეობები მყიდველებთან.\n\nAgroBridge-ის გახსნა: {{link}}\n\n— AgroBridge',
  },
  rfqCreated: {
    subject: 'ახალი ფასის მოთხოვნა: {{productTitle}}',
    text: 'გამარჯობა, {{name}}!\n\n{{buyerName}}-მა მოითხოვა ფასი პროდუქტზე {{productTitle}} ({{quantity}}{{unit}}).\n\nმოთხოვნის ნახვა: {{link}}\n\n— AgroBridge',
  },
  rfqOfferCreated: {
    subject: 'ახალი შეთავაზება: {{productTitle}}',
    text: 'გამარჯობა, {{name}}!\n\n{{farmName}}-მა გამოგიგზავნათ შეთავაზება პროდუქტზე {{productTitle}}: {{priceAmount}} {{currency}}.\n\nშეთავაზების ნახვა: {{link}}\n\n— AgroBridge',
  },
  rfqAccepted: {
    subject: 'შეთავაზება მიღებულია: {{productTitle}}',
    text: 'გამარჯობა, {{name}}!\n\n{{buyerName}}-მა მიიღო თქვენი შეთავაზება პროდუქტზე {{productTitle}}.\n\nმოთხოვნის ნახვა: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByBuyer: {
    subject: 'შეთავაზება უარყოფილია: {{productTitle}}',
    text: 'გამარჯობა, {{name}}!\n\n{{buyerName}}-მა უარყო თქვენი შეთავაზება პროდუქტზე {{productTitle}}.\n\nმოთხოვნის ნახვა: {{link}}\n\n— AgroBridge',
  },
  rfqDeclinedByFarmer: {
    subject: 'ფასის მოთხოვნა უარყოფილია: {{productTitle}}',
    text: 'გამარჯობა, {{name}}!\n\n{{farmName}}-მა უარყო თქვენი მოთხოვნა პროდუქტზე {{productTitle}}.\n\nმოთხოვნის ნახვა: {{link}}\n\n— AgroBridge',
  },
  rfqCancelled: {
    subject: 'ფასის მოთხოვნა გაუქმებულია: {{productTitle}}',
    text: 'გამარჯობა, {{name}}!\n\n{{buyerName}}-მა გააუქმა მოთხოვნა პროდუქტზე {{productTitle}}.\n\nშემოსულების გახსნა: {{link}}\n\n— AgroBridge',
  },
  productApproved: {
    subject: 'პროდუქტი დამტკიცებულია: {{productTitle}}',
    text: 'გამარჯობა, {{name}}!\n\nთქვენი პროდუქტი „{{productTitle}}“ დამტკიცდა და უკვე ჩანს კატალოგში.\n\nპროდუქტის ნახვა: {{link}}\n\n— AgroBridge',
  },
  productRejected: {
    subject: 'საჭიროა ცვლილებები: {{productTitle}}',
    text: 'გამარჯობა, {{name}}!\n\nთქვენი პროდუქტი „{{productTitle}}“ არ დამტკიცდა.\n\nმიზეზი: {{note}}\n\nრედაქტირება: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "ახალი განცხადება: {{productTitle}}",
    text: "გამარჯობა, {{name}}!\n\nთქვენს გაფრთხილებასთან შესაბამისი ახალი პროდუქტი გამოჩნდა AgroBridge-ის კატალოგში.\n\n{{productTitle}} — {{farmName}}{{categoryPart}}{{regionPart}}.\n\nგანცხადების ნახვა: {{link}}\n\nგაფრთხილებების მართვა: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "ახალი შესყიდვის მოთხოვნა: {{title}}",
    text: "გამარჯობა, {{name}}!\n\n{{buyerName}}-მა გამოაქვეყნა თქვენს გაფრთხილებასთან შესაბამისი შესყიდვის მოთხოვნა.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nმოთხოვნის ნახვა: {{link}}\n\nგაფრთხილებების მართვა: {{settingsLink}}\n\n— AgroBridge",
  },
};

export const EMAIL_TEMPLATES: Record<Locale, Record<EmailTemplateKey, EmailTemplate>> = {
  en,
  ru,
  de,
  fr,
  it,
  es,
  ka,
};

export function renderEmailTemplate(
  locale: string,
  key: EmailTemplateKey,
  vars: Record<string, string>,
): EmailTemplate {
  const pack = EMAIL_TEMPLATES[(locale as Locale) in EMAIL_TEMPLATES ? (locale as Locale) : 'en'];
  const template = pack[key] ?? EMAIL_TEMPLATES.en[key];
  const replace = (input: string) =>
    input.replace(/\{\{(\w+)\}\}/g, (_, name: string) => vars[name] ?? '');

  return {
    subject: replace(template.subject),
    text: replace(template.text),
  };
}
