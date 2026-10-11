# Grew

Grew prototype — GitHub Pages-ready static project.

## Structure

- `index.html` — app shell; loads the scripts below in order (order matters: plain scripts sharing globals)
- `css/styles.css` — all styles, grouped by screen (table of contents at the top)
- `js/` — one file per area, loaded in this order:
  - `01-brand` app name and small globals · `02-tree-art-assets` tree/forest picture list · `03-utils` shared helpers
  - `04-genres` genre rules · `05-trees` tree & visitor data, work → tree mapping · `06-economy` ownership, hidden trees, coupons, packs, forest sets
  - `07-model` data model (works, logs, completion) · `08-tree-art` choosing tree/visitor art · `09-forest-layout` forest board layout and SVG
  - `10-shop` shop, codex and decorate screens · `11-forest-sound` · `12-notifications` · `13-link-import` · `14-cloud` login and cloud sync
  - `15-state` app state, load/save · `16-app-shell` navigation, render loop, toasts, sheets
  - `17-today` · `18-scrap` (list, filters, detail, manual entry) · `19-search` (book/movie/music search) · `20-record` (record, finish, plant)
  - `21-forest` (month/year/lifetime forest, calendar) · `22-share` share images · `23-photo-ocr` add by photo · `24-my` profile, backup, licenses
  - `25-events` input handling (`data-action` clicks), back button, app start · `26-onboarding` intro, sign-in, taste picks
- `assets/images/` — tree, decoration, visitor artwork · `assets/audio/` forest sounds · `assets/fonts/` display font
- `docs/APP-STRUCTURE.md` — how the app works (growth, forest, decorating, shop)

## GitHub Pages

1. Create a GitHub repository.
2. Upload **the contents of this folder** to the repository root. `index.html` must be at the root.
3. Commit and push.
4. In GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**.
5. Select `main` and `/ (root)`, then save.

All static asset paths are relative, so the project works both at a custom domain and under a repository path such as `https://<user>.github.io/<repo>/`.

## Releasing changes

Phones keep old CSS/JS cached, so every local `css/` and `js/` link in `index.html` carries a `?v=` stamp. Bump it on each release:

```sh
V=$(date -u +%Y%m%d%H%M); sed -i -E "s#(\./(css|js)/[0-9A-Za-z_-]+\.(css|js))(\?v=[0-9]+)?\"#\1?v=$V\"#g" index.html
```

The onboarding sticker art ships as pictures in `assets/images/onboarding/`. The live versions are still in `js/26-onboarding.js` (`INTRO_SLIDES[].art`, `entryStickerArt`); set `window.INTRO_LIVE_ART = true` before rendering to see them, and re-capture the pictures if they change.

## Important legacy names

Some internal identifiers still contain `songrim` (for example localStorage keys, internal DOM/runtime names, and the existing Supabase table name). They are intentionally retained so existing user data and backend compatibility are not broken. The product/brand displayed to users is **그루 / Grew**.

## Local preview

Do not rely on opening `index.html` with `file://` for every browser feature. A local static server is safer, e.g. `python -m http.server 8000`, then open `http://localhost:8000`.

## Before launch

- **Store** — `BM_STORE_OPEN` in `js/06-economy.js` follows `BM_PREVIEW`: in the normal build special (paid) trees, floors,
  the packs and ad coupons show "곧 열려요" and nothing charges. `?preview=1` turns on the free trial store on that
  device (`?preview=0` turns it off). Connect real payments and ads before opening it for everyone.
  Hidden trees are never sold; they open at 30 / 50 / 75 / 100 planted trees (`BM_MYSTERY_AT`).
- **Social login** — Kakao and Google go through (Apple is hidden for now; see `OB_SOCIAL`) Supabase Auth (`cloudOAuthStart`). Turn each
  provider on in Supabase → Authentication → Providers, and add `https://jynsol.github.io/Grew/` to
  Authentication → URL Configuration → Redirect URLs.
- **Legal pages** — `legal/terms.html` and `legal/privacy.html`. Fill in `[운영자 이름]`, `[문의 이메일]`
  and `[데이터 저장 지역]` (Supabase project region) before launch.
- **Link preview** — `assets/images/og.jpg` (1200×630) with Open Graph tags in `index.html`. KakaoTalk
  caches previews; after changing the image, clear it at developers.kakao.com → 도구 → 디버거.
