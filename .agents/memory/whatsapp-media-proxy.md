---
name: WhatsApp media proxy range support
description: Why the admin media proxy must answer HTTP Range requests, and how video/audio playback breaks on Safari/iOS without it.
---

The admin WhatsApp media proxy (`/api/admin/whatsapp/media/:mediaId`) streams
customer-sent media by downloading the whole file from Meta into a Buffer and
serving it. It backs the `<video>`/`<audio>` bubbles in the admin conversation
view.

**Rule:** any endpoint that feeds a browser `<video>` or `<audio>` element MUST
answer byte-range requests — set `Accept-Ranges: bytes`, and when a `Range`
header is present reply `206 Partial Content` with `Content-Range` +
`Content-Length` and the sliced bytes (handle suffix `bytes=-N` = last N bytes;
`416` for unsatisfiable). Plain `res.send(buf)` with only `200` is not enough.

**Why:** Safari/iOS refuses to play OR download a media element unless the
server supports range requests. The TMG admins use iPhones, so a 200-only proxy
silently shows the first frame but never plays/downloads. Symptom reported as
"video admin can't download."

**How to apply:** Force-download (save to device) is a separate concern — gate
`Content-Disposition: attachment` behind a `?download=1` query so inline
playback still works without it. Media is buffered fully in memory before
slicing (acceptable for WhatsApp-sized clips); revisit if large files appear.
