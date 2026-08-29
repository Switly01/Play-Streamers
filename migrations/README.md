# Play Streamers D1 migrations

Apply the files in this folder in ascending order in the Cloudflare D1 console
before deploying a Worker release that depends on them. The Worker includes a
temporary compatibility bootstrap for existing installations; do not remove it
until every environment has received the migrations.

`0004_donate_bridge.sql` adds one-time desktop pairing codes, revocable device
credentials and deduplicated donate events. Apply it before publishing the
matching Worker and Donate Bridge download.

`0005_account_devices.sql` adds the account device/session history used by the
Hesabım → Cihazlar screen. Apply it after `0004_donate_bridge.sql` and before
publishing the current Worker.

`0006_donate_provider_webhooks.sql` adds the per-account, revocable webhook
connections used by platforms that can deliver donate events directly to the
Worker without an open browser tab. Apply it after `0005_account_devices.sql`.

`0009_kick_metric_hourly.sql` adds hourly Kick follower/subscriber snapshots
used by the daily columns and the 24-hour detail view. Apply it after the
existing `0008_kick_metric_snapshots.sql` migration.

`0010_desktop_platform.sql` connects local accounts to SW Identity and adds
the shared entitlement, feature-setting, stream-summary and AI-insight tables
used by the Play Streamers desktop application. Apply it after `0009` and
before enabling desktop SW Identity exchange routes.

`0011_automatic_stream_sessions.sql` adds the account monitor cursor, active
Kick stream runtime and minute-level viewer samples. The scheduled Worker uses
these tables to open and close stream summaries while the site, desktop app
and browser extension are closed. Apply it after `0010` and before Worker 5.0.

`0013_sw_bot_issue_reports.sql` stores deterministic SW Bot explanations by
issue hash. Apply it after `0012`; Worker 6.4 also creates the table lazily for
safe rollout compatibility.
