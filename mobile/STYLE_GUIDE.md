## Pragmatics for this demo

- Use the system font — no custom font installs.
- Dark mode only.
- No custom components built yet — the guide below is a reference for when we do build.

---

# Gametime Style Guide (first pass)

A working reference for the Gametime look and feel, put together from screenshots of gametime.co (homepage, value-prop/testimonial section, gift card page). **Every hex value is an estimate (~) taken from compressed screenshots.** Check them against official brand assets before using them anywhere it matters.

---

## 1. Brand at a glance

- **Dark first.** Every surface is near-black, and photography and the green accent supply the color.
- **One signature accent:** a bright, saturated "Gametime green" used for prices, primary CTAs, selected states, links and the logo chevron.
- **Logo:** condensed, bold, all-caps `GAMETIME` wordmark with a green forward chevron (`>`) at the end. The wordmark is always white on dark (or dark on green), and the chevron is always green.
- **Content is the color.** Event photos fill the visual space, and UI chrome stays muted and neutral.

---

## 2. Color

### 2.1 Core palette

| Token | Hex (~) | Usage |
|---|---|---|
| `green-500` (brand) | `#2BD17E` | Primary buttons, selected chips, logo chevron, selected card border |
| `green-400` (text) | `#4AE3A0` | "From $X" price text, inline links ("Baltimore", "Corporate Gift Cards"), active nav item |
| `green-700` (pressed) | `#1FA864` | Pressed/hover state for green buttons |
| `bg-base` | `#0E0F11` | Default page background (homepage) |
| `bg-deep` | `#05070F` | Deep navy-black background (gift card page, app promo panel) |
| `surface-1` | `#1A1B1E` | Top nav bar, cards, team chips |
| `surface-2` | `#25262A` | Form inputs, secondary/"Custom" buttons |
| `surface-3` | `#6E6E73` | Unselected segmented chips ($50, $100, SMS) |
| `border-subtle` | `#2C2D31` | Card outlines, section dividers |
| `border-strong` | `#8A8A8F` | Outlined input (phone number), dropdown outline |

### 2.2 Text

| Token | Hex (~) | Usage |
|---|---|---|
| `text-primary` | `#FFFFFF` | Headlines, card titles, nav links, button labels on dark |
| `text-secondary` | `#C9CACD` | Body copy, date/time/venue meta lines |
| `text-tertiary` | `#8E8F94` | Placeholders, section subheads ("More saving, more fun.") |
| `text-on-green` | `#0B1A12` | Labels on green buttons ("Add to Cart", "$25", "Email") |

### 2.3 Accents and status

| Token | Hex (~) | Usage |
|---|---|---|
| `star-yellow` | `#FFC93C` | 5-star rating rows in testimonials |
| `heart-overlay` | `rgba(0,0,0,0.45)` + white icon | Favorite button on event imagery |
| Team icon fills | sport-specific (`#D93A1E` orange-red, `#D21F4B` crimson, `#C9B98A` gold) | Circular team avatars in chips; these come from team branding, not the brand palette |

### 2.4 Gradients

- **Hero:** teal to green across the top edge, fading to `bg-base` by about 40% of the height.
  `linear-gradient(180deg, #1A9AA6 0%, #1E8C6E 25%, #0E0F11 70%)` (~), plus a soft radial glow and a slight noise/grain texture.
- **Value-prop cards:** dark surface with a single colored radial glow from the bottom of each card:
  - Purple/indigo `#3C3F94` (No Hidden Fees)
  - Green `#2E9E5E` (Lowest Price Guarantee)
  - Teal/cyan `#2A86A0` (Zone Deals)
- **Testimonial cards:** a subtle vertical fade from `#1A1B1E` to `#070A18` (navy).
- Gradients stay subtle and atmospheric. Do not put gradients behind body text or on buttons.

---

## 3. Typography

**Families (approximate):** UI text is a neo-grotesque sans that looks like **Inter** (or SF Pro on iOS). The logo and gift card artwork use a **condensed bold display face** (similar to Barlow Condensed or Bebas). Keep that face for brand and marketing art only and never use it for UI text.

