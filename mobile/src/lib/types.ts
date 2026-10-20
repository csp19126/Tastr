// The shapes the Tastr server sends back (see api/src/serialize.ts and the routes).
import type { Category, CityId, Currency, OpeningHours, ReportReason, ReportTarget, SubRating, Tag } from '@shared';

export type PublicUser = { id: number; displayName: string; photoUrl: string | null; homeCity?: string };

export type Me = {
  id: number;
  email: string | null;
  displayName: string;
  photoUrl: string | null;
  homeCity: CityId;
  bio: string;
  language: 'en' | 'vi';
  currency: Currency;
  notifications: { follows: boolean; comments: boolean; helpful: boolean };
  role: 'user' | 'admin';
  banned: boolean;
  signInMethods: ('email' | 'google' | 'apple')[];
  createdAt: string;
};

export type Photo = { id: number; url: string; width: number; height: number };

export type PlaceCard = {
  id: number;
  name: string;
  category: Category;
  lat: number;
  lng: number;
  address: string;
  neighbourhood: string;
  city: CityId;
  coverUrl: string | null;
  paws: number | null;
  reviewCount: number;
  priceBracket: number | null;
  tags: Tag[];
  openNow: boolean | null;
  distanceKm: number | null;
};

export type PlaceDetail = PlaceCard & {
  hidden: boolean;
  timezone: string;
  openingHours: OpeningHours | null;
  phone: string;
  zalo: string;
  ratings: Record<SubRating, number | null>;
  tagCounts: { tag: Tag; count: number }[];
  popularDishes: { name: string; mentions: number; thumbsUp: number; photoUrl: string | null }[];
  photos: Photo[];
  savedInLists: number[];
  claimed: boolean;
  createdBy: number | null;
  createdAt: string;
};

export type Dish = { id: number; name: string; thumbsUp: boolean; note: string; photo: Photo | null };

export type Review = {
  id: number;
  place: { id: number; name: string; category: Category; city: CityId };
  author: PublicUser;
  paws: number;
  ratings: Record<SubRating, number | null>;
  body: string;
  pricePaid: number | null;
  currency: Currency;
  priceBracket: number | null;
  tags: Tag[];
  sponsored: boolean;
  visitedOn: string | null;
  photos: Photo[];
  dishes: Dish[];
  helpfulCount: number;
  votedHelpful: boolean;
  commentCount: number;
  reply: { businessName: string; body: string; createdAt: string } | null;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Comment = { id: number; reviewId: number; body: string; author: PublicUser; createdAt: string };

export type UserProfile = PublicUser & {
  bio: string;
  reviewCount: number;
  followerCount: number;
  followingCount: number;
  helpfulCount: number;
  isFollowing: boolean;
  banned: boolean;
  joinedAt: string;
};

export type List = {
  id: number;
  kind: 'want_to_try' | 'date_night' | 'custom';
  name: string;
  isShared: boolean;
  shareUrl: string | null;
  placeCount: number;
  coverUrl: string | null;
  createdAt: string;
};

export type ListPlace = Pick<
  PlaceCard,
  'id' | 'name' | 'category' | 'city' | 'neighbourhood' | 'lat' | 'lng' | 'paws' | 'reviewCount' | 'priceBracket' | 'coverUrl' | 'openNow'
> & { note: string; addedAt: string };

export type ListDetail = List & { places: ListPlace[]; owner?: { id: number; displayName: string } };

export type ContentEntry = { title: string; body: string; language: string; updatedAt: string };

export type ReportItem = {
  targetType: ReportTarget;
  targetId: number;
  reportCount: number;
  reasons: ReportReason[];
  details: string[];
  firstReportedAt: string;
  target: {
    text?: string;
    url?: string;
    hidden: boolean;
    authorId?: number;
    authorName?: string;
    placeId?: number;
    placeName?: string;
    reviewId?: number;
  } | null;
};

export type AdminUser = {
  id: number;
  displayName: string;
  email: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  reviewCount: number;
  reportCount: number;
  createdAt: string;
};
