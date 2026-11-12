# Web push on mobile and desktop, and the permission prompt

Research for [#3](https://github.com/JSPRH/cohort-005-project/issues/3), part of map [#1](https://github.com/JSPRH/cohort-005-project/issues/1) (Engagement Nudges for Students). Researched 2026-11-12.

**Question:** What limits Cadence (a React Router 8 + Vite web app with no native app) when it sends Nudges by web push, with email as the fallback?

## TL;DR

- **Push works in every current major browser, with one big exception: on iPhone and iPad it works only after the Student adds Cadence to the Home Screen.** It needs iOS/iPadOS 16.4 or later. In a Safari tab on iOS, the `Notification` interface is not even defined. Most iPhone Students will never install the app, so email is the main channel for them, not just a fallback.
- **Ask for permission only after a click, never on page load.** Firefox 72+ and Safari require a user gesture. Chrome sends sites with low accept rates to a "quiet" UI that is just an icon in the address bar. Chrome also removes permission from sites people rarely use (installed web apps are exempt) and, from 2026, rate-limits push for low-engagement senders.
- **Use a pre-prompt.** Explain the benefit in Cadence's own UI first, then call `Notification.requestPermission()` only when the Student clicks "Turn on notifications". Detect a "denied" state and offer email instead.
- **What the app needs:** a service worker (`public/sw.js`) that shows a notification for every push, a web app manifest with `display: "standalone"` linked from `app/root.tsx`, HTTPS, and VAPID keys on the server. Vite's `public/` directory and `react-router-serve` already serve both files from the site root. No new routing is needed.

## 1. Platform support

### Support matrix (MDN browser-compat-data 8.1.8, 2026-11-02)

| Browser | `PushManager` since | Notes |
| --- | --- | --- |
| Chrome desktop | 42 | `applicationServerKey` (VAPID) required |
| Edge | 17 | `applicationServerKey` required |
| Firefox desktop | 44 | `subscribe()` / `requestPermission()` need a user gesture from Firefox 72 |
| Safari macOS | 16 | Needs macOS Ventura or later |
| Chrome Android | 42 | `applicationServerKey` required |
| Firefox Android | 48 | User gesture required from Firefox Android 79 |
| Samsung Internet | 4.0 | |
| **Safari iOS / iPadOS** | **16.4** | "Notifications are supported in web apps saved to the home screen" |
| Android WebView | not supported | Push does not work inside in-app browsers or WebViews |

Source: [`@mdn/browser-compat-data`](https://github.com/mdn/browser-compat-data) entries `api.PushManager`, `api.PushManager.subscribe`, `api.Notification.requestPermission_static` and `api.Window.pushManager`, read from `data.json` 8.1.8. The Push API is "Baseline: Widely available … since March 2023" ([MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)).

### iOS and iPadOS

- **Home Screen only.** "A web app that has been added to the Home Screen can request permission to receive push notifications" ([WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). In a normal Safari tab, `Notification` is undefined: "The parent `Notification` interface is undefined unless the page is a web app saved to the home screen. The app's manifest must have a non-default `display` value" (MDN BCD, `requestPermission_static`, safari_ios).
- **Minimum version is iOS/iPadOS 16.4** ([WebKit Features in Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)). From 16.4, third-party browsers on iOS can also offer "Add to Home Screen" in the Share menu (same source).
- **Manifest `display`.** Before iOS 26, the manifest's `display` had to be `standalone` or `fullscreen`, or the icon was only a bookmark ([WebKit 13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). On iOS/iPadOS 26, "every website added to the Home Screen opens as a web app" by default, but users can switch "Open as Web App" off ([WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)). Cadence should still ship `display: "standalone"` for older iOS versions.
- **User gesture.** Permission can be requested only "in response to direct user interaction", such as tapping a subscribe button ([WebKit 13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **Every push must show a notification.** `userVisibleOnly: true` is required, and "Violations of the `userVisibleOnly` promise will result in a push subscription being revoked" ([WebKit: Meet Web Push](https://webkit.org/blog/12945/meet-web-push/)).
- **Delivery goes through APNs (Apple's push service).** No Apple Developer Program membership is needed. If the server allow-lists push endpoints, it must allow `*.push.apple.com` ([WebKit 12945](https://webkit.org/blog/12945/meet-web-push/), [WebKit 13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **Extras.** Notifications respect Focus modes. The Badging API (`navigator.setAppBadge`) works in Home Screen apps and is granted together with notification permission ([WebKit 13966](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)).
- **Declarative Web Push (iOS/iPadOS 18.4+, `window.pushManager`)** lets the browser show a notification from a JSON payload without a service worker. A service worker becomes optional and can only modify the notification. Payloads in the declarative format also work with a classic service worker ([WebKit: Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/); BCD `api.Window.pushManager`: Safari 18.4 only). Cadence can use this format on the server and still use a normal service worker everywhere.

### The EU caveat on iOS

- In the iOS 17.4 betas (February 2024), Apple removed Home Screen web apps, and therefore web push, for users in the EU. Apple said this was part of complying with the Digital Markets Act (DMA). Apple reversed this before release, saying it would "continue to offer the existing Home Screen web apps capability in the EU", built on WebKit. The stable iOS 17.4 kept the feature. Apple posted this on [developer.apple.com/support/dma-and-apps-in-the-eu](https://developer.apple.com/support/dma-and-apps-in-the-eu/), but the page has since been rewritten and no longer contains the text. Contemporary record: [MacRumors, 2024-03-01](https://www.macrumors.com/2024/03/01/apple-walks-back-decision-to-disable-eu-web-apps/) (secondary source).
- The current Apple EU pages (terms updated 2026-08-18) cover alternative browser engines and app distribution. They say nothing about Home Screen web apps ([Apple Newsroom 2026-08](https://www.apple.com/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union/), [Changes for apps in the EU](https://developer.apple.com/support/apps-in-the-eu/)). **Current state:** EU iOS users get the same Home Screen push as everyone else, and Home Screen web apps still run on WebKit even when the Student's default browser uses a different engine. This is a policy risk to watch, not a current blocker.

### Android and desktop

- Push works in a normal browser tab. Chrome, Firefox, Samsung Internet and Edge on Android need no install. On desktop, Chrome, Edge, Firefox and Safari 16+ (macOS Ventura+) all support it (BCD table above).
- Firefox limits how many push messages that don't show a notification a site can send. Pushes that show a notification are exempt. Chrome has no such quota ([MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)).
- Desktop notifications usually appear only while the browser is running. Pushes sent while it is closed are queued by the push service until the push message's TTL expires. Treat push as "best effort" and keep email as the guaranteed channel.

## 2. What browsers do to sites that ask too early

### Chrome

- **Quiet UI (Chrome 80+).** Sites with very low accept rates, or users who often block requests, get a "quieter" prompt: no pop-up, only a bell icon in the address bar ([Chrome: web push rate limits](https://developer.chrome.com/blog/web-push-rate-limits); [Chrome Help](https://support.google.com/chrome/answer/3220216)). Chrome 84 also automatically enrolled sites with abusive permission requests or abusive notifications ([New in Chrome 84](https://developer.chrome.com/blog/new-in-chrome-84)).
- **How sites get enrolled.** "Chrome will automatically enroll sites with very low Accept rates into the quieter UI." The block rate is a strong signal. Enrolment is tracked separately for desktop and mobile. Closing the tab counts as a dismiss, and on mobile so does switching tabs ([Chrome: notification permission data in CrUX](https://developer.chrome.com/blog/notification-permission-data-in-crux)).
- **Permission chip (Chrome 98+).** The request appears as a chip next to the padlock and collapses if ignored. Chrome's data: on Windows, 47% of notification prompts were ignored, 36% dismissed, 9% blocked and only 6.7% allowed ([Chrome: Permissions request chip](https://developer.chrome.com/blog/permissions-chip)).
- **Automatic revocation (October 2025, Android and desktop).** Chrome removes notification permission from sites with very low engagement and high notification volume, and tells the user. "This feature does not revoke notifications for any installed web apps" ([Google Chromium blog](https://blog.google/chromium/automatic-notification-permission/)). Separately, since September 2024 Chrome has revoked permission from sites that Safe Browsing flags as abusive ([Chrome: web push rate limits](https://developer.chrome.com/blog/web-push-rate-limits)).
- **Push rate limits (rolling out from January 2026).** Chrome checks each site daily: pushes sent and prompts shown, both relative to the time users spend on the site, plus an engagement score. Flagged sites get HTTP 429 above a per-minute limit, for 1, then 7, then 14 days. The count resets after 42 days without disruption ([Chrome: web push rate limits](https://developer.chrome.com/blog/web-push-rate-limits)). A low-volume Nudge feature should not be affected, but sending many Nudges to disengaged Students is exactly what this targets.

### Firefox

- **Since Firefox 72 (Android 79), the prompt needs a user gesture** (tap, click or key press). Without one, "Prompts without interaction will only show a small icon in the url bar." The user can still click that icon to allow ([Mozilla: Restricting notification permission prompts](https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/); BCD notes above).
- Mozilla's data behind the change: about 99% of prompts went unaccepted and 48% were actively denied. Prompts shown after a user interaction were allowed far more often: 24% for existing users and 56% for new users. Firefox 70 also replaced "Not Now" with "Never" in the prompt (same source).

### Safari

- **A user gesture is required on macOS and iOS** ("requesting a push subscription requires an explicit user gesture", [WebKit 12945](https://webkit.org/blog/12945/meet-web-push/); [WebKit 13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). On iOS this applies inside the Home Screen app.

### Common to all browsers

- `requestPermission()` needs HTTPS. Chrome and Firefox block it in cross-origin iframes. It resolves to `granted`, `denied` or `default`, and `default` should be treated as denied ([MDN Notification.requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)). Once a user denies, browsers remember it, and the site cannot ask again ([web.dev: Permissions best practices](https://web.dev/articles/permissions-best-practices)).

## 3. Recommended opt-in pattern

From [web.dev: Permissions best practices](https://web.dev/articles/permissions-best-practices) and [Chrome: CrUX notification data](https://developer.chrome.com/blog/notification-permission-data-in-crux):

1. **Never ask on page load.** "Only ask for permission after the user has interacted with the page." web.dev reports allow rates of about 12% without a sign of intent and about 30% after an interaction.
2. **Ask in context.** "Let your users take the initiative and turn on notifications at their own pace." Put the toggle or button at a step where Students want timely updates. For Cadence that could be after enrolling in a course, in course settings, or next to a lesson deadline.
3. **Pre-prompt first.** Show Cadence's own UI explaining what Nudges are and how often they come. "Only when users react affirmatively to such a pre-prompt should you trigger the browser's permission prompt." A "not now" answer to Cadence's own pre-prompt costs nothing. A "Block" in the browser prompt is permanent.
4. **Detect a denied state and offer an alternative.** Use `Notification.permission` or `navigator.permissions.query({ name: "notifications" })`. If permission is denied, show how to re-enable it in the browser and keep email on. web.dev names "email instead of push notifications" as the standard alternative.
5. **On iOS, add an install step first.** If `"Notification" in window` is false and the device is iOS, show Add to Home Screen instructions instead of a push button. Inside the installed app, show the normal pre-prompt.
6. **Send few Nudges, and only relevant ones,** to stay clear of Chrome's quiet UI, automatic revocation and rate limits (section 2).

## 4. What a React Router 8 / Vite app needs

### Pieces

| Piece | Why | Source |
| --- | --- | --- |
| HTTPS (or `localhost` in development) | Service workers and `requestPermission` work only in secure contexts | [MDN register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register), [MDN requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static) |
| Service worker with `push` and `notificationclick` handlers | "For an app to receive push messages, it has to have an active service worker" | [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) |
| Manifest with `name`, `icons` (512 px plus 192 px), `start_url: "/"`, `display: "standalone"`, `id` | Needed so iOS treats the icon as a web app that can get push; `id` keeps the identity stable across installs and syncs Focus settings | [web.dev: Web app manifest](https://web.dev/learn/pwa/web-app-manifest), [WebKit 13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) |
| `<link rel="manifest" href="/manifest.webmanifest">` on every page | "make sure to link its manifest to all of them" | [web.dev: Web app manifest](https://web.dev/learn/pwa/web-app-manifest) |
| VAPID key pair; `subscribe({ userVisibleOnly: true, applicationServerKey })` | Chrome, Edge and Samsung require `applicationServerKey`; Safari requires `userVisibleOnly` | BCD `api.PushManager.subscribe`, [WebKit 12945](https://webkit.org/blog/12945/meet-web-push/) |
| Server-side storage of `PushSubscription` (endpoint plus keys), with CSRF protection on the subscribe endpoint | "The endpoint URL therefore needs to be kept secret"; "it is vitally important that you protect against CSRF/XSRF issues" | [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) |

### How to serve the files in this repo

- **Put `sw.js` and `manifest.webmanifest` in `public/`.** Vite serves `public/` files "at root path `/` during dev, and copied to the root of the dist directory as-is", without hashing ([Vite: Static Asset Handling](https://vite.dev/guide/assets)). A service worker needs a stable, unhashed URL. Serving it at the root, `/sw.js`, gives it scope `/`, because a service worker "can't have a scope broader than its own location" unless a `Service-Worker-Allowed` header says otherwise ([MDN register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)). Do not bundle the service worker as a hashed asset under `/assets/`.
- **In production,** `react-router-serve` (`npm run start`) serves `build/client` with `express.static`. Hashed files under `/assets` get `immutable, maxAge: 1y`. Root files, including those copied from `public/`, get Express defaults with no long cache (`node_modules/@react-router/serve/dist/cli.js`, lines 115-120). So `sw.js` updates are picked up. Express maps `.webmanifest` to `application/manifest+json`, the type web.dev recommends.
- **Link the manifest** by adding `{ rel: "manifest", href: "/manifest.webmanifest" }` to the `links` export in `app/root.tsx`. This covers every page, since all routes render through `Layout`. Alternatively, a React Router resource route (a loader returning `Response.json(...)`) could generate the manifest dynamically, but a static file is enough.
- **Register the service worker on the client only,** for example in a `useEffect` in `root.tsx`, or lazily when the Student opens notification settings. Use `navigator.serviceWorker.register("/sw.js")`. SSR (`ssr: true` in `react-router.config.ts`) runs on the server, where `navigator` does not exist, so the call must not run during render.
- **Local testing:** `localhost` counts as secure, so `npm run dev` works for Chrome and Firefox. iOS push needs a real HTTPS origin, for example a tunnel, so the app can be added to the Home Screen on a device.
- **Server sending:** sign with VAPID, encrypt the payload (RFC 8291), POST to `subscription.endpoint`, and delete the subscription on HTTP 404/410. Expect HTTP 429 from Chrome if the site gets flagged ([Chrome: web push rate limits](https://developer.chrome.com/blog/web-push-rate-limits)).

## Implications for Nudges

- Plan on **email reaching every Student and push as a bonus channel** for those who opt in. On iOS, that means only Students who installed the app.
- The permission ask is a product moment that needs design: a pre-prompt at a meaningful point, not a site-wide banner.
- Keep per-Student Nudge volume low. Low engagement now costs a site permissions (Chrome's quiet UI and auto-revocation) and throughput (rate limits).

## Sources

Primary: [WebKit 12945](https://webkit.org/blog/12945/meet-web-push/), [WebKit 13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [WebKit 13966](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/), [WebKit 16535](https://webkit.org/blog/16535/meet-declarative-web-push/), [WebKit 17333](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [Apple: Changes for apps in the EU](https://developer.apple.com/support/apps-in-the-eu/), [Apple Newsroom 2026-08](https://www.apple.com/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union/), [Chrome: permissions chip](https://developer.chrome.com/blog/permissions-chip), [Chrome: CrUX notification data](https://developer.chrome.com/blog/notification-permission-data-in-crux), [Chrome: web push rate limits](https://developer.chrome.com/blog/web-push-rate-limits), [New in Chrome 84](https://developer.chrome.com/blog/new-in-chrome-84), [Chromium: auto-revocation](https://blog.google/chromium/automatic-notification-permission/), [Chrome Help: notifications](https://support.google.com/chrome/answer/3220216), [Mozilla: restricting prompts](https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [MDN requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static), [MDN register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register), [MDN browser-compat-data](https://github.com/mdn/browser-compat-data), [web.dev: permissions best practices](https://web.dev/articles/permissions-best-practices), [web.dev: web app manifest](https://web.dev/learn/pwa/web-app-manifest), [Vite: static assets](https://vite.dev/guide/assets), `@react-router/serve` 8.3.0 source.

Secondary (used only for the 2024 EU timeline, because Apple has since rewritten its page): [MacRumors 2024-03-01](https://www.macrumors.com/2024/03/01/apple-walks-back-decision-to-disable-eu-web-apps/).