| Role | Size (web ~) | Mobile (suggested) | Weight | Notes |
|---|---|---|---|---|
| Display / hero | 56–64px | 34pt | 800 | Tight tracking (about -2%), ends with a period |
| H1 section | 40px | 28pt | 800 | "See what fans like you are saying." |
| H2 section | 26px | 22pt | 600–700 | "Popular Events near Baltimore", "Recently Viewed" |
| H3 card title | 18–22px | 17pt | 700 | Event names, value-prop titles |
| Body | 16px | 15–16pt | 400 | Testimonials, descriptions |
| Meta | 14px | 13pt | 400–500 | `Sun 10/25 · 1:00 PM · M&T Bank Stadium` |
| Price | 14px | 13–14pt | 500 | `From $137` in `green-400` |
| Label | 13–14px | 13pt | 600 | Form section labels, chip labels |
| Micro | 11px | 11pt | 400 | Floating input label ("Send date") |

Rules:
- Use **middle dots (`·`)** to separate meta fields: `Sat 12/5 · 7:00 PM · Venue`.
- Truncate long venue names with an ellipsis on a single line. Do not wrap them.
- Headlines are white and heavy. Subheads underneath are lighter (`text-secondary` or `text-tertiary`) and regular weight.

---

## 4. Components

### 4.1 Nav bar
- Solid `surface-1` bar about 64px tall. Logo on the left, category links next to it (Sports, Music, Comedy, Theater, Cities, Venues), "Log In" on the right.
- Links are white, 15–16px, semibold. A seasonal or promoted link ("MLB Playoffs") is shown in `green-400`.
- Mobile: swap the inline links for a bottom tab bar or a horizontally scrolling category row.

### 4.2 Search field
- White field (`#FFFFFF`) with a dark placeholder, radius about 6px, a leading magnifier icon, and a height around 56px.
- This is the one light-on-dark input, and it sits on the hero gradient.

### 4.3 Event card
- **Image:** 16:9 (~), radius about 6–8px on the image only. The card itself has no background or border.
- **Favorite button:** 32px circle at the top right of the image, translucent dark fill, white outline heart.
- **Text stack** below the image, about 8px gap: title (H3, white, bold), then meta line (`text-secondary`), then `From $X` (`green-400`).
- Cards sit in a horizontal carousel, 4 across on desktop, with a gap of about 24px.

### 4.4 Carousel controls
- Paired circular arrow buttons (about 40px) aligned to the right of the section header.
- Fill `surface-2`, white chevron. The disabled (start) arrow drops to about 40% opacity.
- Mobile: hide the arrows and rely on swipe with snap scrolling, showing a peek of the next card.

### 4.5 Team chip
- Full pill (radius 9999), `surface-1` fill, height about 72px.
- A 48px circular icon on the left in the team color with a white sport glyph, followed by the team name in white semibold.

### 4.6 Buttons

| Variant | Fill | Text | Radius | Example |
|---|---|---|---|---|
| Primary | `green-500` | `text-on-green`, 600 | 4–6px | "Add to Cart" (about 56px tall) |
| Segment, selected | `green-500` | `text-on-green`, 600 | 4–6px | "$25", "Email" |
| Segment, unselected | `surface-3` | white, 600 | 4–6px | "$50", "SMS" |
| Secondary / Custom | `surface-2` | white, 600 | 4–6px | "Custom" |
| Icon button | `surface-2` | white icon | 6px | Cart button |
| Text link | none | `green-400`, 600 | none | "Corporate Gift Cards" |
| Store badges | black, white outline | white | 6px | App Store / Google Play |

### 4.7 Segmented selectors
- A row of compact rectangular chips (about 40px tall, 8px gap). Exactly one is selected, and the selected chip turns green.
- Used for gift card value and delivery method. "Custom" opens a free-entry field.

