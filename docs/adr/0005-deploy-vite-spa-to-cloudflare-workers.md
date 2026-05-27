# Deploy the Vite SPA to Cloudflare Workers from GitHub Actions

Jot Down will deploy the built Vite app to Cloudflare Workers Static Assets from GitHub Actions whenever changes reach `main`.

The app is a local-first SPA without a server-side API, so Workers Static Assets is enough for production hosting while leaving room for Worker code later if the app needs edge behavior. The deployment pipeline runs the same project checks used locally before deploying, then runs `wrangler deploy` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` supplied by GitHub Actions secrets.

Cloudflare Pages was a viable alternative for static hosting, but Workers keeps the deployment target aligned with future Worker-side behavior without introducing a second Cloudflare hosting model.
