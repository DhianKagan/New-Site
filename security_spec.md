# Firestore Security Specification (`product_reviews` & `admins`)

## 1. Data Invariants
1. **Verified Authorship**: Only authenticated users with `request.auth.token.email_verified == true` may create, update, or delete reviews, and `authorUid` must strictly equal `request.auth.uid` on creation.
2. **Zero PII Exposure**: `product_reviews` documents never contain `email`, `phone`, `address`, or other personally identifiable information; strict `hasAll` + `hasOnly` allowlists block shadow/ghost fields.
3. **Immutable Ownership & Product Binding**: `productId`, `authorUid`, and `createdAt` are immutable after creation; `createdAt` (on create) and `updatedAt` (on create/update) must equal `request.time`.
4. **Volumetric & Type Safety**: `rating` must be an integer `1..5`; `authorName` is bounded to `2..80` chars; `comment` is bounded to `3..1000` chars; all document and reference IDs match `^[a-zA-Z0-9_\-]+$` (`1..128` chars).
5. **Terminal Moderation Lock & Secure List Queries**: `allow list` explicitly restricts public listing to `resource.data.status == 'published'` without `get()`/`exists()` calls; if an admin sets `status` to `'hidden'`, non-admin authors can no longer update the hidden document.
6. **Trusted Admin Boundaries**: `/admins/{adminId}` is never writable or listable from client SDKs; admin email checks require `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Create**: Anonymous caller (`request.auth == null`) submits a valid `product_reviews` payload -> MUST reject (`PERMISSION_DENIED`).
2. **Unverified Email Spoof**: Caller claims admin email `dzendeco25@gmail.com` with `email_verified: false` -> MUST reject (`PERMISSION_DENIED`).
3. **Identity Spoofing**: User A (`uid: "userA"`) creates a review with `authorUid: "userB"` -> MUST reject (`PERMISSION_DENIED`).
4. **Shadow / Ghost Field Injection**: User submits all valid fields plus `{ isVerified: true }` or `{ email: "leak@example.com" }` -> MUST reject (`PERMISSION_DENIED`).
5. **Float / Out-of-Range Rating**: User submits `rating: 4.5`, `rating: 0`, or `rating: 6` -> MUST reject (`PERMISSION_DENIED`).
6. **Comment Payload Bomb (Denial of Wallet)**: User submits `comment` of 1500 characters (`> 1000`) -> MUST reject (`PERMISSION_DENIED`).
7. **ID Poisoning**: User creates document at `/product_reviews/invalid$id/extra` or 200-char ID -> MUST reject (`PERMISSION_DENIED`).
8. **Client Timestamp Forgery**: User submits `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> MUST reject (`PERMISSION_DENIED`).
9. **Cross-Author Update Hijack**: User B attempts to update `comment` or `rating` on User A's review -> MUST reject (`PERMISSION_DENIED`).
10. **Immutable Field Tampering**: Author attempts to change `productId` or `createdAt` during an update -> MUST reject (`PERMISSION_DENIED`).
11. **Non-Admin Moderation / Status Tampering**: Author attempts to set `status: "hidden"` or edit a review already marked `hidden` -> MUST reject (`PERMISSION_DENIED`).
12. **Unfiltered / Blanket List Query or Admin Self-Promotion**: Client queries `product_reviews` without `status == 'published'` constraint, or attempts to write `/admins/{uid}` -> MUST reject (`PERMISSION_DENIED`).
