Loft session/table ticket SQL prepared on 2026-05-06.

Run order:

1. 01_COMMENT_EXISTING_LOFT_TICKETS.sql
2. 02_CREATE_T-0294_LOFT_SESSION_LAYOUT_CORS.sql
3. 03_VERIFY_LOFT_SESSION_LAYOUT_CORS.sql

Notes:
- Live BOH Counter next ticket number supplied on 2026-05-06: T-0294.
- 01 adds idempotent progress comments to existing broad Loft tickets.
- 02 creates T-0294 for the specific Loft session/table CORS and responsive layout hardening track.
- 03 verifies the new ticket and comments.
