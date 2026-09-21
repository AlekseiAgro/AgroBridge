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
  productPendingModeration: {
    subject: 'Product awaiting review: {{productTitle}}',
    text: 'Hello {{name}},\n\n{{sellerName}} submitted “{{productTitle}}” for moderation.\n\nOpen admin review queue: {{link}}\n\n— AgroBridge',
  },
  verificationPendingModeration: {
    subject: 'New producer verification request: {{farmName}}',
    text: 'Hello {{name}},\n\nA producer submitted verification documents for review.\n\nFarm: {{farmName}} (ID {{farmId}})\nSeller type: {{sellerType}}\nSubmitted: {{submittedAt}}\n\nOpen the verification queue: {{link}}\n\n— AgroBridge',
  },
  verificationApproved: {
    subject: 'Verification approved: {{farmName}}',
    text: 'Hello {{name}},\n\nYour verification is complete: {{farmName}} is now a verified producer on AgroBridge.\n\nOpen your producer profile: {{link}}\n\n— AgroBridge',
  },
  verificationRejected: {
    subject: 'Verification not approved: {{farmName}}',
    text: 'Hello {{name}},\n\nThe verification of {{farmName}} was not approved.\n\nReason: {{reason}}{{comment}}\n\nYou can fix this and submit the verification again: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "New catalog listing: {{productTitle}}",
    text: "Hello {{name}},\n\nA new product matching your alert is in the AgroBridge catalog.\n\n{{productTitle}} from {{farmName}}{{categoryPart}}{{regionPart}}.\n\nView listing: {{link}}\n\nManage alerts: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "New purchase request: {{title}}",
    text: "Hello {{name}},\n\n{{buyerName}} published a purchase request matching your alert.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nView request: {{link}}\n\nManage alerts: {{settingsLink}}\n\n— AgroBridge",
  },
  verificationCode: {
    subject: "Your AgroBridge verification code",
    text: "Hello {{name}},\n\nYour verification code is {{code}}.\nIt expires in 10 minutes.\n\n— AgroBridge",
  },
  accountDeletionCode: {
    subject: "Confirm account deletion on AgroBridge",
    text: "Hello {{name}},\n\nWe received a request to permanently delete your AgroBridge account.\nYour confirmation code is {{code}}.\nIt expires in 10 minutes.\n\nIf you did not request this, ignore this email and keep your account.\n\n— AgroBridge",
  },
  emailChangeCode: {
    subject: "Confirm email change on AgroBridge",
    text: "Hello {{name}},\n\nWe received a request to change your AgroBridge login email to {{newEmail}}.\nYour confirmation code is {{code}}.\nIt expires in 10 minutes.\n\nIf you did not request this, ignore this email and keep your current address.\n\n— AgroBridge",
  },
  passwordReset: {
    subject: 'Reset your AgroBridge password',
    text: 'Hello {{name}},\n\nWe received a request to reset the password for your AgroBridge account.\n\nSet a new password using this link (it expires in {{expiresMinutes}} minutes):\n{{link}}\n\nIf you did not request this, you can ignore this email. Your password will stay the same.\n\n— AgroBridge',
  },
  harvestAvailable: {
    subject: "Harvest update: {{productTitle}} is {{statusLabel}}",
    text: "Hello {{name}},\n\n{{productTitle}} from {{farmName}} is now {{statusLabel}}.\n\nView listing: {{link}}\n\nManage watches from the product page.\n\n— AgroBridge",
  },
  harvestPreorderOpen: {
    subject: "Pre-orders open: {{productTitle}}",
    text: "Hello {{name}},\n\n{{farmName}} opened pre-orders for {{productTitle}}.\n\nView listing: {{link}}\n\n— AgroBridge",
  },
  purchaseQuoteReceived: {
    subject: 'New quote for {{title}}',
    text: 'Hello {{name}},\n\n{{farmName}} sent a quote for your purchase request “{{title}}”: {{priceAmount}} {{currency}}.\n\nView request: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteAccepted: {
    subject: 'Your quote was accepted: {{title}}',
    text: 'Hello {{name}},\n\n{{buyerName}} accepted your quote for the purchase request “{{title}}”.\n\nView request: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteDeclined: {
    subject: 'Your quote was not selected: {{title}}',
    text: 'Hello {{name}},\n\n{{buyerName}} did not select your quote for the purchase request “{{title}}”.\n\nBrowse open purchase requests: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteWithdrawn: {
    subject: 'Quote withdrawn: {{title}}',
    text: 'Hello {{name}},\n\n{{farmName}} withdrew a quote from your purchase request “{{title}}”.\n\nView request: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestClosed: {
    subject: 'Purchase request closed: {{title}}',
    text: 'Hello {{name}},\n\n{{buyerName}} closed the purchase request “{{title}}”, so your quote is no longer under consideration.\n\nBrowse open purchase requests: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestCancelled: {
    subject: 'Purchase request cancelled: {{title}}',
    text: 'Hello {{name}},\n\n{{buyerName}} cancelled the purchase request “{{title}}”, so your quote is no longer under consideration.\n\nBrowse open purchase requests: {{link}}\n\n— AgroBridge',
  },
  chatMessage: {
    subject: 'New message from {{senderName}}',
    text: 'Hello {{name}},\n\n{{senderName}} sent you a message on AgroBridge:\n\n“{{preview}}”\n\nOpen chat: {{link}}\n\n— AgroBridge',
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
  productPendingModeration: {
    subject: 'Товар на модерации: {{productTitle}}',
    text: 'Здравствуйте, {{name}}!\n\n{{sellerName}} отправил(а) «{{productTitle}}» на модерацию.\n\nОткрыть очередь модерации: {{link}}\n\n— AgroBridge',
  },
  verificationPendingModeration: {
    subject: 'Новая заявка на проверку производителя: {{farmName}}',
    text: 'Здравствуйте, {{name}}!\n\nПроизводитель отправил документы на проверку.\n\nХозяйство: {{farmName}} (ID {{farmId}})\nТип продавца: {{sellerType}}\nОтправлено: {{submittedAt}}\n\nОткрыть очередь проверки: {{link}}\n\n— AgroBridge',
  },
  verificationApproved: {
    subject: 'Верификация пройдена: {{farmName}}',
    text: 'Здравствуйте, {{name}}!\n\nПроверка завершена: «{{farmName}}» теперь проверенный производитель на AgroBridge.\n\nОткрыть профиль производителя: {{link}}\n\n— AgroBridge',
  },
  verificationRejected: {
    subject: 'Верификация отклонена: {{farmName}}',
    text: 'Здравствуйте, {{name}}!\n\nВерификация «{{farmName}}» не пройдена.\n\nПричина: {{reason}}{{comment}}\n\nВы можете устранить замечание и отправить документы повторно: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "Новое объявление: {{productTitle}}",
    text: "Здравствуйте, {{name}}!\n\nВ каталоге AgroBridge появился товар по вашей подписке.\n\n{{productTitle}} от {{farmName}}{{categoryPart}}{{regionPart}}.\n\nОткрыть объявление: {{link}}\n\nНастройки подписки: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "Новый запрос на покупку: {{title}}",
    text: "Здравствуйте, {{name}}!\n\n{{buyerName}} опубликовал(а) запрос на покупку по вашей подписке.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nОткрыть запрос: {{link}}\n\nНастройки подписки: {{settingsLink}}\n\n— AgroBridge",
  },
  verificationCode: {
    subject: "Код подтверждения AgroBridge",
    text: "Здравствуйте, {{name}}!\n\nВаш код подтверждения: {{code}}.\nОн действует 10 минут.\n\n— AgroBridge",
  },
  accountDeletionCode: {
    subject: "Подтверждение удаления аккаунта AgroBridge",
    text: "Здравствуйте, {{name}}!\n\nМы получили запрос на безвозвратное удаление вашего аккаунта AgroBridge.\nКод подтверждения: {{code}}.\nОн действует 10 минут.\n\nЕсли это были не вы — просто проигнорируйте письмо.\n\n— AgroBridge",
  },
  emailChangeCode: {
    subject: "Подтверждение смены email на AgroBridge",
    text: "Здравствуйте, {{name}}!\n\nМы получили запрос на смену email входа AgroBridge на {{newEmail}}.\nКод подтверждения: {{code}}.\nОн действует 10 минут.\n\nЕсли это были не вы — проигнорируйте письмо, текущий адрес останется без изменений.\n\n— AgroBridge",
  },
  passwordReset: {
    subject: 'Сброс пароля AgroBridge',
    text: 'Здравствуйте, {{name}}!\n\nМы получили запрос на сброс пароля вашей учётной записи AgroBridge.\n\nЗадайте новый пароль по этой ссылке (она действует {{expiresMinutes}} мин.):\n{{link}}\n\nЕсли это были не вы — просто проигнорируйте письмо. Пароль не изменится.\n\n— AgroBridge',
  },
  harvestAvailable: {
    subject: "Урожай: {{productTitle}} — {{statusLabel}}",
    text: "Здравствуйте, {{name}}!\n\n{{productTitle}} от {{farmName}} теперь в статусе «{{statusLabel}}».\n\nОткрыть объявление: {{link}}\n\n— AgroBridge",
  },
  harvestPreorderOpen: {
    subject: "Открыт предзаказ: {{productTitle}}",
    text: "Здравствуйте, {{name}}!\n\n{{farmName}} открыл(а) предзаказ на {{productTitle}}.\n\nОткрыть объявление: {{link}}\n\n— AgroBridge",
  },
  purchaseQuoteReceived: {
    subject: 'Новое предложение по запросу «{{title}}»',
    text: 'Здравствуйте, {{name}}!\n\n{{farmName}} прислал(а) предложение по вашему запросу на закупку «{{title}}»: {{priceAmount}} {{currency}}.\n\nОткрыть запрос: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteAccepted: {
    subject: 'Ваше предложение принято: «{{title}}»',
    text: 'Здравствуйте, {{name}}!\n\n{{buyerName}} принял(а) ваше предложение по запросу на закупку «{{title}}».\n\nОткрыть запрос: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteDeclined: {
    subject: 'Ваше предложение не выбрано: «{{title}}»',
    text: 'Здравствуйте, {{name}}!\n\n{{buyerName}} не выбрал(а) ваше предложение по запросу на закупку «{{title}}».\n\nСмотреть открытые запросы: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteWithdrawn: {
    subject: 'Предложение отозвано: «{{title}}»',
    text: 'Здравствуйте, {{name}}!\n\n{{farmName}} отозвал(а) предложение по вашему запросу на закупку «{{title}}».\n\nОткрыть запрос: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestClosed: {
    subject: 'Запрос на закупку закрыт: «{{title}}»',
    text: 'Здравствуйте, {{name}}!\n\n{{buyerName}} закрыл(а) запрос на закупку «{{title}}», ваше предложение больше не рассматривается.\n\nСмотреть открытые запросы: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestCancelled: {
    subject: 'Запрос на закупку отменён: «{{title}}»',
    text: 'Здравствуйте, {{name}}!\n\n{{buyerName}} отменил(а) запрос на закупку «{{title}}», ваше предложение больше не рассматривается.\n\nСмотреть открытые запросы: {{link}}\n\n— AgroBridge',
  },
  chatMessage: {
    subject: 'Новое сообщение от {{senderName}}',
    text: 'Здравствуйте, {{name}}!\n\n{{senderName}} написал(а) вам в чате AgroBridge:\n\n«{{preview}}»\n\nОткрыть чат: {{link}}\n\n— AgroBridge',
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
  productPendingModeration: {
    subject: 'Produkt zur Prüfung: {{productTitle}}',
    text: 'Hallo {{name}},\n\n{{sellerName}} hat „{{productTitle}}“ zur Moderation eingereicht.\n\nPrüfwarteschlange öffnen: {{link}}\n\n— AgroBridge',
  },
  verificationPendingModeration: {
    subject: 'Neue Produzenten-Verifizierung: {{farmName}}',
    text: 'Hallo {{name}},\n\nEin Produzent hat Verifizierungsdokumente zur Prüfung eingereicht.\n\nBetrieb: {{farmName}} (ID {{farmId}})\nVerkäufertyp: {{sellerType}}\nEingereicht: {{submittedAt}}\n\nPrüfwarteschlange öffnen: {{link}}\n\n— AgroBridge',
  },
  verificationApproved: {
    subject: 'Verifizierung bestätigt: {{farmName}}',
    text: 'Hallo {{name}},\n\nIhre Verifizierung ist abgeschlossen: „{{farmName}}“ ist jetzt ein verifizierter Produzent auf AgroBridge.\n\nProduzentenprofil öffnen: {{link}}\n\n— AgroBridge',
  },
  verificationRejected: {
    subject: 'Verifizierung nicht bestätigt: {{farmName}}',
    text: 'Hallo {{name}},\n\nDie Verifizierung von „{{farmName}}“ wurde nicht bestätigt.\n\nGrund: {{reason}}{{comment}}\n\nSie können den Punkt beheben und die Verifizierung erneut einreichen: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "Neues Angebot: {{productTitle}}",
    text: "Hallo {{name}},\n\nEin neues Produkt passend zu Ihrem Alert ist im AgroBridge-Katalog.\n\n{{productTitle}} von {{farmName}}{{categoryPart}}{{regionPart}}.\n\nAngebot öffnen: {{link}}\n\nAlerts verwalten: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "Neue Kaufanfrage: {{title}}",
    text: "Hallo {{name}},\n\n{{buyerName}} hat eine Kaufanfrage passend zu Ihrem Alert veröffentlicht.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nAnfrage öffnen: {{link}}\n\nAlerts verwalten: {{settingsLink}}\n\n— AgroBridge",
  },
  verificationCode: {
    subject: "Ihr AgroBridge-Bestätigungscode",
    text: "Hallo {{name}},\n\nIhr Bestätigungscode lautet {{code}}.\nEr ist 10 Minuten gültig.\n\n— AgroBridge",
  },
  accountDeletionCode: {
    subject: "Konto-Löschung bei AgroBridge bestätigen",
    text: "Hallo {{name}},\n\nWir haben eine Anfrage zur dauerhaften Löschung Ihres AgroBridge-Kontos erhalten.\nIhr Bestätigungscode lautet {{code}}.\nEr ist 10 Minuten gültig.\n\nWenn Sie das nicht waren, ignorieren Sie diese E-Mail.\n\n— AgroBridge",
  },
  emailChangeCode: {
    subject: "E-Mail-Änderung bei AgroBridge bestätigen",
    text: "Hallo {{name}},\n\nWir haben eine Anfrage erhalten, Ihre AgroBridge-Login-E-Mail auf {{newEmail}} zu ändern.\nIhr Bestätigungscode lautet {{code}}.\nEr ist 10 Minuten gültig.\n\nWenn Sie das nicht waren, ignorieren Sie diese E-Mail.\n\n— AgroBridge",
  },
  passwordReset: {
    subject: 'AgroBridge-Passwort zurücksetzen',
    text: 'Hallo {{name}},\n\nWir haben eine Anfrage zum Zurücksetzen Ihres AgroBridge-Passworts erhalten.\n\nNeues Passwort festlegen (der Link ist {{expiresMinutes}} Minuten gültig):\n{{link}}\n\nWenn Sie das nicht waren, ignorieren Sie diese E-Mail. Ihr Passwort bleibt unverändert.\n\n— AgroBridge',
  },
  harvestAvailable: {
    subject: "Ernte-Update: {{productTitle}} ist {{statusLabel}}",
    text: "Hallo {{name}},\n\n{{productTitle}} von {{farmName}} ist jetzt {{statusLabel}}.\n\nAngebot ansehen: {{link}}\n\n— AgroBridge",
  },
  harvestPreorderOpen: {
    subject: "Vorbestellungen offen: {{productTitle}}",
    text: "Hallo {{name}},\n\n{{farmName}} hat Vorbestellungen für {{productTitle}} geöffnet.\n\nAngebot ansehen: {{link}}\n\n— AgroBridge",
  },
  purchaseQuoteReceived: {
    subject: 'Neues Angebot für {{title}}',
    text: 'Hallo {{name}},\n\n{{farmName}} hat ein Angebot zu Ihrer Kaufanfrage „{{title}}“ gesendet: {{priceAmount}} {{currency}}.\n\nAnfrage öffnen: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteAccepted: {
    subject: 'Ihr Angebot wurde angenommen: {{title}}',
    text: 'Hallo {{name}},\n\n{{buyerName}} hat Ihr Angebot zur Kaufanfrage „{{title}}“ angenommen.\n\nAnfrage öffnen: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteDeclined: {
    subject: 'Ihr Angebot wurde nicht ausgewählt: {{title}}',
    text: 'Hallo {{name}},\n\n{{buyerName}} hat Ihr Angebot zur Kaufanfrage „{{title}}“ nicht ausgewählt.\n\nOffene Kaufanfragen ansehen: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteWithdrawn: {
    subject: 'Angebot zurückgezogen: {{title}}',
    text: 'Hallo {{name}},\n\n{{farmName}} hat ein Angebot zu Ihrer Kaufanfrage „{{title}}“ zurückgezogen.\n\nAnfrage öffnen: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestClosed: {
    subject: 'Kaufanfrage geschlossen: {{title}}',
    text: 'Hallo {{name}},\n\n{{buyerName}} hat die Kaufanfrage „{{title}}“ geschlossen; Ihr Angebot wird nicht weiter berücksichtigt.\n\nOffene Kaufanfragen ansehen: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestCancelled: {
    subject: 'Kaufanfrage storniert: {{title}}',
    text: 'Hallo {{name}},\n\n{{buyerName}} hat die Kaufanfrage „{{title}}“ storniert; Ihr Angebot wird nicht weiter berücksichtigt.\n\nOffene Kaufanfragen ansehen: {{link}}\n\n— AgroBridge',
  },
  chatMessage: {
    subject: 'Neue Nachricht von {{senderName}}',
    text: 'Hallo {{name}},\n\n{{senderName}} hat Ihnen auf AgroBridge geschrieben:\n\n„{{preview}}“\n\nChat öffnen: {{link}}\n\n— AgroBridge',
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
  productPendingModeration: {
    subject: 'Produit en attente de validation : {{productTitle}}',
    text: 'Bonjour {{name}},\n\n{{sellerName}} a soumis « {{productTitle}} » pour modération.\n\nOuvrir la file de modération : {{link}}\n\n— AgroBridge',
  },
  verificationPendingModeration: {
    subject: 'Nouvelle demande de vérification producteur : {{farmName}}',
    text: 'Bonjour {{name}},\n\nUn producteur a soumis des documents de vérification.\n\nExploitation : {{farmName}} (ID {{farmId}})\nType de vendeur : {{sellerType}}\nSoumis le : {{submittedAt}}\n\nOuvrir la file de vérification : {{link}}\n\n— AgroBridge',
  },
  verificationApproved: {
    subject: 'Vérification approuvée : {{farmName}}',
    text: 'Bonjour {{name}},\n\nVotre vérification est terminée : « {{farmName}} » est désormais un producteur vérifié sur AgroBridge.\n\nOuvrir votre profil producteur : {{link}}\n\n— AgroBridge',
  },
  verificationRejected: {
    subject: 'Vérification refusée : {{farmName}}',
    text: 'Bonjour {{name}},\n\nLa vérification de « {{farmName}} » n’a pas été approuvée.\n\nMotif : {{reason}}{{comment}}\n\nVous pouvez corriger le point signalé et soumettre à nouveau la vérification : {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "Nouvelle annonce : {{productTitle}}",
    text: "Bonjour {{name}},\n\nUn nouveau produit correspondant à votre alerte est dans le catalogue AgroBridge.\n\n{{productTitle}} de {{farmName}}{{categoryPart}}{{regionPart}}.\n\nVoir l’annonce : {{link}}\n\nGérer les alertes : {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "Nouvelle demande d’achat : {{title}}",
    text: "Bonjour {{name}},\n\n{{buyerName}} a publié une demande d’achat correspondant à votre alerte.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nVoir la demande : {{link}}\n\nGérer les alertes : {{settingsLink}}\n\n— AgroBridge",
  },
  verificationCode: {
    subject: "Votre code de vérification AgroBridge",
    text: "Bonjour {{name}},\n\nVotre code de vérification est {{code}}.\nIl expire dans 10 minutes.\n\n— AgroBridge",
  },
  accountDeletionCode: {
    subject: "Confirmez la suppression de votre compte AgroBridge",
    text: "Bonjour {{name}},\n\nNous avons reçu une demande de suppression définitive de votre compte AgroBridge.\nVotre code de confirmation est {{code}}.\nIl expire dans 10 minutes.\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.\n\n— AgroBridge",
  },
  emailChangeCode: {
    subject: "Confirmez le changement d’e-mail AgroBridge",
    text: "Bonjour {{name}},\n\nNous avons reçu une demande pour changer votre e-mail de connexion AgroBridge en {{newEmail}}.\nVotre code de confirmation est {{code}}.\nIl expire dans 10 minutes.\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.\n\n— AgroBridge",
  },
  passwordReset: {
    subject: 'Réinitialisez votre mot de passe AgroBridge',
    text: 'Bonjour {{name}},\n\nNous avons reçu une demande de réinitialisation du mot de passe de votre compte AgroBridge.\n\nDéfinissez un nouveau mot de passe via ce lien (valable {{expiresMinutes}} minutes) :\n{{link}}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail. Votre mot de passe restera inchangé.\n\n— AgroBridge',
  },
  harvestAvailable: {
    subject: "Récolte : {{productTitle}} est {{statusLabel}}",
    text: "Bonjour {{name}},\n\n{{productTitle}} de {{farmName}} est maintenant {{statusLabel}}.\n\nVoir l'annonce : {{link}}\n\n— AgroBridge",
  },
  harvestPreorderOpen: {
    subject: "Précommandes ouvertes : {{productTitle}}",
    text: "Bonjour {{name}},\n\n{{farmName}} a ouvert les précommandes pour {{productTitle}}.\n\nVoir l'annonce : {{link}}\n\n— AgroBridge",
  },
  purchaseQuoteReceived: {
    subject: 'Nouvelle offre pour {{title}}',
    text: 'Bonjour {{name}},\n\n{{farmName}} a envoyé une offre pour votre demande d’achat « {{title}} » : {{priceAmount}} {{currency}}.\n\nOuvrir la demande : {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteAccepted: {
    subject: 'Votre offre a été acceptée : {{title}}',
    text: 'Bonjour {{name}},\n\n{{buyerName}} a accepté votre offre pour la demande d’achat « {{title}} ».\n\nOuvrir la demande : {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteDeclined: {
    subject: 'Votre offre n’a pas été retenue : {{title}}',
    text: 'Bonjour {{name}},\n\n{{buyerName}} n’a pas retenu votre offre pour la demande d’achat « {{title}} ».\n\nVoir les demandes ouvertes : {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteWithdrawn: {
    subject: 'Offre retirée : {{title}}',
    text: 'Bonjour {{name}},\n\n{{farmName}} a retiré une offre de votre demande d’achat « {{title}} ».\n\nOuvrir la demande : {{link}}\n\n— AgroBridge',
  },
  purchaseRequestClosed: {
    subject: 'Demande d’achat clôturée : {{title}}',
    text: 'Bonjour {{name}},\n\n{{buyerName}} a clôturé la demande d’achat « {{title}} » ; votre offre n’est plus à l’étude.\n\nVoir les demandes ouvertes : {{link}}\n\n— AgroBridge',
  },
  purchaseRequestCancelled: {
    subject: 'Demande d’achat annulée : {{title}}',
    text: 'Bonjour {{name}},\n\n{{buyerName}} a annulé la demande d’achat « {{title}} » ; votre offre n’est plus à l’étude.\n\nVoir les demandes ouvertes : {{link}}\n\n— AgroBridge',
  },
  chatMessage: {
    subject: 'Nouveau message de {{senderName}}',
    text: 'Bonjour {{name}},\n\n{{senderName}} vous a écrit sur AgroBridge :\n\n« {{preview}} »\n\nOuvrir le chat : {{link}}\n\n— AgroBridge',
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
  productPendingModeration: {
    subject: 'Prodotto in revisione: {{productTitle}}',
    text: 'Ciao {{name}},\n\n{{sellerName}} ha inviato «{{productTitle}}» in moderazione.\n\nApri la coda di moderazione: {{link}}\n\n— AgroBridge',
  },
  verificationPendingModeration: {
    subject: 'Nuova richiesta di verifica produttore: {{farmName}}',
    text: 'Ciao {{name}},\n\nUn produttore ha inviato i documenti di verifica per la revisione.\n\nAzienda agricola: {{farmName}} (ID {{farmId}})\nTipo di venditore: {{sellerType}}\nInviato: {{submittedAt}}\n\nApri la coda di verifica: {{link}}\n\n— AgroBridge',
  },
  verificationApproved: {
    subject: 'Verifica approvata: {{farmName}}',
    text: 'Ciao {{name}},\n\nLa verifica è completata: «{{farmName}}» ora è un produttore verificato su AgroBridge.\n\nApri il profilo del produttore: {{link}}\n\n— AgroBridge',
  },
  verificationRejected: {
    subject: 'Verifica non approvata: {{farmName}}',
    text: 'Ciao {{name}},\n\nLa verifica di «{{farmName}}» non è stata approvata.\n\nMotivo: {{reason}}{{comment}}\n\nPuoi correggere il problema e inviare di nuovo la verifica: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "Nuovo annuncio: {{productTitle}}",
    text: "Ciao {{name}},\n\nUn nuovo prodotto corrispondente al tuo avviso è nel catalogo AgroBridge.\n\n{{productTitle}} di {{farmName}}{{categoryPart}}{{regionPart}}.\n\nVedi annuncio: {{link}}\n\nGestisci avvisi: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "Nuova richiesta di acquisto: {{title}}",
    text: "Ciao {{name}},\n\n{{buyerName}} ha pubblicato una richiesta di acquisto corrispondente al tuo avviso.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nVedi richiesta: {{link}}\n\nGestisci avvisi: {{settingsLink}}\n\n— AgroBridge",
  },
  verificationCode: {
    subject: "Il tuo codice di verifica AgroBridge",
    text: "Ciao {{name}},\n\nIl tuo codice di verifica è {{code}}.\nScade tra 10 minuti.\n\n— AgroBridge",
  },
  accountDeletionCode: {
    subject: "Conferma eliminazione account AgroBridge",
    text: "Ciao {{name}},\n\nAbbiamo ricevuto una richiesta di eliminazione permanente del tuo account AgroBridge.\nIl codice di conferma è {{code}}.\nScade tra 10 minuti.\n\nSe non sei stato tu, ignora questa email.\n\n— AgroBridge",
  },
  emailChangeCode: {
    subject: "Conferma cambio email AgroBridge",
    text: "Ciao {{name}},\n\nAbbiamo ricevuto una richiesta di cambio dell’email di accesso AgroBridge in {{newEmail}}.\nIl codice di conferma è {{code}}.\nScade tra 10 minuti.\n\nSe non sei stato tu, ignora questa email.\n\n— AgroBridge",
  },
  passwordReset: {
    subject: 'Reimposta la password AgroBridge',
    text: 'Ciao {{name}},\n\nAbbiamo ricevuto una richiesta di reimpostazione della password del tuo account AgroBridge.\n\nImposta una nuova password da questo link (scade tra {{expiresMinutes}} minuti):\n{{link}}\n\nSe non sei stato tu, ignora questa email. La password resterà invariata.\n\n— AgroBridge',
  },
  harvestAvailable: {
    subject: "Raccolto: {{productTitle}} è {{statusLabel}}",
    text: "Ciao {{name}},\n\n{{productTitle}} di {{farmName}} è ora {{statusLabel}}.\n\nVedi l'annuncio: {{link}}\n\n— AgroBridge",
  },
  harvestPreorderOpen: {
    subject: "Preordini aperti: {{productTitle}}",
    text: "Ciao {{name}},\n\n{{farmName}} ha aperto i preordini per {{productTitle}}.\n\nVedi l'annuncio: {{link}}\n\n— AgroBridge",
  },
  purchaseQuoteReceived: {
    subject: 'Nuova offerta per {{title}}',
    text: 'Ciao {{name}},\n\n{{farmName}} ha inviato un’offerta per la tua richiesta di acquisto «{{title}}»: {{priceAmount}} {{currency}}.\n\nApri la richiesta: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteAccepted: {
    subject: 'La tua offerta è stata accettata: {{title}}',
    text: 'Ciao {{name}},\n\n{{buyerName}} ha accettato la tua offerta per la richiesta di acquisto «{{title}}».\n\nApri la richiesta: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteDeclined: {
    subject: 'La tua offerta non è stata scelta: {{title}}',
    text: 'Ciao {{name}},\n\n{{buyerName}} non ha scelto la tua offerta per la richiesta di acquisto «{{title}}».\n\nVedi le richieste aperte: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteWithdrawn: {
    subject: 'Offerta ritirata: {{title}}',
    text: 'Ciao {{name}},\n\n{{farmName}} ha ritirato un’offerta dalla tua richiesta di acquisto «{{title}}».\n\nApri la richiesta: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestClosed: {
    subject: 'Richiesta di acquisto chiusa: {{title}}',
    text: 'Ciao {{name}},\n\n{{buyerName}} ha chiuso la richiesta di acquisto «{{title}}»: la tua offerta non è più in esame.\n\nVedi le richieste aperte: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestCancelled: {
    subject: 'Richiesta di acquisto annullata: {{title}}',
    text: 'Ciao {{name}},\n\n{{buyerName}} ha annullato la richiesta di acquisto «{{title}}»: la tua offerta non è più in esame.\n\nVedi le richieste aperte: {{link}}\n\n— AgroBridge',
  },
  chatMessage: {
    subject: 'Nuovo messaggio da {{senderName}}',
    text: 'Ciao {{name}},\n\n{{senderName}} ti ha scritto su AgroBridge:\n\n«{{preview}}»\n\nApri la chat: {{link}}\n\n— AgroBridge',
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
  productPendingModeration: {
    subject: 'Producto pendiente de revisión: {{productTitle}}',
    text: 'Hola {{name}},\n\n{{sellerName}} ha enviado «{{productTitle}}» a moderación.\n\nAbrir la cola de moderación: {{link}}\n\n— AgroBridge',
  },
  verificationPendingModeration: {
    subject: 'Nueva solicitud de verificación de productor: {{farmName}}',
    text: 'Hola {{name}},\n\nUn productor ha enviado documentos de verificación para su revisión.\n\nGranja: {{farmName}} (ID {{farmId}})\nTipo de vendedor: {{sellerType}}\nEnviado: {{submittedAt}}\n\nAbrir la cola de verificación: {{link}}\n\n— AgroBridge',
  },
  verificationApproved: {
    subject: 'Verificación aprobada: {{farmName}}',
    text: 'Hola {{name}},\n\nSu verificación está completa: «{{farmName}}» ya es un productor verificado en AgroBridge.\n\nAbrir su perfil de productor: {{link}}\n\n— AgroBridge',
  },
  verificationRejected: {
    subject: 'Verificación no aprobada: {{farmName}}',
    text: 'Hola {{name}},\n\nLa verificación de «{{farmName}}» no fue aprobada.\n\nMotivo: {{reason}}{{comment}}\n\nPuede corregirlo y enviar la verificación de nuevo: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "Nuevo anuncio: {{productTitle}}",
    text: "Hola {{name}},\n\nHay un nuevo producto de tu alerta en el catálogo de AgroBridge.\n\n{{productTitle}} de {{farmName}}{{categoryPart}}{{regionPart}}.\n\nVer anuncio: {{link}}\n\nGestionar alertas: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "Nueva solicitud de compra: {{title}}",
    text: "Hola {{name}},\n\n{{buyerName}} publicó una solicitud de compra de tu alerta.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nVer solicitud: {{link}}\n\nGestionar alertas: {{settingsLink}}\n\n— AgroBridge",
  },
  verificationCode: {
    subject: "Tu código de verificación de AgroBridge",
    text: "Hola {{name}},\n\nTu código de verificación es {{code}}.\nCaduca en 10 minutos.\n\n— AgroBridge",
  },
  accountDeletionCode: {
    subject: "Confirma la eliminación de tu cuenta AgroBridge",
    text: "Hola {{name}},\n\nRecibimos una solicitud para eliminar permanentemente tu cuenta de AgroBridge.\nTu código de confirmación es {{code}}.\nCaduca en 10 minutos.\n\nSi no fuiste tú, ignora este correo.\n\n— AgroBridge",
  },
  emailChangeCode: {
    subject: "Confirma el cambio de email en AgroBridge",
    text: "Hola {{name}},\n\nRecibimos una solicitud para cambiar tu email de acceso de AgroBridge a {{newEmail}}.\nTu código de confirmación es {{code}}.\nCaduca en 10 minutos.\n\nSi no fuiste tú, ignora este correo.\n\n— AgroBridge",
  },
  passwordReset: {
    subject: 'Restablece tu contraseña de AgroBridge',
    text: 'Hola {{name}},\n\nRecibimos una solicitud para restablecer la contraseña de tu cuenta AgroBridge.\n\nElige una nueva contraseña con este enlace (caduca en {{expiresMinutes}} minutos):\n{{link}}\n\nSi no fuiste tú, ignora este correo. Tu contraseña no cambiará.\n\n— AgroBridge',
  },
  harvestAvailable: {
    subject: "Cosecha: {{productTitle}} está {{statusLabel}}",
    text: "Hola {{name}},\n\n{{productTitle}} de {{farmName}} ahora está {{statusLabel}}.\n\nVer anuncio: {{link}}\n\n— AgroBridge",
  },
  harvestPreorderOpen: {
    subject: "Preventa abierta: {{productTitle}}",
    text: "Hola {{name}},\n\n{{farmName}} abrió la preventa de {{productTitle}}.\n\nVer anuncio: {{link}}\n\n— AgroBridge",
  },
  purchaseQuoteReceived: {
    subject: 'Nueva oferta para {{title}}',
    text: 'Hola {{name}},\n\n{{farmName}} ha enviado una oferta para tu solicitud de compra «{{title}}»: {{priceAmount}} {{currency}}.\n\nAbrir la solicitud: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteAccepted: {
    subject: 'Tu oferta ha sido aceptada: {{title}}',
    text: 'Hola {{name}},\n\n{{buyerName}} ha aceptado tu oferta para la solicitud de compra «{{title}}».\n\nAbrir la solicitud: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteDeclined: {
    subject: 'Tu oferta no ha sido seleccionada: {{title}}',
    text: 'Hola {{name}},\n\n{{buyerName}} no ha seleccionado tu oferta para la solicitud de compra «{{title}}».\n\nVer solicitudes abiertas: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteWithdrawn: {
    subject: 'Oferta retirada: {{title}}',
    text: 'Hola {{name}},\n\n{{farmName}} retiró una oferta de tu solicitud de compra «{{title}}».\n\nAbrir la solicitud: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestClosed: {
    subject: 'Solicitud de compra cerrada: {{title}}',
    text: 'Hola {{name}},\n\n{{buyerName}} ha cerrado la solicitud de compra «{{title}}»; tu oferta ya no está en consideración.\n\nVer solicitudes abiertas: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestCancelled: {
    subject: 'Solicitud de compra cancelada: {{title}}',
    text: 'Hola {{name}},\n\n{{buyerName}} ha cancelado la solicitud de compra «{{title}}»; tu oferta ya no está en consideración.\n\nVer solicitudes abiertas: {{link}}\n\n— AgroBridge',
  },
  chatMessage: {
    subject: 'Nuevo mensaje de {{senderName}}',
    text: 'Hola {{name}},\n\n{{senderName}} te ha escrito en AgroBridge:\n\n«{{preview}}»\n\nAbrir el chat: {{link}}\n\n— AgroBridge',
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
  productPendingModeration: {
    subject: 'პროდუქტი მოდერაციაზე: {{productTitle}}',
    text: 'გამარჯობა, {{name}}!\n\n{{sellerName}}-მა გააგზავნა „{{productTitle}}“ მოდერაციაზე.\n\nმოდერაციის რიგის გახსნა: {{link}}\n\n— AgroBridge',
  },
  verificationPendingModeration: {
    subject: 'მწარმოებლის ვერიფიკაციის ახალი განაცხადი: {{farmName}}',
    text: 'გამარჯობა, {{name}}!\n\nმწარმოებელმა გამოაგზავნა ვერიფიკაციის დოკუმენტები შესამოწმებლად.\n\nმეურნეობა: {{farmName}} (ID {{farmId}})\nგამყიდველის ტიპი: {{sellerType}}\nგაგზავნილია: {{submittedAt}}\n\nვერიფიკაციის რიგის გახსნა: {{link}}\n\n— AgroBridge',
  },
  verificationApproved: {
    subject: 'ვერიფიკაცია დადასტურდა: {{farmName}}',
    text: 'გამარჯობა, {{name}}!\n\nვერიფიკაცია დასრულდა: „{{farmName}}“ უკვე დადასტურებული მწარმოებელია AgroBridge-ზე.\n\nმწარმოებლის პროფილის გახსნა: {{link}}\n\n— AgroBridge',
  },
  verificationRejected: {
    subject: 'ვერიფიკაცია არ დადასტურდა: {{farmName}}',
    text: 'გამარჯობა, {{name}}!\n\n„{{farmName}}“-ის ვერიფიკაცია არ დადასტურდა.\n\nმიზეზი: {{reason}}{{comment}}\n\nშეგიძლიათ გამოასწოროთ და ხელახლა გამოაგზავნოთ ვერიფიკაცია: {{link}}\n\n— AgroBridge',
  },
  newProductListing: {
    subject: "ახალი განცხადება: {{productTitle}}",
    text: "გამარჯობა, {{name}}!\n\nთქვენს გაფრთხილებასთან შესაბამისი ახალი პროდუქტი გამოჩნდა AgroBridge-ის კატალოგში.\n\n{{productTitle}} — {{farmName}}{{categoryPart}}{{regionPart}}.\n\nგანცხადების ნახვა: {{link}}\n\nგაფრთხილებების მართვა: {{settingsLink}}\n\n— AgroBridge",
  },
  newPurchaseRequest: {
    subject: "ახალი შესყიდვის მოთხოვნა: {{title}}",
    text: "გამარჯობა, {{name}}!\n\n{{buyerName}}-მა გამოაქვეყნა თქვენს გაფრთხილებასთან შესაბამისი შესყიდვის მოთხოვნა.\n\n{{title}} — {{quantity}}{{unit}}{{categoryPart}}.\n\nმოთხოვნის ნახვა: {{link}}\n\nგაფრთხილებების მართვა: {{settingsLink}}\n\n— AgroBridge",
  },
  verificationCode: {
    subject: "AgroBridge-ის ვერიფიკაციის კოდი",
    text: "გამარჯობა, {{name}}!\n\nთქვენი ვერიფიკაციის კოდია {{code}}.\nმოქმედებს 10 წუთი.\n\n— AgroBridge",
  },
  accountDeletionCode: {
    subject: "AgroBridge ანგარიშის წაშლის დადასტურება",
    text: "გამარჯობა {{name}},\n\nმივიღეთ თქვენი AgroBridge ანგარიშის სამუდამოდ წაშლის მოთხოვნა.\nდადასტურების კოდი: {{code}}.\nკოდი მოქმედებს 10 წუთი.\n\nთუ ეს თქვენ არ ყოფილხართ, უბრალოდ დააიგნორეთ ეს წერილი.\n\n— AgroBridge",
  },
  emailChangeCode: {
    subject: "AgroBridge ელფოსტის შეცვლის დადასტურება",
    text: "გამარჯობა {{name}},\n\nმივიღეთ თქვენი AgroBridge შესვლის ელფოსტის {{newEmail}-ზე შეცვლის მოთხოვნა.\nდადასტურების კოდი: {{code}}.\nკოდი მოქმედებს 10 წუთი.\n\nთუ ეს თქვენ არ ყოფილხართ, უბრალოდ დააიგნორეთ ეს წერილი.\n\n— AgroBridge",
  },
  passwordReset: {
    subject: 'AgroBridge პაროლის აღდგენა',
    text: 'გამარჯობა {{name}},\n\nმივიღეთ თქვენი AgroBridge ანგარიშის პაროლის აღდგენის მოთხოვნა.\n\nახალი პაროლი დააყენეთ ამ ბმულით (მოქმედებს {{expiresMinutes}} წუთი):\n{{link}}\n\nთუ ეს თქვენ არ ყოფილხართ, უბრალოდ დააიგნორეთ ეს წერილი. პაროლი არ შეიცვლება.\n\n— AgroBridge',
  },
  harvestAvailable: {
    subject: "მოსავალი: {{productTitle}} — {{statusLabel}}",
    text: "გამარჯობა, {{name}}!\n\n{{farmName}}-ის {{productTitle}} ახლა {{statusLabel}} სტატუსშია.\n\nნახვა: {{link}}\n\n— AgroBridge",
  },
  harvestPreorderOpen: {
    subject: "წინასწარი შეკვეთა გაიხსნა: {{productTitle}}",
    text: "გამარჯობა, {{name}}!\n\n{{farmName}}-მა გახსნა წინასწარი შეკვეთა {{productTitle}}-ზე.\n\nნახვა: {{link}}\n\n— AgroBridge",
  },
  purchaseQuoteReceived: {
    subject: 'ახალი შეთავაზება: {{title}}',
    text: 'გამარჯობა, {{name}}!\n\n{{farmName}}-მა გამოგზავნა შეთავაზება თქვენს შესყიდვის მოთხოვნაზე „{{title}}“: {{priceAmount}} {{currency}}.\n\nმოთხოვნის გახსნა: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteAccepted: {
    subject: 'თქვენი შეთავაზება მიღებულია: {{title}}',
    text: 'გამარჯობა, {{name}}!\n\n{{buyerName}}-მა მიიღო თქვენი შეთავაზება შესყიდვის მოთხოვნაზე „{{title}}“.\n\nმოთხოვნის გახსნა: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteDeclined: {
    subject: 'თქვენი შეთავაზება არ შეირჩა: {{title}}',
    text: 'გამარჯობა, {{name}}!\n\n{{buyerName}}-მა არ შეარჩია თქვენი შეთავაზება შესყიდვის მოთხოვნაზე „{{title}}“.\n\nღია მოთხოვნების ნახვა: {{link}}\n\n— AgroBridge',
  },
  purchaseQuoteWithdrawn: {
    subject: 'შეთავაზება გაუქმდა: {{title}}',
    text: 'გამარჯობა, {{name}}!\n\n{{farmName}}-მა გაიხმო შეთავაზება თქვენი შესყიდვის მოთხოვნიდან „{{title}}“.\n\nმოთხოვნის გახსნა: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestClosed: {
    subject: 'შესყიდვის მოთხოვნა დაიხურა: {{title}}',
    text: 'გამარჯობა, {{name}}!\n\n{{buyerName}}-მა დახურა შესყიდვის მოთხოვნა „{{title}}“, თქვენი შეთავაზება აღარ განიხილება.\n\nღია მოთხოვნების ნახვა: {{link}}\n\n— AgroBridge',
  },
  purchaseRequestCancelled: {
    subject: 'შესყიდვის მოთხოვნა გაუქმდა: {{title}}',
    text: 'გამარჯობა, {{name}}!\n\n{{buyerName}}-მა გააუქმა შესყიდვის მოთხოვნა „{{title}}“, თქვენი შეთავაზება აღარ განიხილება.\n\nღია მოთხოვნების ნახვა: {{link}}\n\n— AgroBridge',
  },
  chatMessage: {
    subject: 'ახალი შეტყობინება: {{senderName}}',
    text: 'გამარჯობა, {{name}}!\n\n{{senderName}}-მა მოგწერათ AgroBridge-ის ჩატში:\n\n„{{preview}}“\n\nჩატის გახსნა: {{link}}\n\n— AgroBridge',
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
