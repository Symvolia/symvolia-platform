# Symvolia — public site

Static site (HTML/CSS/JS). No build step.

## Live preview (local)

```bash
python3 -m http.server 8765
```

Open http://localhost:8765

## Publish on GitHub Pages (permanent)

1. Create a new public repository on GitHub (e.g. `symvolia-site`).
2. From this folder:

```bash
git init
git add .
git commit -m "Publish Symvolia site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/symvolia-site.git
git push -u origin main
```

3. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. After the workflow runs, the site is at:

`https://YOUR_USERNAME.github.io/symvolia-site/`

## Quick public link (temporary)

With a local server on port 8765:

```bash
/tmp/cloudflared tunnel --url http://localhost:8765
```

Cloudflare prints a `https://….trycloudflare.com` URL — public until you stop the tunnel.

## Netlify Drop (no CLI)

Drag this folder onto https://app.netlify.com/drop for an instant public URL.
