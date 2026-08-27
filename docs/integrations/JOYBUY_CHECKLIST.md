# Joybuy launch checklist

Track progress from Pending Review through production.

## Application & credentials

- [ ] Joybuy app approved
- [ ] AppKey received
- [ ] AppSecret configured server-side (`JOYBUY_APP_SECRET` — never in Git / client)
- [ ] Access token flow configured (`JOYBUY_ACCESS_TOKEN` or OAuth refresh)
- [ ] Official API base URL confirmed (`JOYBUY_API_BASE_URL`)
- [ ] Authentication / request signing flow confirmed and implemented

## Official APIs confirmed

- [ ] Product API confirmed
- [ ] SKU API confirmed
- [ ] Image/media API confirmed
- [ ] Inventory API confirmed
- [ ] Price API confirmed
- [ ] Order API confirmed
- [ ] Fulfilment API confirmed
- [ ] Webhook/message API confirmed

## Thomas OS wiring

- [ ] Callback URL configured (`/api/integrations/joybuy/callback`)
- [ ] Migration `0013_channel_connections.sql` applied
- [ ] Channel connection status updated (never claim connected while Pending Review)
- [ ] Unit tests still green (`npm test` in `web/`)

## End-to-end validation

- [ ] Test product synced
- [ ] Test inventory synced
- [ ] Test order imported into Thomas OS
- [ ] Test fulfilment / shipment update completed
- [ ] Production authorization completed
- [ ] Application published
