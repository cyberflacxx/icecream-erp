# VPS Rehost Runbook

This is a fallback plan only. Keep Vercel as the primary host unless the domain issue persists after the hardening changes.

## Objective

Move the Next.js app to a VPS with PM2, Nginx, and Certbot while preserving a rollback path to Vercel.

## Prerequisites

- Ubuntu 22.04 or newer VPS
- Node.js 22.x
- `npm`
- `pm2`
- `nginx`
- `certbot` and `python3-certbot-nginx`
- DNS control for `absolute-erp.com` and `www.absolute-erp.com`
- Environment variables currently used in production

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ABSOLUTE_ERP_BASE_URL`
- Any active mail, auth, and deployment variables already present in Vercel production

## Build And Start

1. Pull the exact release commit to the VPS.
2. Install dependencies with `npm install`.
3. Build with `npm run build`.
4. Start with PM2:

```bash
pm2 start npm --name absolute-erp -- start
pm2 save
pm2 startup
```

## Nginx Reverse Proxy

Use Nginx to terminate TLS and proxy to the Next app on `127.0.0.1:3000`.

Example server block:

```nginx
server {
    server_name www.absolute-erp.com absolute-erp.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }
}
```

Configure a canonical redirect so either apex redirects to `www.absolute-erp.com` or the reverse, matching the production decision.

## SSL With Certbot

1. Point DNS A records to the VPS.
2. Run:

```bash
sudo certbot --nginx -d absolute-erp.com -d www.absolute-erp.com
```

3. Confirm automatic renewal:

```bash
sudo systemctl status certbot.timer
```

## DNS Cutover

1. Lower DNS TTL before cutover if possible.
2. Update the A record for the canonical host to the VPS IP.
3. Keep the non-canonical host redirecting to the canonical host.
4. Run `npm run smoke:domain` against the live domain after propagation.

## Rollback To Vercel

1. Restore the previous DNS records pointing to Vercel.
2. Confirm Vercel production deployment is still healthy.
3. Re-run `npm run smoke:domain`.
4. Leave the VPS instance intact until traffic is stable on Vercel again.
