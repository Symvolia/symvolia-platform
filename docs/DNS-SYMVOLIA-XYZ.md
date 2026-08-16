# DNS for symvolia.xyz → GitHub Pages

Registrar: wherever you bought `symvolia.xyz`.

## Apex (`symvolia.xyz`)

Create these **A** records (host `@` or blank):

| Type | Name | Value |
|------|------|-------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

Optional **AAAA** (IPv6):

| Type | Name | Value |
|------|------|-------|
| AAAA | @ | 2606:50c0:8000::111 |
| AAAA | @ | 2606:50c0:8001::111 |
| AAAA | @ | 2606:50c0:8002::111 |
| AAAA | @ | 2606:50c0:8003::111 |

## Optional `www`

| Type | Name | Value |
|------|------|-------|
| CNAME | www | Symvolia.github.io |

## After DNS propagates

1. Open https://github.com/Symvolia/symvolia-platform/settings/pages
2. Custom domain: `symvolia.xyz` → Save
3. Enable **Enforce HTTPS** when available (can take a few minutes)

TTL: use 300–600s while testing.
