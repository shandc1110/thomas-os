# Chosen by Chloe Storefront Shell V1

**Status:** LOCKED — MASTER VISUAL REFERENCE  
**Sprint:** 03C (Storefront Shell Lock & Specification)  
**Reference implementation:** Thomas OS storefront (`web/`)  
**Brand system:** V4 (`docs/rebrand/CHOSEN_BY_CHLOE_BRAND_SYSTEM_V4.md`)

> **CHOSEN BY CHLOE SHOULD FEEL LIKE AN EDIT, NOT A TEMPLATE.**
>
> The storefront represents a mother’s point of view, a considered selection,
> real experience, careful choice, and trust.
>
> Do not redesign this shell in future implementation sprints.
> Future work adapts data and commerce integrations **to** this shell.

---

## Brand

| Item | Locked value |
|------|----------------|
| Display name | `CHOSEN by Chloe` |
| Primary mark | V4 horizontal wordmark (raster asset — never HTML/CSS recreation) |
| Secondary mark | CC (favicon, avatar, footer detail, packaging — never primary) |
| Hero statement | `CHOSEN WITH A MOTHER'S HEART` / `FOR LITTLE LIVES` |
| Hero support | `Things we've tried, loved and chosen — for our little ones, and yours.` |
| Edit title | `THE CHLOE EDIT` |
| Edit support | `Things we've tried, loved and chosen.` |
| Announcement bar | `CHOSEN WITH A MOTHER'S HEART · FOR LITTLE LIVES` |
| Philosophy (not hero) | `We don't stock everything. We choose what deserves a place.` |

**Approved brand copy — do not invent alternatives.**

Code source of truth: `web/lib/brand/chosen-by-chloe.ts`

---

## Logo System

### Primary brand mark — CHOSEN by Chloe

| Field | Value |
|-------|--------|
| Filename | `logo-primary-horizontal.png` |
| Public path | `/brand/chosen-by-chloe/v4/logo-primary-horizontal.png` |
| Repo path | `web/public/brand/chosen-by-chloe/v4/logo-primary-horizontal.png` |
| Code constant | `cbcV4Assets.logoPrimaryHorizontal` |
| Intrinsic size | **4072 × 776 px** |
| Aspect ratio | **≈ 5.25 : 1** (width ÷ height) |
| Intended use | Primary storefront identity — header, hero, footer, Open Graph |

**Usage**

| Context | Behaviour (as implemented) |
|---------|----------------------------|
| **Header** | Compact: `h-9` / `max-w-[150px]` (sm: `h-10` / `190px`). Default: `h-10` / `170px` (sm: `h-12` / `230px`). Object-contain, left. |
| **Hero** | Oversized, intentional. Width: `min(92vw, 640px)` → sm `700px` → md `760px` → lg `min(68vw, 820px)`. Full width of wrapper, `object-left`. **Dominant identity of the Hero.** |
| **Footer** | `h-10` / `max-w-[220px]`, left-aligned. |
| **Mobile** | Same assets; header logo scales down via max-width; hero uses viewport-relative width. |
| **Desktop** | Header up to ~230px wide; hero up to 820px wide. |

**Rules**

- Render via `<img>` / `BrandLogo` only — **never** recreate with HTML text or CSS.
- Do not alter the asset file or proportions.
- Minimum recommended display height (header): **36px** (`h-9`); do not shrink below readability.
- Related primary variants (not hero/header default): `logo-primary-stacked.png`, `logo-horizontal-alternative.png`, monochrome black/white — see V4 package README.

---

## Secondary Mark

### CC

| Asset | Path | Size |
|-------|------|------|
| Signature | `/brand/chosen-by-chloe/v4/cc-signature.png` | 1504 × 616 |
| Monogram | `/brand/chosen-by-chloe/v4/cc-monogram.png` | 668 × 548 |
| Favicon | `/brand/chosen-by-chloe/v4/favicon-cc.png` | 512 × 512 |
| Avatars | `avatar-ivory.png`, `avatar-sage.png`, `avatar-charcoal.png` | 1024 × 1024 |

**Approved uses**

- Favicon
- Avatar / Apple touch icon
- Footer small brand detail (current: signature at `h-6`, opacity 70%)
- Packaging-related usage
- Small brand detail elsewhere when not competing with the wordmark

**Prohibited uses**

- Replacing the primary logo
- Hero logo
- Main navigation logo
- Combining CC with CHOSEN by Chloe as a new lockup

CC is **not** the primary storefront identity.

---

## Colour System

