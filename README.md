# Tastr 🍜

Honest food, drink and nightlife reviews, starting in Da Nang and Hoi An.
People snap what they ate, rate the place out of **5 stars**, and tell it straight. Everyone else finds somewhere great to eat tonight.

English and Tiếng Việt from day one. iPhone, Android and (for testing) web, from one codebase.

> The name lives in one place: `APP_NAME` in `shared/constants.ts` (on screen) and `NAME` in `mobile/app.config.ts` (under the icon and in the stores). Change both together.

---

## What's in this repository

| Folder | What it is |
|---|---|
| `mobile/` | The phone app (Expo / React Native). Screens are in `mobile/src/app/`, every word the app says is in `mobile/src/locales/en.ts` and `vi.ts`. |
| `api/` | The server: accounts, places, reviews, photos, search, lists, moderation. Node + Express + PostgreSQL. |
| `shared/` | Rules both sides must agree on: categories, tags, limits, the accent-free search, opening-hours maths. |
| `art/` | The logo (a steaming bowl with chopsticks). `node art/build.mjs` redraws the icon, splash screen and in-app logo. |

## What works today

**Accounts.** Sign up with email. Google and Apple sign-in are built and checked by the server, and switch on once you've created the Google/Apple credentials (see "What I need from you"). Profile: name, photo, home city, bio, language, currency.

**Reviews.** Up to 10 photos (camera or gallery), shrunk on the phone before upload. GPS and camera details are stripped twice: once on the phone, and again on the server, which re-encodes every photo (there's an automated test proving the location data is gone). Overall stars 1–5 ("Don't bother" → "Drop everything"), quick ratings for Taste, Value, Service, Vibe and Cleanliness, each with its own question ("Would you queue for this?", "Worth the price?", "Would you bring your mum here?"). Price paid in VND (or your currency) and a price-per-person band. The 11 quick tags. Dish notes with their own photo and a thumbs up or down. **Drafts save themselves on the phone as you type.** If the signal drops when you hit Post, nothing is lost: the review waits in the Review tab, and photos that already went up aren't sent twice.

**Sponsored reviews.** Every review must answer "Did the business pay you or give you anything free?". There's no default, so you can't skip it. A "yes" puts a purple **Sponsored / got it free** label on the review.

**Places.** Anyone can add a place by dragging the map until the pin sits on the stall: no website or address needed. Opening hours, phone and Zalo are optional ("better blank than wrong"). If someone adds a place that's already there, the app asks "Is it this one?". Place pages show photos, average stars and sub-ratings, price band, tags, opening hours with "open now", **popular dishes** (built from everyone's dish notes), directions, call, Zalo and the reviews.

**Discover.** List and map of places near you, closest first. Filters: category, price, open now, star rating, tags, distance. Search by place name, dish ("bún chả", "pizza") or neighbourhood, **with or without Vietnamese accents**: "banh mi" finds "Bánh Mì", "com ga" finds "Cơm Gà".

**Lists.** Everyone starts with "Want to try" and "Date night"; make as many of your own as you like. Switch a list to shared and send the link: it opens a simple web page for friends without the app.

**Social.** Follow reviewers, a feed of people you follow plus a feed for your city, "helpful" votes (one each, never on your own), comments.

**Trust and safety.** Report any review, photo, comment, place or person. The Admin screen (in Settings, for emails listed in `ADMIN_EMAILS`) shows reports grouped by item: hide it, hide it and ban the author, or dismiss. Banned people are signed out everywhere and their reviews stop counting straight away. Limits per account: 10 reviews a day, one review per place per week, 15 new places a day, 30 comments an hour, plus a cap on sign-in attempts.

**Businesses (data model ready, switched on later).** Tables exist for businesses, staff, claiming a place page (approved by an admin), one public reply per review, and an audit log of every change to a place's facts. By design, **there is no rating stored on a place at all**: every average is worked out from visible reviews each time, so there is nothing a business could pay to change, and nothing anywhere that lets a business edit or delete a review.

**Settings and legal.** Language switch, currency, notification preferences, **delete my account and all my data** (account, reviews, photos and their files, comments, lists, follows; the places you added stay on the map anonymously, and reports you filed stay for the moderators without your name). About screen with **"Who runs this app"** and **"Partnerships and affiliations"**, plus Terms of Use and Privacy Policy. All of that text lives on the server: change it in **Admin → App content**, in both languages, and it shows in the app immediately, no new release.

## Try it on your phone (about 15 minutes)

