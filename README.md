# EXTRA ISLAMIC — Telegram Mini App

## Included
- Dark navy + teal mobile dashboard
- Prayer times from AlAdhan API (method 1: Karachi, Hanafi Asr)
- Default city: Jhenaidah, Bangladesh; preset city selector
- Next prayer countdown and progress
- Sehri/Fajr and Iftar/Maghrib display
- Approximate prohibited prayer-time windows
- Quran surah list, Arabic text and Bengali edition (when available)
- Tasbih counter, approximate Qibla bearing, sample duas, 99 names starter section, Islamic video search
- Telegram bot `/start` button to launch the Mini App
- Telegram Mini App `initData` validation endpoint
- Render health endpoint

## Files
- `server.js` — Express API + Telegram bot polling
- `public/index.html` — responsive Mini App UI
- `package.json` — dependencies
- `render.yaml` — Render Web Service configuration

## Android setup
1. In Telegram, open `@BotFather`, run `/newbot`, and save the token privately.
2. Create a GitHub repository and upload all project files, keeping `public/index.html` in the `public` folder.
3. In Render, create a Web Service from the repository.
4. Build command: `npm install`; Start command: `npm start`.
5. Add environment variable `BOT_TOKEN` with the BotFather token.
6. Deploy. Copy the HTTPS Render URL (example format `https://your-service.onrender.com`).
7. Add `WEBAPP_URL` with that exact HTTPS URL in Render Environment; save and redeploy.
8. In Telegram, open your bot and send `/start`, then tap the Mini App button.

## Important limitations / checks
- Use an HTTPS public URL for Telegram Mini Apps.
- The app calls AlAdhan for prayer timings using method 1 and Hanafi Asr. Prayer times can differ from local mosque or Bangladesh Islamic Foundation schedules; verify locally. The API's documented method options and caveat are at https://aladhan.com/prayer-times-api.
- Quran text/translations are retrieved from AlQuran Cloud; verify translation edition availability and religious text accuracy. Docs: https://alquran.cloud/api.
- Prohibited times shown are approximate illustrative windows, not a religious ruling. Confirm local guidance.
- Qibla bearing is recalculated for each preset city, but is a true-north calculation, not a sensor-driven compass. Calibrate/verify with a compass and account for local magnetic declination.
- The 99 Names section contains a commonly used 99-name list; verify Arabic spelling and transliteration against a trusted scholarly source.
- The video page can embed a public YouTube playlist inside the Mini App when you enter its playlist ID. The app does not host or verify videos.
- `validTelegramInitData` implements Telegram initData signature and age validation. The current UI does not require login for public prayer/Quran data; use the auth endpoint before adding user-specific private actions.
- Render plans and availability can change; choose a plan that remains online for the desired use.

- Prayer notifications in this version work only while the Mini App is open and the browser allows notifications; they are not reliable background push notifications.
