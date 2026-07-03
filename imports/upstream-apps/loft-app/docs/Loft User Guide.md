# Loft User Guide

Last updated: 2026-05-06

This is the lightweight user walkthrough for JOBZCAFE® Loft. Internal release status, implementation caveats, Edge Function notes, environment variables, and open gaps live in `docs/Loft Demo Readiness Notes.md`.

## Loft URL

Use the correct Loft link for the environment being tested:

- Local testing: `http://localhost:8081`
- Dev testing: `http://localhost:5189/apps/loft`
- Production testing: `https://boh.australis.cloud/apps/loft`

Loft is a BOH-native app route, not a standalone JOBZCAFE® app hostname.

## Test Accounts

Use the nominated host/admin account:

- `boshea@jobzcafe.com`

Use separate guest browser sessions or invite links when testing guest access to a Personal Table.

## First-Time Member Flow

Goal: confirm a JOBZCAFE® member can sign in and reach a useful Loft starting point.

1. Open the correct Loft URL.
2. Sign in with the member account.
3. Confirm the Lobby loads.
4. Confirm live sessions and available tables are visible.
5. Open the profile/account control.
6. Confirm desktop opens a full-height side drawer and mobile opens a bottom sheet.

What to look for:

- Does the member understand where to go next?
- Does any message mention the wrong domain or wrong app?
- Does the app avoid confusing stale-session or backend fallback messages?

## Main Session Walkthrough

Goal: confirm a host can lead a live Loft session without layout or access issues.

1. Open the Lobby.
2. Select a live session.
3. Join as the host.
4. Confirm the host appears in the stage area.
5. Confirm the participant cards are readable and centered on desktop.
6. On a laptop-height screen, confirm there is one participant row with hidden horizontal scrolling.
7. Confirm the transport bar sits below the participant rail and does not cover cards.
8. Open chat.
9. Raise and lower a hand from a second participant where available.
10. Promote a participant to lead the chat where available.
11. Confirm speaking controls appear only for roles that can use them.
12. End or leave the table using the transport bar.

What to look for:

- Does the stage card feel professional?
- Is the host name readable?
- Are cards centered on full desktop?
- Does laptop-height layout protect the transport bar?
- Is scrolling available without showing an ugly browser scrollbar?

## Personal Table Host Flow

Goal: confirm a host can open a Personal Table and admit guests.

1. Sign in as the host.
2. Open the Personal Table from the Lobby or account area.
3. Copy the guest invite link.
4. Open the invite link in a separate browser/session.
5. Submit a guest access request.
6. Return to the host view.
7. Confirm the waiting guest appears.
8. Admit the guest.
9. Confirm the guest enters without needing a confusing refresh.
10. Dismiss or clear waiting guests where appropriate.

What to look for:

- Is the host/member route clearly separate from the guest invite link?
- Does the guest waiting screen explain what is happening?
- Does the host have enough control without the interface feeling crowded?

## Personal Table Recording Flow

Goal: confirm recording is host-controlled and honest about failures.

1. Join a Personal Table as the host.
2. Start recording.
3. Confirm the UI reflects the recording state.
4. Stop recording.
5. Confirm the UI returns to the non-recording state.

What to look for:

- Does the host understand whether recording actually started?
- Does a failure show a clear message instead of pretending recording is active?
- Are participants told when a table or session is being recorded?

## Background Effects Flow

Goal: confirm blur and built-in backgrounds work where Daily video processing is supported.

1. Join a session or Personal Table with camera enabled.
2. Open Settings.
3. Open Effects.
4. Choose Blur.
5. Choose one of the built-in JOBZCAFE® Loft backgrounds.
6. Choose No background.
7. Repeat on a smaller browser window or mobile browser.

What to look for:

- Does the live participant card match the selected effect?
- Does the settings preview match the live video state?
- If effects are unsupported, does Loft clearly say so?
- Does the app avoid silently applying a fake effect?

## Screen Sharing Flow

Goal: confirm screen sharing uses the browser’s native picker and feels safe.

1. Join as the host or as a promoted participant with screen-share access.
2. Select screen share from the transport bar.
3. Use the browser picker to select a window or tab.
4. Confirm the shared content appears in the session.
5. Stop sharing.

Guidance for testers:

- Window is best for sharing one application.
- Tab is best for sharing one browser tab.
- Entire screen can expose more than intended and should be used only when necessary.

What to look for:

- Does the browser picker appear?
- Does the session make it obvious that sharing is active?
- Can the user stop sharing cleanly?

## Chat Flow

Goal: confirm chat feels suitable for live session coordination.

1. Open chat from the transport bar.
2. Send a message as the host.
3. Send a message as another participant.
4. Check timestamps, message order, empty states, and error states.
5. Check mobile drawer behavior.

What to look for:

- Is the chat readable?
- Are privacy expectations clear?
- Are errors visible without being alarming?
- Does chat preserve the Loft visual theme?

## Key Use Cases

### Lobby

1. Open the Lobby.
2. Check live sessions.
3. Check Personal Table access.
4. Open profile/account.

Look for whether the Lobby is a calm, useful starting point.

### Session

1. Join a live session.
2. Review stage, participant rail, and transport bar.
3. Test laptop-height and full desktop layouts.

Look for whether the visual hierarchy is clear and the layout avoids overlap.

### Personal Table

1. Open the host Personal Table.
2. Invite a guest.
3. Admit the guest.
4. End the table.

Look for whether the guest flow feels controlled and understandable.

### Settings

1. Open settings.
2. Review device controls.
3. Review Effects.
4. Return to the session.

Look for whether settings feel focused rather than interrupting the live session.

## Known Caveats For Testers

- Some browser/device combinations do not support Daily video background processing.
- Mobile browsers may not support all effects.
- Background preview and live video state still need final cross-device validation.
- Screen sharing depends on browser permissions and may not be available on every device.
- Full production promotion has not been completed from this staging pass.
- If a configuration or access issue appears, Loft should show it clearly rather than falling back silently.

## Feedback Questions

- What confused you in the first five minutes?
- Did the Lobby make it clear what to do next?
- Did the session stage and participant cards feel professional?
- Did the laptop-height layout keep the transport bar out of the way?
- Did scrolling feel available without looking messy?
- Did the Personal Table guest flow make sense?
- Did recording feel trustworthy?
- Did background effects either work or explain why they were unavailable?
- Did chat feel suitable for a live JOBZCAFE® session?
