# Slack Integration Decision Note

## Recommendation

Use an **official Slack app with Incoming Webhooks** for the MVP.

This is the simplest path with the fewest moving parts for this repo because it lets us post reporting summaries and alert messages with a single secret webhook URL and a plain HTTP `POST`.

No third-party tool is needed.

## Are Incoming Webhooks enough for the MVP?

Yes, for the current MVP scope they are enough.

They cover:
- posting reporting summaries
- posting alert messages
- sending Block Kit formatted messages

They are a good fit because our current Slack requirement is **one-way outbound messaging** from the app into Slack.

Known limitations from Slack's official docs:
- webhook messages are tied to the app webhook configuration
- they do **not** allow deleting a posted message
- if we later need more complex chat flows, Slack recommends `chat.postMessage`

That means:
- for `reporting + alerts`, use incoming webhooks
- for `editable messages`, `thread-heavy workflows`, or broader bot behavior later, add a bot token flow with `chat.postMessage`

## Required setup

1. Create a Slack app in the target workspace.
2. Enable **Incoming Webhooks** in the app settings.
3. Click **Add New Webhook to Workspace**.
4. Pick the channel for MVP reporting/alerts.
5. Store the generated webhook URL as a secret in the app environment.
6. Send JSON payloads to that URL from the backend.

Minimal example payload:

```json
{
  "text": "Meta Ads daily summary: spend stable, CPA above target on 2 ad sets."
}
```

## Third-party tools

No external integration platform is required.

We should call Slack directly from our backend using:
- the webhook URL for MVP
- standard HTTPS requests

This keeps the architecture cleaner and reduces break points.

## Practical repo decision

For this repo:
- start with **Slack app + Incoming Webhook**
- do **not** add Zapier, Make, n8n, or other middleware
- keep Slack as a direct backend integration
- defer bot-token-based Slack API usage until we need capabilities webhooks do not provide

## Upgrade path

If the product later needs:
- dynamic channel selection at runtime
- message deletion or updates
- richer threaded workflows
- broader workspace interactions

then move to an official Slack app using a bot token and `chat.postMessage` with `chat:write`.

## Sources

- Slack official docs, Incoming Webhooks: https://api.slack.com/messaging/webhooks
- Slack official docs, `incoming-webhook` scope: https://api.slack.com/scopes/incoming-webhook
- Slack official docs, `chat.postMessage`: https://api.slack.com/methods/chat.postMessage
