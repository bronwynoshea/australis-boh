# Loft Authentication System Documentation

## Overview

The Loft application uses a sophisticated authentication system that integrates with JOBZ CAFE® through a shared Supabase backend. This document outlines the complete authentication flow, file structure, and implementation details for replicating this system in other applications.

## Architecture

### Core Components

1. **Supabase Backend** - Shared authentication and database
2. **Cookie-based Session Storage** - Cross-domain authentication
3. **Profile System** - User profile management with JOBZ CAFE® sync
4. **Email OTP Authentication** - Magic link login system

### Key Features

- **Cross-domain SSO**: Works across both Loft and JOBZ CAFE® domains
- **Profile Synchronization**: User profiles are shared between applications
- **Role-based Access**: Different permission levels (host, admin, etc.)
- **Email OTP**: Passwordless authentication with verification codes

## File Structure

### Authentication Core Files

```
src/
├── pages/
│   └── LoftLogin.tsx              # Main login page component
├── hooks/
│   └── useAuth.ts                 # Authentication state management hook
├── services/
│   ├── supabaseClient.ts          # Supabase client configuration
│   ├── authCookieStorage.ts       # Cross-domain cookie management
│   └── supabaseApi.ts             # API service layer
├── components/Loft/
│   ├── LoftDevLogin.tsx           # Development login component
│   └── LoftProfilePage.tsx        # User profile management
└── types.ts                       # TypeScript type definitions
```

### Database Schema

The system uses a shared `profile` table that stores user information accessible to both Loft and JOBZ CAFE® applications.

```sql
-- Core profile table structure (inferred from code)
profile {
  id: string (primary key, links to auth.users)
  user_id: string (foreign key to auth.users)
  display_name: string
  avatar_url: string
  personal_room_id?: string
  can_host_loft: boolean
  canUsePersonalRoom: boolean
  personalRoomSlug?: string
  is_loft_admin?: boolean
  defaultBgId?: string
}
```

## Authentication Flow

### 1. Initial Login Process

**File**: `src/pages/LoftLogin.tsx`

```typescript
// Step 1: Send verification code
const handleSendCode = async () => {
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmedEmail,
    options: {
      shouldCreateUser: false, // Important: No auto-creation
    },
  });
};

// Step 2: Verify code and check profile access
const handleVerifyCode = async () => {
  const { error } = await supabase.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedCode,
    type: 'email',
  });
  
  // Critical: Check if user has JOBZ CAFE® profile
  const hasProfile = await ensureProfileAccess(userId);
  if (!hasProfile) {
    // Redirect to JOBZ CAFE® to create account
    setProfileMissing(true);
  }
};
```

### 2. Profile Access Validation

**Function**: `ensureProfileAccess()`

```typescript
const ensureProfileAccess = async (userId: string) => {
  const { data, error } = await supabase
    .from('profile')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  return !!data; // Returns true if profile exists
};
```

### 3. Session Management

**File**: `src/hooks/useAuth.ts`

The `useAuth` hook manages authentication state and profile data:

```typescript
export function useAuth(): AuthState {
  // Gets current session
  const { data: sessionData } = await supabase.auth.getSession();
  
  // Fetches profile data
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
    
  // Merges basic auth user with extended profile
  const mergedProfile = {
    ...basicProfile,
    ...profileData,
  };
}
```

## Cross-Domain Authentication

### Cookie Storage Strategy

**File**: `src/services/authCookieStorage.ts`

```typescript
const shouldUseJobzCafeDomain = () => {
  const host = window.location.hostname;
  return host.endsWith('jobzcafe.com');
};

const cookieOptions = () => {
  const opts = {
    path: '/',
    sameSite: 'Lax',
    secure: window.location.protocol === 'https:',
    expires: 7, // 7 days
  };

  if (shouldUseJobzCafeDomain()) {
    opts.domain = '.jobzcafe.com'; // Shared domain
  }

  return opts;
};
```

### Supabase Configuration

**File**: `src/services/supabaseClient.ts`

```typescript
export const supabase = createClient(
  VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: authCookieStorage, // Custom cookie storage
      storageKey: 'jobzcafe.supabase.auth', // Shared storage key
    },
  }
);
```

## User Types and Permissions

### Profile Interface

**File**: `types.ts`

```typescript
export interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string | null;
  defaultBgId?: string;
  can_host_loft: boolean;      // Permission to host rooms
  canUsePersonalRoom: boolean; // Personal room access
  personalRoomSlug?: string;   // Personal room identifier
  is_loft_admin?: boolean;     // Admin privileges
}
```

### Role System

```typescript
export enum LoftRole {
  HOST = 'host',
  COHOST = 'cohost', 
  SPEAKER = 'speaker',
  LISTENER = 'listener'
}
```

## Login UI Components

### Main Login Page

**File**: `src/pages/LoftLogin.tsx`

Features:
- Two-step email verification process
- Profile validation against JOBZ CAFE®
- Redirect handling for post-login destinations
- Error states and user feedback

### Development Login

**File**: `src/components/Loft/LoftDevLogin.tsx`

Features:
- Local development authentication
- User creation enabled (`shouldCreateUser: true`)
- Session management for testing

## Implementation Guide for Other Apps

