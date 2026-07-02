# Personal Room Waitlist System - Implementation Guide

## 🎯 Overview
Complete waitlist and access control system for Personal Rooms with:
- ✅ Vanity URL access control
- ✅ Guest waitlist management
- ✅ Host approval sidebar
- ✅ Recording controls
- ✅ Real-time status updates

## 📁 Files Created

### Frontend Components
- `PersonalRoomLandingPage_NEW.tsx` - Complete landing page with access control
- `PersonalRoomHeader_UPDATED.tsx` - Header with recording + sidebar buttons
- `PersonalRoomAdmissionSidebar.tsx` - Host approval management sidebar

### Edge Functions (Supabase)
- `loft-get-personal-room-access/` - Get room details + access status
- `loft-get-personal-room-waitlist/` - Fetch waitlist for host
- `loft-approve-waitlist-entry/` - Approve guest request
- `loft-reject-waitlist-entry/` - Reject guest request
- `loft-toggle-recording/` - Start/stop recording
- `loft-request-personal-room-access/` - Already created

### Database
- `waitlist-schema.sql` - Complete database schema

## 🚀 Implementation Steps

### 1. Database Setup
```bash
# Run the schema file in your Supabase SQL editor
psql -f database/waitlist-schema.sql
```

### 2. Deploy Edge Functions
```bash
# Deploy all edge functions
supabase functions deploy loft-get-personal-room-access
supabase functions deploy loft-get-personal-room-waitlist
supabase functions deploy loft-approve-waitlist-entry
supabase functions deploy loft-reject-waitlist-entry
supabase functions deploy loft-toggle-recording
```

### 3. Update Components
Replace existing components with the new versions:

```typescript
// In PersonalRoomPage/index.tsx
import PersonalRoomLandingPage from './components/PersonalRoomLandingPage_NEW';
import PersonalRoomHeader from './components/PersonalRoomHeader_UPDATED';
import PersonalRoomAdmissionSidebar from './components/PersonalRoomAdmissionSidebar';
```

### 4. Wire Up Sidebar in PersonalRoomPage
```typescript
// Add to PersonalRoomPage state
const [isSidebarOpen, setIsSidebarOpen] = useState(false);

// Add to PersonalRoomPage render
<PersonalRoomAdmissionSidebar
  isOpen={isSidebarOpen}
  onClose={() => setIsSidebarOpen(false)}
  roomId={roomId}
  isHost={isCurrentUserHost}
/>

// Update PersonalRoomHeader props
<PersonalRoomHeader
  // ... existing props
  isHost={isCurrentUserHost}
  onOpenSidebar={() => setIsSidebarOpen(true)}
  onToggleRecording={handleToggleRecording}
/>
```

### 5. Add Recording Control
```typescript
// Add to PersonalRoomPage
const handleToggleRecording = async () => {
  try {
    await callEdgeFunction('loft-toggle-recording', {
      roomId,
      isRecording: !isRecording,
      userId: profile?.id
    });
    setIsRecording(!isRecording);
  } catch (error) {
    console.error('Failed to toggle recording:', error);
  }
};
```

## 🎯 User Flow

### Guest Experience
1. **Visit vanity URL** → `/personal/john-doe-room`
2. **See access status** → Open room or "Request Access"
3. **Enter name** → Submit request
4. **Wait for approval** → See pending status
5. **Get approved** → Auto-redirect to room

### Host Experience
1. **Open sidebar** → Click users icon in header
2. **See requests** → Pending/Approved/Rejected tabs
3. **Approve/reject** → One-click actions
4. **Control recording** → Toggle button in header
5. **Manage room** → Settings + access control

## 🔧 Configuration

### Room Access Modes
- **`open`** - Anyone can join directly
- **`host-approval`** - Guests must be approved (default)
- **`scheduled`** - Time-based access (future feature)

### Waitlist Status
- **`pending`** - Waiting for host approval
- **`approved`** - Can join the room
- **`rejected`** - Denied access

## 🎨 Styling Notes

All components use existing Tailwind classes:
- `loft-card` - Main card styling
- `text-cafe` - Primary brand color
- `bg-slate-900` - Dark sidebar background
- Consistent with existing Loft design system

## 🧪 Testing

### Test Guest Flow
```typescript
// Test waitlist request
const response = await callEdgeFunction('request_personal_room_access', {
  slug: 'test-room',
  guestName: 'Test Guest'
});
```

### Test Host Controls
```typescript
// Test waitlist fetch
const waitlist = await callEdgeFunction('get_personal_room_waitlist', {
  personalRoomId: 'room-uuid'
});

// Test approval
await callEdgeFunction('approve_waitlist_entry', {
  waitlistEntryId: 'entry-uuid'
});
```

## 🚨 Important Notes

1. **Replace existing files** - Don't just add new ones
2. **Database schema first** - Run SQL before testing
3. **Edge functions must be deployed** - Test after deployment
4. **RLS policies** - Ensure proper permissions in Supabase
5. **Real-time updates** - Consider adding WebSocket for live updates

## 🎯 Next Steps

1. **Deploy database schema**
2. **Deploy edge functions**
3. **Update components**
4. **Test full flow**
5. **Add real-time notifications** (optional)
6. **Add email notifications** (optional)

This gives you a production-grade waitlist system that's far superior to time-based tokens! 🎉
