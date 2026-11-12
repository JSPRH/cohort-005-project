# Which provider delivers web push with email fallback?

Research for [#2](https://github.com/JSPRH/cohort-005-project/issues/2) (map [#1](https://github.com/JSPRH/cohort-005-project/issues/1), Engagement Nudges). Researched 2026-11-12 against vendor docs and pricing pages. Prices and limits change; re-check before committing.

**This is a recommendation, not a decision.** The choice belongs to the later grilling ticket.

## What we need

A Nudge is a templated message to a Student about a course they are enrolled on. Our fallback rule is: **web push if the Student has an active subscription, otherwise email**. That is a routing decision made before sending, not "send push, wait, then email if it was not seen". Cadence runs on one long-lived Node server with SQLite through Drizzle. It has no email, notification or job-runner code yet. We want a free tier and EU-compatible processing.

## Summary

| Option | Free tier | Cheapest paid | EU data | Native browser web push | Push→email fallback | Delays / scheduling | Tracking |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Self-hosted**: `web-push` + VAPID + EU email API | Library is free. Email: Brevo 300/day, Resend 3,000/mo (100/day) | Resend Pro $20/mo for 50k emails | Push data stays in our SQLite. Email depends on the provider (see below) | Yes | We write it: a simple `if (subscription) push else email` | We write it: a timer or poller in the Node process | Clicks through our service worker. Push delivery is "accepted by the push service" only. Email opens and clicks come from the provider |
| **OneSignal** | 10k emails/mo. Web push free (the pricing table caps sends at 10k subscribers each). 3 active Journeys | Growth $19/mo + $0.004 per web-push subscriber, $1.50 per 1k emails | "Primary data centers are located in the EU". US company under the EU–US DPF, with an EU DPA | Yes (their SDK and service worker) | Yes. A Journeys "Wait Until" node, then send on another channel | Journeys wait nodes | Delivered (confirmed receipt), clicked, email opens |
| **Novu** (cloud) | 10k workflow runs/mo, 5 workflows | Pro $30/mo | EU residency on the free tier | **No.** Needs FCM, OneSignal, Pushpad, Pusher Beams or a push webhook | Step conditions can check earlier steps, but only for in-app steps | Delay step. The free tier caps delays at 1 day | Through the downstream provider |
| **Knock** | 10k messages/mo | Starter $250/mo | No EU region found in Knock's docs | **No.** Its push providers are APNs, FCM, Expo, SNS and OneSignal | Step conditions. No documented check on push delivery status | Delay up to 365 days | Through the downstream provider |
| **Customer.io** | None (trial, plus a startup programme) | Essentials $100/mo (5k profiles) | EU data center in Belgium, chosen at signup | Yes, but **alpha**, one site per workspace | Build it yourself with workflow branches | Workflow waits | Same metrics as app push |

## Findings per option

### Self-hosted: VAPID + `web-push` + a transactional email API

- The `web-push` npm library implements the Web Push Protocol and encrypts the payload. `generateVAPIDKeys()` makes the key pair once. `setVapidDetails(subject, publicKey, privateKey)` configures the server. `sendNotification(subscription, payload, { TTL, urgency, topic, ... })` sends one message, and on failure the error exposes `statusCode`. ([web-push README](https://github.com/web-push-libs/web-push))
- RFC 8030 requires a `TTL` header (§5.2) and allows `Urgency` (§5.3). A push service "MAY expire a subscription at any time" and answers sends to an expired subscription with **404** (§7.3). We should delete the subscription row on 404 or 410, and the Student then falls back to email next time. ([RFC 8030](https://datatracker.ietf.org/doc/html/rfc8030))
- Fit with our stack is strong. We add one `push_subscriptions` table in SQLite, a route that stores the browser's `PushSubscription` JSON, a service worker in `public/`, and a `notificationclick` handler that calls an endpoint to record clicks. There is no extra infrastructure. The fallback is one `if` in our code.
- What we have to build: scheduling and delays. With one long-lived Node process, a small "nudges due" table polled every minute is enough. We also build templating and click recording.
- Email options:
  - **Brevo**: free plan of 300 emails/day, with API and SMTP relay included. Brevo is EU-based (formerly Sendinblue, France). ([Brevo SMTP](https://www.brevo.com/free-smtp-server), [Brevo email API](https://www.brevo.com/features/email-api/)) Its headquarters and hosting location are not confirmed on a primary page. Check its DPA.
  - **Resend**: free plan of 3,000 emails/mo and 100/day. Pro is $20/mo. ([Resend pricing](https://resend.com/pricing)) You can send from Ireland (`eu-west-1`), but "account data, including email metadata, logs, and API records, is stored in the United States". ([Resend regions](https://resend.com/docs/dashboard/domains/regions)) That is weaker for GDPR than Brevo.

### OneSignal

- Free plan: 10,000 email sends/mo, web push with a 10k-subscribers-per-send cap, 3 active Journeys and 30 days of reporting. Growth costs $19/mo plus usage: $0.004 per web-push subscriber and $1.50 per 1k emails over 20k. ([OneSignal pricing](https://onesignal.com/pricing))
- Fallback: OneSignal's documented pattern is a Journey with a **Wait Until** node (delivered, clicked or opened) that sends on another channel if the condition is not met before it expires. ([Push fallback method](https://documentation.onesignal.com/docs/en/push-fallback-method)) The docs list no "has no push subscription" condition. We would probably still route that case ourselves, or rely on Journeys only reaching subscribed channels.
- GDPR: "Our primary data centers are located in the European Union." OneSignal is certified under the EU–US Data Privacy Framework and acts as processor. ([Data questions](https://documentation.onesignal.com/docs/en/data-questions.md), [EU DPA](https://media-cms.onesignal.com/cms/Files/OneSignal_EU_DPA.pdf)) The pricing page says Free is "Compliant" and Growth and above are "Compliant w/ DPA". Whether the DPA covers the free tier is unclear.
- Fit: their SDK owns the service worker and the subscription, so we would sync OneSignal external IDs with our Student IDs. Student and course data leaves our server.

### Novu

- Free tier: 10k workflow runs/mo, with **US and EU data residency on Free**. Pro costs $30/mo. Self-hosting is listed as an Enterprise option. ([Novu pricing](https://novu.co/pricing))
- No native browser web push. The push integrations are FCM, Expo, APNs, OneSignal, Push Webhook, Pusher Beams and Pushpad. ([Novu push](https://docs.novu.co/platform/integrations/push)) We would still need a second web-push provider, or keep `web-push` behind Novu's push webhook.
- Delay steps can be fixed, scheduled or dynamic. Maximum delay is **1 day on Free**, 7 days on Pro and 30 days on Team. ([Novu delay](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/delay)) Step conditions can check `seen` and `read` on earlier **in-app** steps only, not push steps. ([Novu step conditions](https://docs.novu.co/platform/workflow/add-and-configure-steps/step-conditions))

### Knock

- Free up to 10k messages/mo. Starter costs $250/mo. ([Knock pricing](https://knock.app/pricing))
- No web push. Its push providers are APNs, FCM, Expo, Amazon SNS and OneSignal. ([Knock push](https://docs.knock.app/integrations/push/overview))
- Delay steps last up to 365 days, and reminders are cancelled through the cancellation API. ([Knock delay](https://docs.knock.app/designing-workflows/delay-function))
- We found no EU data residency in Knock's docs. Knock states GDPR compliance and has a DPA. ([Knock DPA](https://knock.app/legal/data-processing-addendum))
- It costs the most and needs a second provider for our main channel, so it is a poor fit.

### Customer.io

- No free plan. Essentials starts at $100/mo with 5k profiles. "Web push is free on every plan". ([Customer.io pricing](https://customer.io/pricing))
- An EU data center in Belgium is chosen at signup and cannot be migrated later. ([Customer.io data centers](https://docs.customer.io/data-centers/))
- Native web push uses Customer.io-generated VAPID keys and their service worker, but it is in **alpha** and limited to one site per workspace. ([Customer.io web push](https://docs.customer.io/messaging/channels/web-push/overview.md))
- Fallback means building workflow branches. It is a marketing-automation platform, which is heavy for our needs.

## Recommendation

Use **self-hosted**: VAPID and `web-push`, subscriptions in our SQLite, an in-process scheduler, and an EU transactional email API, with Brevo first.

Why:

- Our fallback rule is a pre-send routing check, so the SaaS "wait-then-fallback" engines solve a problem we don't have.
- It is free at our scale.
- Push subscription data and Student and course data stay on our server. Only email addresses go to the email processor.
- The single long-lived Node process makes a simple polling scheduler practical.

**Runner-up: OneSignal free.** It has EU primary data centers, free web push and 10k emails, built-in delivered and clicked tracking, and Journeys if we later want real "push not clicked → email" fallback. The costs are third-party SDK lock-in, an ID sync, and an unclear DPA position on the free tier.

Rule out:

- **Knock**: no web push, $250/mo.
- **Customer.io**: no free tier, web push in alpha.
- **Novu**: needs a separate web-push provider anyway, and caps delays at 1 day on Free.

## Open questions for the grilling ticket

- Do we need delivery-confirmed fallback ("push not clicked within N hours → email"), or is "no subscription → email" enough? If the former, OneSignal becomes more attractive.
- Is "accepted by the push service" plus our own click tracking enough as delivery tracking?
- Check Brevo's DPA and hosting location, or choose another EU-hosted email API, before committing.
- iOS Safari only supports web push for home-screen web apps. Expect many Students to fall back to email. (Not researched here.)
