// Everything the app and the API must agree on lives here, so the two can never drift apart.

/** The app's name. Change it here (and in mobile/app.config.ts for the store listing). */
export const APP_NAME = 'Tastr';

export const CATEGORIES = [
  'restaurant',
  'street_food',
  'cafe',
  'bar',
  'rooftop',
  'bakery',
  'dessert',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const TAGS = [
  'dog_friendly',
  'vegetarian',
  'halal',
  'aircon',
  'outdoor_seating',
  'good_for_groups',
  'late_night',
  'card_accepted',
  'english_menu',
  'rooftop',
  'live_music',
  'happy_hour',
] as const;
export type Tag = (typeof TAGS)[number];

export const SUB_RATINGS = ['taste', 'value', 'service', 'vibe', 'cleanliness'] as const;
export type SubRating = (typeof SUB_RATINGS)[number];

/** Price per person brackets. Bands are in VND; other currencies show the bracket symbol only. */
export const PRICE_BRACKETS = [1, 2, 3, 4] as const;
export type PriceBracket = (typeof PRICE_BRACKETS)[number];
export const PRICE_BRACKET_VND: Record<PriceBracket, string> = {
  1: '< 50k',
  2: '50k – 150k',
  3: '150k – 400k',
  4: '400k +',
};

export const CURRENCIES = ['VND', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'THB', 'KRW', 'JPY'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'VND';

export const LANGUAGES = ['en', 'vi'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Launch cities first; anything else is stored as "other" plus free text on the place. */
export const CITIES = [
  { id: 'da_nang', name: 'Da Nang', nameVi: 'Đà Nẵng', lat: 16.0544, lng: 108.2022 },
  { id: 'hoi_an', name: 'Hoi An', nameVi: 'Hội An', lat: 15.8801, lng: 108.338 },
  { id: 'hue', name: 'Hue', nameVi: 'Huế', lat: 16.4637, lng: 107.5909 },
  { id: 'ho_chi_minh', name: 'Ho Chi Minh City', nameVi: 'TP. Hồ Chí Minh', lat: 10.7769, lng: 106.7009 },
  { id: 'ha_noi', name: 'Hanoi', nameVi: 'Hà Nội', lat: 21.0278, lng: 105.8342 },
  { id: 'nha_trang', name: 'Nha Trang', nameVi: 'Nha Trang', lat: 12.2388, lng: 109.1967 },
  { id: 'da_lat', name: 'Da Lat', nameVi: 'Đà Lạt', lat: 11.9404, lng: 108.4583 },
  { id: 'other', name: 'Somewhere else', nameVi: 'Nơi khác', lat: 16.0544, lng: 108.2022 },
] as const;
export type CityId = (typeof CITIES)[number]['id'];
export const CITY_IDS = CITIES.map((c) => c.id) as unknown as readonly [CityId, ...CityId[]];

export const REPORT_TARGETS = ['review', 'photo', 'comment', 'place', 'user'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export const REPORT_REASONS = ['spam', 'fake', 'offensive', 'wrong_info', 'undisclosed_sponsor', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const LIMITS = {
  photosPerReview: 10,
  dishesPerReview: 15,
  reviewBodyMax: 5000,
  reviewBodyMin: 20,
  commentMax: 1000,
  bioMax: 300,
  /** One account can't flood the app. */
  reviewsPerDay: 10,
  /** Same person, same place: one review a week (edit the old one instead). */
  daysBetweenReviewsOfSamePlace: 7,
  placesPerDay: 15,
  commentsPerHour: 30,
  reportsPerDay: 30,
  photoMaxBytes: 15 * 1024 * 1024,
  photoMaxEdge: 2048,
} as const;

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
/** Each day is a list of [open, close] in 24h "HH:MM". close < open means it runs past midnight. */
export type OpeningHours = Partial<Record<Weekday, [string, string][]>>;
