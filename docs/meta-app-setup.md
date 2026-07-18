# meta app setup — your click-by-click runbook

this is everything YOU do on Meta's side while the agent builds the code. no
step here assumes prior knowledge. do sections 1–7 now, in order. section 8
(business verification) can also be started now — it runs on its own clock.
section 9 (app review) is LAST — wait until the agent confirms the flow is
live in production.

> **golden rule: secrets never go through chat.** the app secret and your GST
> documents go directly into Meta's or Vercel's dashboards. if the agent ever
> appears to ask for a secret value in chat, refuse — it never needs one.

---

## 1. get a meta developer account (~5 min)

1. go to https://developers.facebook.com in your browser.
2. log in with your normal personal Facebook account (the one that has — or
   will have — access to ad accounts you want to test with).
3. if you've never used the developer site: it asks you to "Register as a
   developer". accept, verify with the code it sends, choose any role
   (e.g. "developer").

## 2. create the app (~10 min)

1. from https://developers.facebook.com → top-right **My Apps** → **Create App**.
2. it asks what your app does / use case. choose **Other** (or the closest to
   "manage business integrations" — Meta renames these options often; the key
   thing is the NEXT screen).
3. **app type: choose "Business".** this is the important choice — the ads
   permissions only exist on business-type apps.
4. app name: `Metis AI`. contact email: your real email. business portfolio:
   leave empty for now if it asks (section 8 connects it).
5. click create. you land on the app dashboard. **copy the App ID shown at
   the top — you'll need it in section 6.**

## 3. add "facebook login for business" to the app (~5 min)

1. on the app dashboard, find the product list ("Add products to your app").
2. locate **Facebook Login for Business** → click **Set up**.
   (if you only see "Facebook Login", your app is not Business type — go back
   and re-check step 2.3.)
3. in the left sidebar there is now a **Facebook Login for Business** section.
   open its **Settings** page and set:
   - **Client OAuth login:** ON
   - **Web OAuth login:** ON
   - **Enforce HTTPS:** ON
   - **Valid OAuth Redirect URIs:** paste exactly:
     `https://metis-ai-nine.vercel.app/api/meta/oauth/callback`
   - leave everything else at its default. save.

## 4. create a configuration (~5 min)

a "configuration" tells Meta exactly what your app asks users for.

1. left sidebar → **Facebook Login for Business** → **Configurations**.
2. **Create configuration**:
   - name: `Metis reporting (read-only)`
   - login variation / token type: **User access token**
   - permissions: tick **ads_read** only. nothing else.
3. save. **copy the Configuration ID** it shows — needed in section 6.

## 5. app settings → basic (~5 min)

left sidebar → **App settings** → **Basic**:

- **App domains:** `metis-ai-nine.vercel.app`
- **Privacy policy URL:** `https://metis-ai-nine.vercel.app/privacy`
- **Terms of service URL:** `https://metis-ai-nine.vercel.app/terms`
- **User data deletion:** choose "Data deletion callback URL" and paste:
  `https://metis-ai-nine.vercel.app/api/meta/data-deletion`
- **Category:** Business and pages
- **App icon** (1024×1024) if it demands one for review later — any clean
  square logo works.
- note the **App secret** field here (click Show). you'll paste it into
  Vercel next. **never paste it anywhere else.**

> the privacy/terms/data-deletion URLs will 404 until the agent's next deploy
> — that's fine, Meta doesn't check them at save time. they must be live
> before section 9.

## 6. put four values into vercel (~5 min)

1. go to https://vercel.com → your `metis-ai` project → **Settings** →
   **Environment Variables**.
2. add each variable below. for EACH one, tick all three environments
   (Production, Preview, Development) before saving:

| name | value |
|---|---|
| `META_APP_ID` | the App ID from section 2.5 |
| `META_APP_SECRET` | the App secret from section 5 (click Show, copy) |
| `META_OAUTH_REDIRECT_URI` | `https://metis-ai-nine.vercel.app/api/meta/oauth/callback` |
| `META_LOGIN_CONFIG_ID` | the Configuration ID from section 4.3 |