Verified from `web/app/globals.css` `@theme` and `cbcV4Colors`:

### Core V4 palette (locked)

| Name | Token / CSS | Hex (as in code) |
|------|-------------|------------------|
| Warm Ivory | `--color-ivory` / `bg-ivory` | `#F8F1E5` (`#f8f1e5` in CSS) |
| Charcoal | `--color-charcoal` | `#242321` |
| Sage | `--color-sage` | `#A8B19F` (`#a8b19f` in CSS) |
| White | `--color-white` / `--color-linen` | `#FFFFFF` |

### Supporting (implemented, derived — do not expand freely)

| Name | Token | Hex | Role |
|------|-------|-----|------|
| Sand | `--color-sand` | `#E8DFD2` (`#e8dfd2`) | Soft borders |
| Muted | `--color-muted` | `#6B6A66` (`#6b6a66`) | Secondary body text |

Legacy aliases map to V4 (`cream`→ivory, `clay`→sage, `cocoa`/`espresso`/`ink`→charcoal).

**Do not introduce new brand colours.**

---

## Typography

Verified from `web/app/layout.tsx` + `web/app/globals.css`:

| Role | Family | CSS variable |
|------|--------|--------------|
| **Primary (UI / body)** | Montserrat (400, 500, 600, 700) | `--font-montserrat` → `--font-sans` |
| **Secondary (editorial accents)** | Playfair Display (500, 600, 700) | `--font-playfair` → `--font-serif` |

Body default: Montserrat via `font-family: var(--font-sans), …`.

| Surface | Spec (implemented) |
|---------|-------------------|
| **Announcement bar** | 11px, medium, uppercase, tracking `0.22em`, ivory on charcoal |
| **Nav (desktop)** | 11px, semibold, uppercase, tracking `0.16em`, muted → charcoal hover |
| **Nav (mobile stacked)** | 14px (`text-sm`), semibold, uppercase, tracking `0.18em` |
| **Hero statement L1** | ~15–16px, medium, tracking `0.04em`, charcoal |
| **Hero statement L2** | 14–15px, tracking `0.06em`, sage |
| **Hero / Edit body** | 14px (`text-sm`), leading-relaxed, muted |
| **Buttons / CTAs** | 11px, semibold, uppercase, tracking `0.14em`–`0.16em` |
| **THE CHLOE EDIT title** | ~17–18px, medium, tracking `0.08em`, charcoal (not oversized fashion serif) |
| **Why we choose quote** | Playfair, `text-xl` / `sm:text-2xl`, leading-snug |
| **Product name (future card)** | Playfair, `text-base`, leading-snug |

**Do not introduce new fonts. Do not redesign typography.**

---

## Announcement Bar

| Property | Locked implementation |
|----------|----------------------|
| Copy | `CHOSEN WITH A MOTHER'S HEART · FOR LITTLE LIVES` |
| Source | `cbcV4Brand.bannerText` → `tenant.storefront.bannerText` |
| Background | Charcoal `#242321` |
| Text | Ivory `#F8F1E5` |
| Typography | 11px, font-medium, uppercase |
| Letter spacing | `0.22em` |
| Padding / height | `py-2` + `px-4` (content-driven; ~36px total typical) |
| Alignment | Centre |
| Border | `border-b border-sand/70` |
| Desktop / mobile | Same centred bar; wraps naturally on narrow screens |

**Explicitly not in the announcement bar:** `Chinese × British` (or similar cultural pairing). That belongs only in story content if used at all — not chrome.

---

## Header

**Component:** `ShopHeader` + `ShopNav`  
**File:** `web/components/shop/ShopHeader.tsx`, `ShopNav.tsx`

### Structure (locked)

```
[ Menu (≤lg) ]  [ Primary logo ]  [ Shop · The Edit · Brands · Our Story ]     [ Account ] [ Basket ]
```

Nav labels from `cbcV4Brand.nav`: **Shop**, **The Edit**, **Brands**, **Our Story**.

| Property | Value |
|----------|--------|
| Background | `bg-ivory/90` + `backdrop-blur-sm` |
| Border | `border-b border-sand/80` |
| Max width | `max-w-6xl` (1152px) |
| Gutters | `px-4` |
| Vertical padding | `py-4` / `md:py-5` |
| Logo | Primary horizontal only (never CC) |
| Account | Text link, muted; in mobile drawer below nav |
| Basket | Charcoal fill, ivory text, uppercase tracking-wider; count badge when > 0 |
| Responsive | Nav hidden below `lg` (1024px); hamburger opens stacked menu |

