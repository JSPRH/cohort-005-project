# Send Nudges ourselves, from an in-process poller that works out who's due each run

Cadence sends Nudges itself: web push through VAPID and the `web-push` library, and email through our own SMTP server on our own domain. A poller inside the one server process runs every 15 minutes and works out from current state which Students are due a Nudge right now, rather than queueing future Nudges. The Channel rule (active push subscription, else email) is one `if`, so a notification SaaS would add lock-in and a data processor without doing anything we need. Caps, priority, Quiet Hours, pausing and Ignored Nudges all change between the time a Nudge would be queued and the time it's due, so queued Nudges would go stale.

## Considered Options

- **OneSignal free.** Rejected: SDK lock-in and ID syncing, for a push-to-email fallback rule we don't use.
- **Novu, Knock, Customer.io.** Rejected: no native web push, or no free tier.
- **External cron hitting an endpoint, or a separate worker process.** Rejected: extra infrastructure, and a second process against the one SQLite file (ADR 0006).
- **Queued "scheduled Nudge" rows.** Rejected: every change in a Student's state would have to cancel or move them.

## Consequences

The app starts from a small custom server entry instead of `react-router-serve`, so the poller has somewhere to start. No delivery or click data comes from a provider; we record what we need ourselves. Our own SMTP server gives no bounce webhooks: v1 acts only on permanent rejections at send time. The domain needs SPF, DKIM and DMARC before launch.
