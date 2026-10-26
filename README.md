# Sanrio Character Ranking 2026 game

This repository packages the existing browser game for Docker/Coolify. Apache serves the static frontend, while two small PHP endpoints keep the Azure Speech subscription key on the server.

## Runtime configuration

| Variable | Purpose | Required | Used in |
|---|---|---:|---|
| `AZURE_SPEECH_KEY` | Azure Speech subscription key used to issue short-lived browser tokens and proxy pronunciation assessment requests | Yes, for speech assessment | `api/speech-config.php`, `api/pronunciation.php` |
| `AZURE_SPEECH_REGION` | Azure Speech resource region | No (defaults to `eastasia`) | `api/bootstrap.php` |
| `TZ` | PHP/container timezone | No (recommended: `Asia/Manila`) | `php.ini` |

Do not expose `AZURE_SPEECH_KEY` as a frontend build argument or commit it to the repository. The previously exposed key must be rotated in Azure before deployment.

## Local build

```sh
docker build -t sanrio2026game .
docker run --rm -p 8080:80 \
  -e AZURE_SPEECH_KEY='replace-me' \
  -e AZURE_SPEECH_REGION='eastasia' \
  -e TZ='Asia/Manila' \
  sanrio2026game
```

Open `http://localhost:8080`. The health check is available at `/health.php`.

## Coolify deployment

1. Create an application from this GitHub repository and select the migration branch/approved merge commit.
2. Choose **Dockerfile** as the build pack; the Dockerfile is at the repository root.
3. Set container port **80** and configure the public HTTPS domain. Microphone access requires a secure browser context.
4. Add `AZURE_SPEECH_KEY` as a runtime secret. Add `AZURE_SPEECH_REGION` and `TZ` using the values above.
5. Do not configure any build-time secret arguments.
6. Use `/health.php` as the health-check path if Coolify requests one.
7. Deploy and verify the homepage, static assets, microphone permission, one full game round, Azure scoring, and result sharing on the target browsers.

No persistent volume is required. The application has no server-side uploads, database, sessions, cache, or generated files. Browser-generated result images remain on the user's device. Container restarts therefore do not discard application data.