**Do not redesign.**

---

## Hero

**Component:** `HomeHero`  
**File:** `web/components/shop/HomeSections.tsx`  
**Status:** APPROVED (Sprint 02C) — DO NOT REDESIGN

### Required structure

```
CHOSEN by Chloe          ← oversized V4 primary logo asset

CHOSEN WITH A MOTHER'S HEART
FOR LITTLE LIVES

Things we've tried, loved and chosen —
for our little ones, and yours.

[ SHOP THE EDIT ]  [ OUR STORY ]
```

| Property | Implementation |
|----------|----------------|
| Background | Warm Ivory (`bg-ivory`) |
| Max width | `max-w-6xl` |
| Gutters | `px-5` → sm `px-8` → lg `px-10` |
| Vertical padding | Top `pt-14`…`lg:pt-24`; bottom `pb-10`…`lg:pb-16` (eased for Edit transition) |
| Logo position | Left-weighted (not dead-centre) |
| Logo scale | Oversized — primary visual (see Logo System) |
| Statement block | Offset: `md:ml-[18%]` / `lg:ml-[22%]`, `max-w-sm`/`md` |
| Height | **Content-driven** — no fixed hero height |
| Photography | **None** — brand mark is the visual |
| Border below | **None** (shell V1: soft colour handoff into Edit) |

### Hero image policy

NO hero photography. Do not introduce stock, AI, product, or lifestyle photography in the Hero. The oversized brand mark **is** the Hero visual.

### Hero decoration policy

**Prohibit:** hearts, motion marks, stars, illustrations, decorative shapes, gradients on the hero surface, floating elements, unnecessary animations.

---

## CTA System

| CTA | Style | Target |
|-----|--------|--------|
| **Shop the Edit** | Primary: charcoal fill, ivory text, `min-h-10`, uppercase 11px tracking `0.14em` | `#chloe-edit` |
| **Our Story** | Secondary: transparent, sand border, charcoal text; hover sage border | `#our-story` |
| **Basket** (header) | Same primary language as Shop the Edit | `/checkout` |

Preserve scroll offset: Edit section uses `scroll-mt-24`.

---

## Hero → Edit Transition

**Component:** `ChloeEditTransition`  
**File:** `web/components/shop/ChloeEditTransition.tsx`

| Rule | Spec |
|------|------|
| Surfaces | Hero Warm Ivory → Edit White |
| Method | Solid colour change only |
| Dividers | No heavy rule between Hero and Edit |
| Gradients | Not used for this handoff |
| Rhythm | Controlled breathing space (hero bottom pad + edit top pad) — calm, not empty |
| Intent | One continuous page: brand → point of view → the edit |

---

## The Chloe Edit

**Component:** `ChloeEditSection`  
**File:** `web/components/shop/HomeSections.tsx`  
**Anchor:** `id="chloe-edit"`

| Property | Locked |
|----------|--------|
| Title | `THE CHLOE EDIT` |
| Support | `Things we've tried, loved and chosen.` |
| Background | White `#FFFFFF` |
| Alignment | Left-edge of content container (grounded shopping start — **not** a copy of hero offset statement) |
| Title type | Quiet, medium weight, tracking `0.08em` — not fashion-editorial oversized |
| Bottom border | Soft `border-sand/50` (into following sections) |
| Products (Shell V1) | **None** — framework only |

---

## Product Grid

**Component:** `ChloeEditGrid`  
**File:** `web/components/shop/ChloeEditGrid.tsx`

### Future layout (locked architecture)

| Viewport | Columns |
|----------|---------|
| Mobile | 2 (`grid-cols-2`) |
| Tablet (`md`+) | 2 |
| Desktop (`lg`+) | 4 |

Gaps: `gap-x-4 gap-y-10` → md `gap-x-6 gap-y-12`.

### Empty behaviour

- Renders **nothing** when `products` is empty.
- **No** empty-state copy (“Coming soon”, “No products”, etc.).
- Shell V1 homepage passes `products={[]}`.

### Future card fields (when populated from catalogue)

- Image (`image_url`)
- Brand
- Name
- Price (+ currency)
- Availability (e.g. sold out)
- Link

Image aspect: `4/5`. Subtle hover scale only when products exist — no decorative animation system.

---

## Responsive System

Tailwind CSS v4 defaults (no custom breakpoint overrides in repo):

| Token | Min width |
|-------|-----------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

### Layout constants

