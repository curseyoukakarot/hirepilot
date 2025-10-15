## Stream Subdomain Setup

1. Create DNS A record:
   stream.thehirepilot.com → <Docker Host IP>

2. Install NGINX + Certbot on Docker host:
   sudo apt install nginx certbot python3-certbot-nginx

3. Enable SSL:
   sudo certbot --nginx -d stream.thehirepilot.com

4. Test stream:
   https://stream.thehirepilot.com/vnc.html

## Environment Variables

Add these to your environment (e.g., backend `.env`):

```
STREAM_PUBLIC_BASE_URL=https://stream.thehirepilot.com
NOVNC_PORT=58080
CDP_PORT=59222
```

Notes:
- STREAM_PUBLIC_BASE_URL must point to the public stream origin (no backend proxy).
- NGINX should reverse proxy `stream.thehirepilot.com` → `127.0.0.1:58080` on the Docker host.

