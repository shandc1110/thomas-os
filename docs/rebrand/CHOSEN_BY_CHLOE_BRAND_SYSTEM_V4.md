# CHOSEN by Chloe — Brand System V4

**Status:** LOCKED — implement assets as supplied; do not redesign or recreate logos.

Installed from the official V4 logo asset package into:

```
web/public/brand/chosen-by-chloe/v4/
```

## Asset inventory

| File | Role |
|------|------|
| `logo-primary-horizontal.png` | **PRIMARY MASTER** — header, nav, main identity |
| `logo-primary-stacked.png` | Stacked / hero / print |
| `logo-horizontal-alternative.png` | Alternate horizontal lockup |
| `logo-monochrome-black.png` | Monochrome black |
| `logo-monochrome-white.png` | Reverse white |
| `cc-signature.png` | Secondary CC signature (small use only) |
| `cc-monogram.png` | Small-use monogram |
| `avatar-ivory.png` | Avatar (ivory) |
| `avatar-sage.png` | Avatar (sage) |
| `avatar-charcoal.png` | Avatar (charcoal) |
| `favicon-cc.png` | Favicon |
| `README.md` | Package notes |

Public URL base: `/brand/chosen-by-chloe/v4/`

## Hierarchy (non-negotiable)

1. **Primary:** `logo-primary-horizontal.png` — “CHOSEN by Chloe” wordmark  
2. **Secondary:** CC signature / monogram — never competing with or replacing the wordmark  
3. **Do not** combine CC with the wordmark into a new logo  
4. **Do not** recreate the wordmark with HTML/CSS/fonts  

## Approved core palette

| Token | Hex |
|-------|-----|
| Warm Ivory | `#F8F1E5` |
| Charcoal | `#242321` |
| Sage | `#A8B19F` |
| White | `#FFFFFF` |

## Code

- Tokens / paths: `web/lib/brand/chosen-by-chloe.ts`
- Header: `web/components/shop/ShopHeader.tsx`
- Footer: `web/components/shop/ShopFooter.tsx`

## Feel

Warm, editorial, thoughtful, independent, modern, refined, playful but not childish, Chinese-British, curated.

**Not:** jewellery, luxury fashion house, corporate, childish, cartoonish, generic kids ecommerce.

**No:** hearts, swooshes, motion marks, decorative flourishes.
