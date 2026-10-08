# Grew

Grew prototype — GitHub Pages-ready static project.

## Structure

- `index.html` — app shell / markup
- `css/styles.css` — app styles
- `js/` — app logic, UI, storage, APIs, forest visualization, onboarding
- `assets/images/` — tree, decoration, visitor artwork
- `assets/audio/` — forest ambient audio
- `assets/fonts/` — display font

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

The onboarding sticker art ships as pictures in `assets/images/onboarding/`. The live versions are still in `js/11-onboarding.js` (`INTRO_SLIDES[].art`, `entryStickerArt`); set `window.INTRO_LIVE_ART = true` before rendering to see them, and re-capture the pictures if they change.

## Important legacy names

Some internal identifiers still contain `songrim` (for example localStorage keys, internal DOM/runtime names, and the existing Supabase table name). They are intentionally retained so existing user data and backend compatibility are not broken. The product/brand displayed to users is **그루 / Grew**.

## Local preview

Do not rely on opening `index.html` with `file://` for every browser feature. A local static server is safer, e.g. `python -m http.server 8000`, then open `http://localhost:8000`.

## Before launch

- **Store** — `BM_STORE_OPEN` in `js/03-core.js` is `false`: special (paid) trees, floors, the packs and ad coupons
  show "곧 열려요" and nothing charges. Set it to `true` only once real payments and ads are connected.
  Hidden trees are never sold; they open at 30 / 50 / 75 / 100 planted trees (`BM_MYSTERY_AT`).
- **Social login** — Kakao and Google go through (Apple is hidden for now; see `OB_SOCIAL`) Supabase Auth (`cloudOAuthStart`). Turn each
  provider on in Supabase → Authentication → Providers, and add `https://jynsol.github.io/Grew/` to
  Authentication → URL Configuration → Redirect URLs.
- **Legal pages** — `legal/terms.html` and `legal/privacy.html`. Fill in `[운영자 이름]`, `[문의 이메일]`
  and `[데이터 저장 지역]` (Supabase project region) before launch.
- **Link preview** — `assets/images/og.jpg` (1200×630) with Open Graph tags in `index.html`. KakaoTalk
  caches previews; after changing the image, clear it at developers.kakao.com → 도구 → 디버거.