### Step 1: Set Up Supabase Client

```typescript
// services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { authCookieStorage } from './authCookieStorage';

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: authCookieStorage,
      storageKey: 'jobzcafe.supabase.auth', // Use same key
    },
  }
);
```

### Step 2: Implement Cookie Storage

```typescript
// services/authCookieStorage.ts
import Cookies from 'js-cookie';

const cookieOptions = () => {
  const secure = window.location.protocol === 'https:';
  const opts = {
    path: '/',
    sameSite: 'Lax',
    secure,
    expires: 7,
  };

  // Adjust domain for your applications
  if (window.location.hostname.includes('yourdomain.com')) {
    opts.domain = '.yourdomain.com';
  }

  return opts;
};

export const authCookieStorage = {
  getItem: (key) => Cookies.get(key) ?? null,
  setItem: (key, value) => Cookies.set(key, value, cookieOptions()),
  removeItem: (key) => Cookies.remove(key, cookieOptions()),
};
```

### Step 3: Create Auth Hook

```typescript
// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

interface UserProfile {
  id: string;
  name: string;
  // Add your app-specific fields
}

export function useAuth() {
  const [authState, setAuthState] = useState({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    // Get initial session
    const getAuthState = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user || null;
      
      if (user) {
        // Fetch profile from shared table
        const { data: profileData } = await supabase
          .from('profile')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        setAuthState({
          user,
          profile: profileData,
          loading: false,
        });
      }
    };

    getAuthState();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Update auth state on changes
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  return authState;
}
```

### Step 4: Create Login Component

```typescript
// pages/Login.tsx
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

const Login = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const handleSendCode = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Don't auto-create accounts
      },
    });
    
    if (!error) {
      setCodeSent(true);
    }
  };

  const handleVerifyCode = async () => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    
    if (!error) {
      // Check for profile access
      const { data: profile } = await supabase
        .from('profile')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (!profile) {
        // Redirect to main app to create profile
        window.location.href = 'https://mainapp.com/signup';
      } else {
        // Login successful, redirect to app
        window.location.href = '/dashboard';
      }
    }
  };

  return (
    <div>
      {!codeSent ? (
        // Email input form
        <form onSubmit={handleSendCode}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
          <button type="submit">Send Code</button>
        </form>
      ) : (
        // Code verification form
        <form onSubmit={handleVerifyCode}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter verification code"
          />
          <button type="submit">Verify & Login</button>
        </form>
      )}
    </div>
  );
};
```

### Step 5: Environment Variables

Create `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_ENABLE_LOFT_LOGIN=true # For development
```

## Key Integration Points

### 1. Shared Database Access

- All apps must use the same Supabase project
- The `profile` table serves as the central user registry
- Each app can extend functionality with app-specific tables

### 2. Cross-Domain Cookies

- Use a shared domain (e.g., `.yourdomain.com`)
- Consistent cookie naming across apps
- Same storage key for Supabase auth

### 3. Profile Validation

- Always check for existing profile before allowing access
- Redirect users to main app for profile creation if missing
- Implement consistent error handling

### 4. User Creation Flow

- Main app (JOBZ CAFE®) handles user registration
- Secondary apps (Loft) validate existing users only
- No automatic user creation in secondary apps

## Security Considerations

1. **No Auto-Creation**: Secondary apps should use `shouldCreateUser: false`
2. **Profile Validation**: Always verify user has profile access
3. **Secure Cookies**: Use HTTPS and proper cookie settings
4. **Domain Validation**: Ensure cross-domain cookie security
5. **Session Management**: Implement proper logout and session cleanup

## Testing and Development

### Development Login

Use `LoftDevLogin.tsx` pattern for local development:

```typescript
// Enable user creation for development
const { error } = await supabase.auth.signInWithOtp({
  email: trimmedEmail,
  options: {
    shouldCreateUser: true, // Only in development
  },
});
```

### Environment Detection

```typescript
const enabledState = useMemo(() => {
  const isLocalhost = window.location.hostname === 'localhost';
  const isEnabled = !!(env?.DEV || flag === 'true' || isLocalhost);
  return { enabled: isEnabled };
}, []);
```

## Migration Checklist

When implementing this system in a new app:

- [ ] Set up Supabase client with shared configuration
- [ ] Implement cross-domain cookie storage
- [ ] Create authentication hook (`useAuth`)
- [ ] Build login component with email OTP
- [ ] Add profile validation logic
- [ ] Implement error handling and redirects
- [ ] Set up environment variables
- [ ] Test cross-domain authentication
- [ ] Verify profile synchronization
- [ ] Implement logout functionality
- [ ] Add development login component

## Troubleshooting

### Common Issues

1. **Cookies not working**: Check domain configuration and HTTPS
2. **Profile not found**: Verify user exists in main app first
3. **Session not persisting**: Ensure cookie storage is properly configured
4. **Cross-domain failures**: Verify domain settings and cookie options

### Debug Tools

```typescript
// Access Supabase client in console
window.__loftSupabase = supabase;

// Check current session
supabase.auth.getSession();

// Check profile access
supabase.from('profile').select('*').eq('user_id', userId);
```

This authentication system provides a robust foundation for multi-application ecosystems with shared user management while maintaining security and proper separation of concerns.