You need a computer with [Node.js 22](https://nodejs.org) and [PostgreSQL](https://www.postgresql.org/download/), and the free **Expo Go** app on your phone (App Store / Play Store). Phone and computer on the same Wi-Fi.

```bash
# 1. The server
cd api
npm install
cp .env.example .env          # then put your email in ADMIN_EMAILS
npm run seed                  # adds 10 made-up sample places in Da Nang and Hoi An
npm run dev                   # leave this running

# 2. The app (second terminal)
cd mobile
npm install
npx expo start                # scan the QR code with your phone camera (iPhone) or Expo Go (Android)
```

The app finds the server on your computer by itself. Sample log-in: `sample.diner@example.com` / `sample-password`, or create your own account (sign up with the email you put in `ADMIN_EMAILS` to get the Admin screen).

In Expo Go everything works except Google sign-in, which needs a proper build (below).

## Put the server live (Railway, like Dragongame)

1. In Railway, **New Project → Deploy from GitHub repo** and pick this repository. `railway.json` tells it to build `api/Dockerfile`.
2. **Add a PostgreSQL database** to the project, then in the Tastr service's **Variables** add a reference to its `DATABASE_URL`.
3. Add a **Volume** to the Tastr service, mounted at `/data` (that's where photos are kept, so they survive redeploys).
4. **Settings → Networking → Generate Domain.** Then add these variables:
   - `PUBLIC_URL` = that address, e.g. `https://tastr-api.up.railway.app`
   - `ADMIN_EMAILS` = your email
5. Put the same address in `mobile/eas.json` (the three `EXPO_PUBLIC_API_URL` lines) for phone builds.

The database sets itself up on first start and upgrades itself on every deploy. `/health` tells you whether the server and database are up.

## Make the real apps (App Store and Google Play)

Builds are made in the cloud by Expo's EAS service, no Mac needed:

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android   # an installable test app for Android
npx eas-cli@latest build --profile production --platform all    # store builds
npx eas-cli@latest submit --platform ios                        # send to App Store Connect
```

## What I need from you before launch

These are things only you can do (accounts, money, legal), or decisions that are yours:

1. **Bundle ID**: a unique app ID like `com.yourcompany.tastr`. Set `APP_BUNDLE_ID` (or edit `mobile/app.config.ts`). It can't change after the first store upload.
2. **Apple Developer account** (US$99/year) and **Google Play Console** (US$25 once).
3. **Google sign-in**: create OAuth client IDs in Google Cloud (Web, iOS, Android). Put them in `GOOGLE_CLIENT_IDS` on the server, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `GOOGLE_IOS_URL_SCHEME` for the app build.
4. **Apple sign-in**: put your bundle ID in `APPLE_BUNDLE_IDS` on the server. (To test it in Expo Go, add `host.exp.Exponent` too.)
5. **Google Maps key for Android store builds** (`GOOGLE_MAPS_ANDROID_API_KEY`). iPhones use Apple Maps and need nothing; Expo Go needs nothing.
6. **Terms of Use, Privacy Policy, "Who runs this app", "Partnerships"**: replace the `[PLACEHOLDER]` text in Admin → App content. Have a lawyer write or check the legal pages.
7. **A native Vietnamese speaker to read `mobile/src/locales/vi.ts`.** I wrote it to sound like a friend, not a brochure, but it deserves a local's ear before launch.

## Not built yet (deliberately left for the next round)

Being straight about the gaps:

- **Password reset and email verification** need an email-sending service (e.g. Resend or Postmark). Until then, someone who forgets their password can't get back in by themselves.
- **Push notifications.** The notification settings are saved, but nothing sends notifications yet.
- **The business side** has its database tables but no screens or endpoints yet (claim a page, reply to reviews, update hours).
- **Photo storage** is a disk volume on the server. Fine for launch; at real scale, move photos to cloud storage (S3 / Cloudflare R2) behind a CDN.
- **The web version** exists for testing and share links. Its map is a simple OpenStreetMap view; the real map is in the phone apps.

## How it's checked

| Command | What it does |
|---|---|
| `cd api && npm test` | 38 automated tests against a real PostgreSQL: sign-up, Google/Apple linking, photos losing their GPS data, reviews, limits, Vietnamese search, filters, lists and share links, feed, reports, bans, editable content, delete-my-account |
| `cd api && npm run check` | Typecheck the server |
| `cd mobile && npx tsc --noEmit` | Typecheck the app |
| `cd mobile && npx expo lint` | Code-quality rules |
| `cd mobile && npx expo-doctor` | Expo's own health check of the project |

Every push to GitHub runs all of that, plus a build of the Android, iPhone and web bundles (`.github/workflows/ci.yml`).
