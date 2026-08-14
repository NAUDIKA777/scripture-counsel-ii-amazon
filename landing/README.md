# Wisdom &amp; Word — Landing Page

Standalone static one-page landing site. Zero dependencies (except Google Fonts loaded from CDN). Just one HTML file — deploy anywhere.

## Files
- `index.html` — the complete landing page (self-contained CSS + copy)

## Deploy options
Any static host will work. Some easy paths:

**Netlify**
1. Drag-and-drop the `landing/` folder onto https://app.netlify.com/drop
2. Done — get a live URL immediately.

**Vercel**
1. `vercel --prod` from inside the `landing/` folder (using the Vercel CLI), or
2. Push to a git repo and import it into vercel.com.

**GitHub Pages**
1. Push the folder into a repo.
2. Settings → Pages → Deploy from branch → root.

**S3 / Cloudflare Pages / Any static server**
Just upload `index.html`.

## Custom domain
Point your domain to whichever host you pick. Change no code.

## CTA links
All the "Try Free / Ask the Elder / Become Pro / Enter Wisdom &amp; Word" buttons point to:

```
https://scripture-counsel-2.emergent.host
```

If your live app domain changes, do a find-and-replace on that URL in `index.html`.
