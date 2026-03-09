# Floating Chat Refactor Design

## Problem
The floating chat in the Expo template has several issues:
1. Google Sign In forces re-authentication on every Expo Go refresh
2. Chat history reloads (with spinner) on re-renders and modal open/close
3. Stream state desync between custom `isStreamActive` and `useChat`'s `isLoading`

## Solution

### Auth Removal
Replace Google OAuth with project-ID-based auth. The project ID is already available via `EXPO_PUBLIC_PROJECT_ID` (set from the QR code subdomain). Send it as `x-project-id` header on API calls.

### Architecture Change
**Before:** FloatingButton → Modal → NavigationModal → [LoginScreen | HomeScreen | ChatScreen]
**After:** FloatingButton → Modal → ChatScreen (receives projectId prop)

### Chat Restart Fix
1. Ref-guarded fetch: `hasFetchedForProjectRef` keyed to project ID string — fetch history exactly once
2. Stable `useChat` id: pass `projectId` as chat `id` for AI SDK internal caching
3. Remove `isStreamActive`: use `useChat`'s `isLoading` instead
4. Pass fetched history as `initialMessages` rather than `setMessages` in effect

### Files Deleted (7)
- LoginScreen.tsx, HomeScreen.tsx, NavigationModal.tsx
- MockChatScreen.tsx, MockChatButton.tsx
- lib/auth/client.ts, lib/auth/config.ts

### Files Modified (3)
- FloatingChatWrapper.tsx — simplified, renders ChatScreen directly
- ChatScreen.tsx — projectId prop, ref-guarded fetch, no auth
- lib/api.ts — replace authenticatedFetch with projectFetch

### Files Untouched (3)
- DraggableFloatingButton.tsx, components/ClaudeCodeMessage.tsx, utils/animation-helpers.ts
