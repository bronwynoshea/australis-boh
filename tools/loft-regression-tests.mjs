import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const checks = [];

function check(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
}

const externalRoomPage = read('src/apps/loft/pages/ExternalInterviewRoomPage.tsx');
check('external interview listener payload is stored in guest localStorage mode', externalRoomPage.includes('storeExternalRoomPayload') && externalRoomPage.includes("localStorage.setItem('isPersonalRoomGuest', 'true')") && externalRoomPage.includes("localStorage.setItem('loft_approval_status', 'approved')"));
check('external interview host payload clears guest storage and uses sessionStorage', externalRoomPage.includes("sessionStorage.setItem('personalRoomIsHost', 'true')") && externalRoomPage.includes('clearExternalGuestStorage'));

const personalRoomPage = read('imports/upstream-apps/loft-app/src/components/Loft/PersonalRoomPage/index.tsx');
check('guest leave beacon includes leave token', personalRoomPage.includes('personalRoomLeaveToken') && personalRoomPage.includes('leaveToken') && personalRoomPage.includes('navigator.sendBeacon'));
check('guest explicit leave sends leave token', personalRoomPage.includes("leaveToken: localStorage.getItem('personalRoomLeaveToken')"));

const joinBySlug = read('supabase/functions/loft-join-personal-room-by-slug/index.ts');
check('public guest join response returns leave token', joinBySlug.includes('createLeaveToken') && joinBySlug.includes('leaveToken'));

const externalJoinToken = read('supabase/functions/loft-external-join-token/index.ts');
check('external join token response returns leave token for non-hosts', externalJoinToken.includes('createLeaveToken') && externalJoinToken.includes('leaveToken: role ==='));

const leaveStatus = read('supabase/functions/loft-update-guest-leave-status/index.ts');
check('guest leave cleanup requires auth or leave token', leaveStatus.includes('verifyLeaveToken') && leaveStatus.includes('leave_token_required'));

const joinToken = read('supabase/functions/loft-join-token/index.ts');
check('BOH join token resolves actual host details', joinToken.includes('resolveHostDetails') && joinToken.includes('isHost: isOwner'));

const failed = checks.filter((item) => !item.condition);
if (failed.length) {
  console.error('Loft regression checks failed:');
  for (const item of failed) console.error(`- ${item.name}`);
  process.exit(1);
}

console.log(`Loft regression checks passed (${checks.length}).`);