### 4.8 Form inputs (dark)
- **Filled style (default):** `surface-2` fill, no border, radius about 6px, height about 56px, 16px horizontal padding, placeholder in `text-tertiary`.
- **Floating label:** when a field has a value, a micro label sits above the value inside the field ("Send date" / `10/09/2026`).
- **Outlined style:** a 1px `border-strong` outline on a transparent fill with a trailing green arrow submit icon (phone number capture).
- **Textarea:** same as the filled style, about 120px tall.
- Section labels ("To", "From", "Gift card value") are 600-weight white text above the group.

### 4.9 Selectable tiles
- Grid of design thumbnails (3 columns, about 16px gap, radius about 6px).
- The selected tile gets a 2px `green-500` border. Unselected tiles have a `border-subtle` border.

### 4.10 Content cards (value props and testimonials)
- Radius about 12px, padding about 24–32px, 1px `border-subtle` border on dark gradient surfaces.
- Contents from top to bottom: emoji or icon (value props) or a star row (testimonials), then an H3 title, then body text.
- Inline links inside these cards are white with underline or emphasis.

### 4.11 Dropdown
- Outlined, radius about 6px, all-caps 13px label ("GENERAL") with a trailing chevron.

---

## 5. Layout and spacing

- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Card internals use 8–16, grid gaps 16–24, and space between sections 48–64.
- **Content width:** a centered column of about 1200px on desktop.
- **Section rhythm:** H2 header and carousel controls in one row, about 24px gap, then the content row. Each section repeats this pattern.

| Element | Radius (~) |
|---|---|
| Buttons, segments, inputs, image thumbs | 4–8px |
| Content cards (value props, testimonials, promo panel) | 12px |
| Large preview card (gift card preview) | 16px |
| Team chips, favorite button, carousel arrows | full (pill/circle) |

- **Elevation:** almost none. Depth comes from surface tone steps and gradients, not drop shadows.

---

## 6. Voice and tone

- **Confident, warm, fan-first.** Copy is short and declarative and ends with a period, even on headlines:
  - "Find your next great experience."
  - "More saving, more fun."
  - "See what fans like you are saying."
- **Proof in numbers:** "500K+ happy fans. Millions of tickets sold. Only one Gametime."
- **Plain-language value:** "No Hidden Fees", "Lowest Price Guarantee", "Zone Deals". Feature names use Title Case. Benefits are explained in one or two plain sentences.
- **Casing:**
  - Hero and marketing headlines use sentence case with a period.
  - Section headers, feature and card titles, and nav items use Title Case ("Popular Events near Baltimore", "Recently Viewed").
  - Form labels use sentence case ("Gift card value", "Delivery method").
  - Buttons use Title Case ("Add to Cart", "Log In").
- Gift card and marketing art leans playful ("Ho Ho Ho! Go Go Go!", "Season's Seatings"). Puns are fine in campaign art and should stay out of the UI.
- Prices are always written as "From $X", with no cents on browse surfaces.

---

## 7. Mobile implications

- **Dark mode by default.** Set the app background to `bg-base` and the status bar to light content. Do not ship a light theme in the first pass.
- **Tokens first.** Encode the palette in section 2 as a single theme module (colors, spacing, radii, type scale), and have components reference tokens only.
- **Typography:** use the system font (SF Pro / Roboto) or bundle Inter. Only use the condensed display face for the logo asset. Support Dynamic Type / font scaling for body and meta text.
- **Touch targets:** at least 44pt. The favorite heart needs a hit area larger than its 32px visual size, and segment chips should be at least 44pt tall on mobile.
- **Carousels:** horizontal `FlatList`/`ScrollView` with snap-to-interval, about 80% card width so the next card peeks into view, and no arrow buttons.
- **Event card:** keep the image, title, meta and green price stack. Truncate the meta line to one line.
- **Primary CTA:** a full-width green button pinned to the bottom safe area on checkout-style screens (e.g. "Add to Cart", "Continue").
- **Forms:** filled dark inputs with floating labels, the right keyboard types (email, phone, number), and a green focus ring or border on the active field.
- **Contrast:** `green-400` on `bg-base` passes AA for normal text. Keep `text-on-green` dark, because white on `green-500` fails AA at small sizes.
- **Haptics:** use a light impact on favorite toggle and segment selection.
