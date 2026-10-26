# Coolify / PHP migration report

Audit date: 2026-10-26 (Asia/Manila)

## A. PHP upgrade

- Original PHP version: not specified; the supplied application contained no PHP source and no Composer metadata.
- Target PHP version: PHP 8.5.11 on the official `php:8.5.11-apache` image. PHP 8.5.11 was the latest stable, non-prerelease release published by PHP at audit time.
- Architecture: framework-free HTML/CSS/JavaScript browser game, now with narrowly scoped PHP endpoints for Azure Speech credential isolation.
- Compatibility findings: no legacy PHP functions, PHP inheritance, dynamic properties, Composer packages, or existing PHP runtime paths existed to upgrade.
- Fixes: added PHP 8.5-compatible strict endpoints; enabled only the required `curl` extension; supplied production PHP settings.
- Remaining risk: application behavior depends on Azure Speech, an external CDN/assets host, and the Microsoft browser Speech SDK. Full speech validation requires valid Azure credentials and real microphone/browser testing.

## B. Code changes

| File | Reason |
|---|---|
| `Dockerfile` | Production Apache/PHP 8.5.11 image, cURL extension, modules, health check, and non-root-owned application files |
| `docker/apache.conf` | Apache document-root access, disabled indexes/signature, rewrite support, and low-risk response headers |
| `php.ini` | Production error handling, safer sessions, timezone integration, and bounded memory |
| `api/bootstrap.php` | Central server-side environment validation |
| `api/speech-config.php` | Exchanges the private Azure key for a short-lived browser authorization token |
| `api/pronunciation.php` | Proxies assessment requests without exposing the subscription key |
| `health.php` | Container/Coolify health endpoint |
| `js/azure-speech.js` | Uses a short-lived token for streaming and the same-origin proxy for REST assessment |
| `js/app.js` | Removes the hardcoded subscription key and reads the short-lived token |
| `index.php` | Renders asset URLs from `APP_URL` and loads runtime speech configuration before application startup |
| `css/style.php` | Renders stylesheet asset URLs from `APP_URL` |
| `.env.example`, `.gitignore`, `.dockerignore` | Documents variables and excludes secrets/build-only files |
| `README.md` | Deployment and operations instructions |

The frontend design, game rules, scoring rules, character data, and database schema (none exists) were not changed.

## C. Docker and Coolify

- Base image: `php:8.5.11-apache`.
- Required PHP extension: `curl`; PHP core/json functionality is also used.
- Apache modules: `headers`, `rewrite`.
- Document root: `/var/www/html`.
- Container port: `80`.
- Environment variables: see `README.md`.
- External asset origin: configured at runtime through required `APP_URL`; no asset-host origin is hardcoded in application HTML, CSS, or JavaScript.
- Persistent storage: none required. There are no server-side upload, cache, session-dependent, or generated-data directories.
- Secrets: runtime-only; no secret is copied into an image layer.

## D. Database

- Database detected: **NO**.
- Driver: none.
- Connection code, queries, schema, or migrations: none.
- Required database changes: none.

## E. Mailer

- Mailer detected: **NO**.
- PHP `mail()`, PHPMailer, SwiftMailer, Symfony Mailer, SMTP, SES, Resend, SendGrid, Mailgun, contact-form delivery, and mail environment variables: not found.
- Relevant files: none.
- Potential PHP/Docker compatibility issues: none.
- Changes required: **NO**.
- Mailer code modified: **NO**.

## F. Storage, security, and integrations

- Server-side file uploads: none. Microphone recordings and result images are processed in the browser and are not stored by the application server.
- Sessions/authentication/authorization: none detected.
- External integrations: Azure Speech REST/SDK, `sanrio.mmdbfiles.com` assets, jsDelivr-hosted Microsoft Speech SDK, and the public Sanrio ranking link.
- Confirmed critical issue fixed: a live-looking Azure Speech subscription key was embedded in `js/app.js`. It was removed and replaced by server-side environment use. **Rotate/revoke the exposed key before deployment.**
- The proxy validates method, language, reference length, content type, and payload size. Public abuse/rate-limiting should additionally be handled at the reverse proxy/WAF if the campaign threat model requires it.
- The Microsoft Speech SDK is remotely loaded at version 1.40.0. It was left unchanged to avoid an untested game-runtime change; dependency update and subresource-integrity review remain recommended.

## G. Verification scope

Executed and passed:

- PHP syntax lint for every PHP file (local PHP 8.3.12).
- JavaScript parse checks for every JavaScript file (Node.js 20.6.1).
- Docker image build from `php:8.5.11-apache`.
- Container startup and Docker health check.
- Runtime PHP version (`8.5.11`) and cURL extension presence.
- Apache `headers` and `rewrite` module presence.
- HTTP `200` for `/` and `/health.php`, `405` for GET on the POST-only pronunciation endpoint, and `404` for an unknown path.
- Production response headers and safe behavior when Azure configuration is absent.
- Runtime `APP_URL` rendering in HTML, CSS, and JavaScript configuration using a non-default test origin.
- Runtime configuration loads before every JavaScript module that constructs an asset URL.

Not executed:

- Live Azure token issuance or pronunciation assessment (no authorized non-production Azure secret was used).
- Microphone, full game round, result sharing, and cross-browser visual checks. A browser UI was unavailable in the execution environment.
- Database, admin login, authentication, mail, and server-side upload tests are not applicable because those features do not exist in the supplied application.

## H. Known deployment constraints

- HTTPS is required for browser microphone access outside localhost.
- Egress to Azure Speech, jsDelivr, and `sanrio.mmdbfiles.com` must be allowed.
- The exposed historical Azure key must be rotated; do not reuse it.
- The remote GitHub repository was empty at audit start, despite the task naming `master`; GitHub reported `main` as its default branch. Repository bootstrapping is therefore needed before a pull request can have a base branch.