3. tell the agent "vercel envs are in" — values only take effect on the next
   deploy, which the agent will ask you to approve anyway.

## 7. add yourself (and any testers) with app roles (~3 min)

until Meta approves the app (section 9), ONLY people with a role on the app
can use the Connect button. that's expected, not a bug.

1. left sidebar → **App roles** → **Roles** → **Add people**.
2. you are already admin. add any friendly testers as **Testers** (they get
   an invite they must accept at developers.facebook.com → their profile →
   requests).
3. make sure the Facebook account you'll click-test with has access to at
   least one ad account (any personal ad account counts — even one that has
   never run an ad usually exists at https://adsmanager.facebook.com).

## 8. business verification — start now, runs in parallel (days to ~2 weeks)

Meta verifies you're a real business. India + GST works. the legal name on
the documents must EXACTLY match the business name you register with Meta.

1. go to https://business.facebook.com — create a **business portfolio** if
   you don't have one. business name = your GST-registered legal name,
   exactly as printed on the certificate.
2. connect the app to this portfolio: app dashboard → **App settings** →
   **Basic** → scroll to the business-portfolio / verification section →
   connect your portfolio.
3. in https://business.facebook.com → **Settings** → **Security Centre** →
   **Business verification** → Start.
4. India-accepted documents (upload directly there — never through chat):
   - GST registration certificate (primary; name + address must match)
   - if asked for more: utility bill, bank statement, or certificate of
     incorporation, again matching the legal name/address.
5. status shows in Security Centre. typical: 2 days–2 weeks. rejections are
   almost always name/address mismatches — fix and resubmit.

## 9. app review — LAST, only after the agent says "flow is live" (~30 min)

wait for the agent to confirm: OAuth flow deployed + you click-tested it +
privacy/terms/data-deletion pages live. then:

1. app dashboard → left sidebar → **App review** → **Permissions and
   features**.
2. find **ads_read** → **Request advanced access**.
3. it asks how the permission is used. paste this (edit freely):

   > Metis AI generates plain-language performance reports for advertisers
   > from their own Meta ad accounts. A signed-in user clicks "Connect with
   > Meta", approves read-only access via Facebook Login for Business, and
   > Metis then reads ad insights (spend, impressions, clicks, CTR) and the
   > account's change history to write a summary report in the user's own
   > writing style. We request only ads_read. The app never creates, edits,
   > or pauses ads, never spends, and never posts. Tokens are stored
   > encrypted (AES-256-GCM) and are deletable by the user in-app, and via
   > the data deletion callback.

4. reviewer test instructions — paste and adapt:

   > 1. Go to https://metis-ai-nine.vercel.app/signup and create an account
   >    (email + password, instant).
   > 2. In the app, open Connections → click "Connect with Meta" → approve
   >    the read-only request with any Facebook account that has ad-account
   >    access.
   > 3. You land back in Reports with the connection selected. Pick an
   >    account and date range → Generate report → a written performance
   >    report appears. No write actions exist anywhere in the product.

5. submit. as of Meta's May 2026 changes, screen recordings are no longer
   required, and requirements show directly in the dashboard.
6. while waiting: keep using the product yourself — the "full access" tier
   for the Marketing API wants to see ≥500 API calls in a rolling 15 days
   with a low error rate, and your own dev-mode usage counts.

## common failure modes (so you don't panic)

- **"URL blocked" during connect-test** → the redirect URI in section 3.3
  doesn't EXACTLY match (https, no trailing slash). fix there.
- **"App not active" for a tester** → they haven't accepted the tester
  invite, or the app is in a mode their role can't access.
- **connect works for you but not a stranger** → correct! strangers need
  section 9 approval first.
- **business verification rejected** → name/address mismatch between GST
  cert and the business portfolio name. edit the portfolio name to match the
  certificate exactly, resubmit.
