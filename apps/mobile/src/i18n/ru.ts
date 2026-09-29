import type { MessageKey } from './en';

/**
 * Partial Russian copy for the foundation chrome.
 * Missing keys fall back to English.
 * User-facing trade terms: запрос на покупку, предложение, маркетплейс, платформа.
 */
export const ru: Partial<Record<MessageKey, string>> = {
  'tabs.home': 'Главная',
  'tabs.requests': 'Запросы',
  'tabs.messages': 'Сообщения',
  'tabs.notifications': 'Уведомления',
  'tabs.account': 'Аккаунт',

  'home.platform': 'Глобальная B2B-платформа сельхозторговли',
  'home.notifications': 'Уведомления',
  'home.searchPlaceholder': 'Поиск товаров, хозяйств...',
  'home.searchLabel': 'Поиск товаров и хозяйств',
  'home.presentationNote': 'Пример оформления. Живой каталог пока не подключён.',
  'home.categories': 'Категории',
  'home.featured': 'Избранное',
  'home.newProducts': 'Новые товары',
  'home.opportunities': 'Запросы на покупку',
  'home.verifiedFarm': 'Хозяйство проверено',
  'home.country.georgia': 'Грузия',
  'home.loading': 'Загрузка главной',
  'home.emptySearchTitle': 'Ничего не найдено',
  'home.emptySearchBody': 'Попробуйте другой товар, хозяйство или категорию.',
  'home.clearSearch': 'Сбросить поиск',
  'home.loadErrorTitle': 'Не удалось загрузить экран',
  'home.loadErrorBody': 'Проверьте соединение и повторите попытку.',
  'home.retry': 'Повторить',

  'categories.fruits': 'Фрукты',
  'categories.vegetables': 'Овощи',
  'categories.berries': 'Ягоды',
  'categories.nuts': 'Орехи',
  'categories.wine': 'Вино',
  'categories.dairy': 'Молочные продукты',
  'categories.honey': 'Мёд',
  'categories.mineralWater': 'Минеральная вода',
  'categories.spices': 'Специи',
  'categories.tea': 'Чай',
  'categories.bayLeaf': 'Лавровый лист',
  'categories.essentialOils': 'Эфирные масла',
  'categories.organic': 'Органическая продукция',
  'categories.other': 'Другое',

  'regions.tbilisi': 'Тбилиси',
  'regions.adjara': 'Аджария',
  'regions.guria': 'Гурия',
  'regions.imereti': 'Имеретия',
  'regions.kakheti': 'Кахетия',
  'regions.kvemoKartli': 'Квемо Картли',
  'regions.mtskhetaMtianeti': 'Мцхета-Мтианети',
  'regions.rachaLechkhumiKvemoSvaneti': 'Рача-Лечхуми и Квемо Сванети',
  'regions.samegreloZemoSvaneti': 'Самегрело-Земо Сванети',
  'regions.samtskheJavakheti': 'Самцхе-Джавахети',
  'regions.shidaKartli': 'Шида Картли',

  'availability.growing': 'Растёт',
  'availability.available': 'Доступно',
  'availability.limited': 'Ограничено',
  'availability.soldOut': 'Распродано',

  'fixtures.products.saperavi.name': 'Саперави',
  'fixtures.products.honey.name': 'Горный мёд',
  'fixtures.products.hazelnuts.name': 'Фундук в скорлупе',
  'fixtures.products.water.name': 'Минеральная вода',
  'fixtures.products.tea.name': 'Чай ручного сбора',
  'fixtures.products.berries.name': 'Голубика',
  'fixtures.products.bayLeaf.name': 'Сушёный лавровый лист',

  'fixtures.requests.hazelnuts.title': 'Фундук для экспортной программы',
  'fixtures.requests.hazelnuts.quantity': '2 т',
  'fixtures.requests.grapes.title': 'Столовый виноград, поздний сезон',
  'fixtures.requests.grapes.quantity': '800 кг',
  'fixtures.requests.honey.title': 'Натуральный мёд в стеклянных банках',
  'fixtures.requests.honey.quantity': '400 кг',

  'requests.title': 'Запросы на покупку',
  'requests.emptyTitle': 'Запросов на покупку пока нет',
  'requests.emptyBody': 'Здесь появятся открытые запросы на покупку.',
  'requests.goHome': 'На главную',

  'messages.title': 'Сообщения',
  'messages.emptyTitle': 'Сообщений пока нет',
  'messages.emptyBody': 'Здесь появятся переписки по запросам на покупку и предложениям.',
  'messages.goHome': 'На главную',

  'notifications.title': 'Уведомления',
  'notifications.emptyTitle': 'Уведомлений пока нет',
  'notifications.emptyBody':
    'Здесь появятся важные события о запросах на покупку, предложениях и сообщениях.',
  'notifications.goHome': 'На главную',

  'account.title': 'Аккаунт',
  'account.dualCapability': 'Один аккаунт может и покупать, и продавать.',
  'account.sessionTitle': 'Сессия',
  'account.signedIn': 'Вы вошли в аккаунт.',
  'account.signedOut': 'Вы не вошли. Экран входа появится в следующем обновлении.',
  'account.profileUnavailable':
    'Вы вошли, но профиль не загрузился. Повторите, когда будете в сети.',
  'account.logout': 'Выйти',
  'account.languageTitle': 'Язык',
  'account.languageHint': 'Действует в этой сессии. Сохранение языка появится позже.',
  'account.loading': 'Проверка сессии',

  'common.noPhoto': 'Нет фото товара',
  'a11y.selectCategory': 'Показать: {category}',
  'a11y.clearCategory': 'Показать все категории',
  'a11y.selectLanguage': 'Использовать {language}',
};
