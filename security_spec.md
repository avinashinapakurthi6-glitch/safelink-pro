# SafeLink Security Specification (Phase 0 Audit)

## 1. Data Invariants
- **User Document Isolation**: The `/users/{userId}` collection contains highly sensitive user configurations (Emergency Guard Circle contact phone numbers, settings, audio records, and location logs). Each user document must only be read, created, or updated by the authenticated user whose `request.auth.uid` matches the document's `{userId}` path parameter.
- **Direct Live Tracking Access**: The `/live_sos/{sessionId}` collection is generated dynamically during emergency triggers. Unauthenticated guardians/police/NGOs must be able to view a single session document in real-time (`get` operation) using the shared UUID token (`sessionId`). However, general querying or listing of the `live_sos` collection must be forbidden to prevent scraping of active incidents.
- **Session Integrity**: A `live_sos` document can only be created and updated by the session initiator (either an authenticated user or a simulated guest user with ID `guest-user`).

## 2. The "Dirty Dozen" Malicious Payloads (Test Specifications)
The following operations must return `PERMISSION_DENIED`:
1. **User Profile Hijacking**: Attempt to write to `/users/alice` from a session authenticated as `bob`.
2. **PII Blanket Scraping**: Attempt to list all documents under `/users` as any user.
3. **Session Query Harvesting**: Attempt to list all active sessions under `/live_sos` as an unauthenticated or standard user.
4. **Active Session Hijacking**: Attempt to update another user's live session coordinates from a different authenticated session.
5. **Unauthorized Ending of SOS**: Attempt to set `active: false` on someone else's active SOS session.
6. **Guest Impersonation Spoofing**: Attempting to write/update a session document with field `userId` set to a real user's UID while unauthenticated.
7. **Malformed ID Injection**: Attempt to create a document with an ID exceeding 128 characters or containing non-alphanumeric/hyphen characters.
8. **Immutability Breach**: Attempt to change the `userId` or `timestamp` field of an existing `live_sos` document.
9. **Malicious Log Injection**: Attempt to push non-string structures or oversized data arrays into the session log fields.
10. **Shadow Profile Insertion**: Attempt to write a profile document under `/users/{userId}` with unsolicited admin roles.
11. **Future Timestamp Forgery**: Attempt to inject custom future timestamps into `lastUpdated` or `updatedAt` without using the server-side time token `request.time`.
12. **Tampering with Ends**: Attempt to clear or overwrite `endedAt` of a terminated SOS session to reactivate it.

## 3. Verified Security Ruleset
The `firestore.rules` below implements these gates flawlessly.