| Token | Value |
|-------|--------|
| Max content width | `max-w-6xl` = **72rem / 1152px** |
| Mobile gutters (hero/edit) | `px-5` (20px) |
| Tablet+ | `sm:px-8` (32px) |
| Desktop | `lg:px-10` (40px) |
| Header gutters | `px-4` (16px) |

### Behaviour summary

| Area | Mobile | Tablet | Desktop |
|------|--------|--------|---------|
| Header | Hamburger + logo + Basket | Same; Account from `sm` | Full nav from `lg` |
| Hero logo | ~92vw capped 640px | Scales to 700–760px | Up to 820px |
| Hero statement | Full width of max-w-sm | Offset `md:ml-[18%]` | Offset `lg:ml-[22%]` |
| CTAs | Wrap, gap-3 | Same | Same |
| Edit title | Left, quieter type | Same | Same |
| Product grid (future) | 2 col | 2 col | 4 col |

Do not invent extra breakpoints without need.

---

## Component Inventory

| Component | Path | Responsibility | Props / inputs | Reusable | Platform-specific? |
|-----------|------|----------------|----------------|----------|-------------------|
| `BrandLogo` | `web/components/shop/BrandLogo.tsx` | Renders V4 raster logos only | `variant`, `className`, `priority` | Yes | No |
| `ShopHeader` | `web/components/shop/ShopHeader.tsx` | Storefront chrome: logo, nav, account, basket | `compact?` | Yes | Cart hook is Thomas OS; layout is shell |
| `ShopNav` | `web/components/shop/ShopNav.tsx` | Primary nav links | `stacked?`, `onNavigate?`, `className?` | Yes | No |
| `ShopFooter` | `web/components/shop/ShopFooter.tsx` | Footer wordmark, links, CC signature | — | Yes | Contact email may be tenant-specific |
| `HomeHero` | `web/components/shop/HomeSections.tsx` | Locked hero composition | — | Yes (presentation) | No |
| `ChloeEditTransition` | `web/components/shop/ChloeEditTransition.tsx` | Ivory→white handoff wrapper | `children` | Yes | No |
| `ChloeEditSection` | `web/components/shop/HomeSections.tsx` | Edit title, support, hosts grid | `products?: Product[]` | Yes | No |
| `ChloeEditGrid` | `web/components/shop/ChloeEditGrid.tsx` | Responsive merchandising grid | `products?: Product[]` | Yes | Link helpers currently use Thomas brand slugs — adapt via data adapter later |
| Brand tokens | `web/lib/brand/chosen-by-chloe.ts` | Assets, colours, locked copy, nav | — | Yes | No |
| Home page | `web/app/page.tsx` | Composes shell | — | Reference | Thomas OS routing |
| Announcement bar | `web/app/layout.tsx` | Site-wide banner | tenant `bannerText` | Yes (pattern) | Tenant-driven copy |

Supporting shell sections (locked tone, not merchandising): `WhyWeChooseMinimal`, `OurStoryMinimal` in `HomeSections.tsx`.

---

## Data Contract

### Architectural principle

```
BRAND / UI
        ↓
STOREFRONT SHELL
        ↓
DATA ADAPTER
        ↓
COMMERCE PLATFORM
```

The storefront shell must **not** depend directly on platform-specific product APIs.

```
Thomas OS / Shopify / Joybuy products
        ↓
normalised product model
        ↓
Chosen by Chloe storefront components
```

### Entry points (Thomas OS reference)

- `ChloeEditSection({ products })`
- `ChloeEditGrid({ products })`

**Shell V1:** pass empty array. Do not hardcode products. Do not create a second catalogue.

### Normalised fields the Edit grid consumes today (`Product` in `web/lib/types.ts`)

| Field | Used by grid / card |
|-------|---------------------|
| `id` | React key |
| `name` | Title |
| `brand` | Brand label + brand-route hint |
| `price` | Price display |
| `currency` | Price formatting |
| `image_url` | Primary image |
| `stock` / presell fields | Availability via `getSellableStock` |

Additional catalogue fields exist on `Product` for commerce/ops; adapters may map a subset for storefront display.

### Minimum adapter output (platform-neutral)

Future adapters should supply at least:

| Field | Purpose |
|-------|---------|
| id / identifier | Stable key |
| title / name | Display name |
| brand | Brand string |
| price | Numeric price |
| currency | ISO-like currency code |
| image | Primary image URL |
| availability | In stock / sold out / etc. |
| url | PDP or destination link |
| sku (optional) | Identifier — **not shown as chrome in Shell V1** |

---

## Platform Adapter Principle

