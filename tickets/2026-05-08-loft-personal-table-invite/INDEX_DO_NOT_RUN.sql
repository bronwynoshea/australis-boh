Loft Personal Table invite ticket SQL prepared on 2026-05-08.

Run order:

1. 01_CREATE_T-0295_LOFT_PERSONAL_TABLE_INVITE.sql
2. 02_COMMENT_T-0295_LOFT_PERSONAL_TABLE_INVITE_DONE.sql
3. 03_VERIFY_T-0295_LOFT_PERSONAL_TABLE_INVITE.sql
4. 04_ASSIGN_T-0295_EXTERNAL_MINOR_RELEASE.sql
5. 05_VERIFY_T-0295_EXTERNAL_MINOR_RELEASE.sql
6. 06_COMMENT_T-0295_PERSONAL_TABLE_LIVE_QA_FIXES.sql
7. 07_VERIFY_T-0295_PERSONAL_TABLE_LIVE_QA_FIXES.sql

Notes:
- Next BOH Counter ticket number supplied by user on 2026-05-08: T-0295.
- 01 creates T-0295 for the completed Loft Personal Table invite workflow polish.
- 02 adds an idempotent completion comment for release allocation.
- 03 verifies the ticket and completion comment.
- 04 assigns T-0295 to the current external minor release: Lapsang Souchong 3.2.0 external.
- 05 verifies the release assignment and idempotent allocation comment.
- 06 adds the 2026-05-22 Personal Table live QA fixes comment.
- 07 verifies the live QA fixes comment.