| Layer | Owns |
|-------|------|
| **Storefront Shell V1** | Brand, layout, type, colour, rhythm, components |
| **Data adapter** | Map platform payloads → normalised product model |
| **Commerce platform** | Catalogue, inventory, checkout, orders |

Visual rules must **not** assume Shopify, Joybuy, or Supabase. Those are backends.

**Visual source of truth:** this Thomas OS shell.  
Shopify / Joybuy must match this specification. If a platform cannot reproduce a feature exactly, preserve: brand hierarchy, layout hierarchy, typography, colour, spacing, interaction intent.

---

## Shopify Implementation Notes

**Do not implement in Shell V1.**

When implemented, Shopify must reproduce this shell and provide (via adapter):

- product / title  
- brand  
- price  
- image  
- availability  
- URL  
- SKU / identifier  

No separate visual system. No Shopify-theme drift from this shell.

---

## Joybuy Implementation Notes

**Do not implement storefront UI against Joybuy in Shell V1.**

Joybuy will eventually provide platform-specific product / order / inventory data.  
The customer-facing visual storefront must still implement **Chosen by Chloe Storefront Shell V1**.

---

## Forbidden Elements

Unless the brand system is intentionally revised and re-locked:

- Hearts, motion marks, stars  
- Decorative illustrations / shapes  
- Gradients as brand decoration (hero/Edit handoff must stay solid surfaces)  
- Generic stock / AI lifestyle photography in the Hero  
- Fake product imagery or fake catalogue data  
- Unnecessary badges, discount stickers  
- Generic marketplace styling  
- Luxury-fashion / magazine campaign styling  
- Excessive animations  
- `Chinese × British` (or similar) in the announcement bar  
- CC as primary logo / hero / main nav mark  
- “Coming next” / “Coming soon” as brand chrome for The Chloe Edit  

---

## QA Checklist

### Brand assets

- [ ] Primary logo is `logo-primary-horizontal.png` via `BrandLogo` / approved path  
- [ ] Logo not recreated in HTML/CSS  
- [ ] CC not used as header or hero logo  
- [ ] Favicon / avatar use approved CC assets only  

### Typography

- [ ] Montserrat + Playfair only (as configured)  
- [ ] Locked brand/edit copy exact  
- [ ] Nav / CTA tracking and case match shell  

### Colours

- [ ] Ivory / charcoal / sage / white only for core surfaces  
- [ ] No new accent colours  

### Header

- [ ] Shop · The Edit · Brands · Our Story  
- [ ] Account + Basket present  
- [ ] Mobile menu works; Escape closes  

### Hero

- [ ] Oversized wordmark dominant  
- [ ] Statement + support + both CTAs present  
- [ ] No photography / decorations  

### CTA

- [ ] Shop the Edit → `#chloe-edit`  
- [ ] Our Story → `#our-story`  

### The Chloe Edit

- [ ] Exact title and subtitle  
- [ ] White surface after ivory hero  
- [ ] No empty-state marketing copy  
- [ ] No products unless intentionally populated from catalogue  

### Responsive

- [ ] No horizontal overflow  
- [ ] Logo / spacing readable on mobile  
- [ ] Future grid 2 / 2 / 4  

### Accessibility

- [ ] Semantic headings (`h1` hero, `h2` edit)  
- [ ] Logo alt text  
- [ ] Focus-visible on controls  
- [ ] Keyboard-usable mobile menu  

### Performance

- [ ] Hero logo `priority` / eager where appropriate  
- [ ] Secondary images lazy  

### Commerce safety

- [ ] Shell changes do not alter Supabase / checkout / inventory APIs  
- [ ] No hardcoded fake catalogue  

---

## Design Principle (prominent)

**Chosen by Chloe should feel like an edit, not a template.**

Quiet · warm · personal · considered · confident — not empty, unfinished, luxury-fashion, generic ecommerce, or template-driven.

---

## Lock record

| Item | Status |
|------|--------|
| Announcement bar | LOCKED |
| Header | LOCKED |
| Hero (02C) | LOCKED |
| Hero → Edit transition | LOCKED |
| THE CHLOE EDIT framework | LOCKED |
| ChloeEditGrid architecture | LOCKED (unpopulated) |
| Footer structure | LOCKED |
| V4 logo assets | LOCKED |
| Storefront Shell V1 | **LOCKED — MASTER VISUAL REFERENCE** |

**Next work (out of scope for 03C):** populate The Chloe Edit from Thomas OS catalogue via adapter — without redesigning this shell.
