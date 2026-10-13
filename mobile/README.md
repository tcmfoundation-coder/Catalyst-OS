# Catalysts Mobile

The primary Catalysts client, built with React Native and Expo Router. It uses the existing Next.js app as its API host; MongoDB and the existing domain logic remain in Catalysts Core.

## Connect to Catalysts Core

1. Copy `.env.example` to `.env.local` in this directory.
2. Set `EXPO_PUBLIC_CATALYSTS_API_URL` to the base URL of a running Catalysts server, without an API path. The app calls `/api/mobile/v1/...` itself.
3. Start the Next.js app from the repository root and start Expo from this directory with `npx expo start`.

The URL must be reachable from the device running the app. On a physical Android phone, `localhost` refers to the phone, not the computer running Catalysts. Use the computer's reachable LAN address for local development, or a deployed HTTPS URL. No API address is committed to this repository.

## Authentication and data flow

- Sign in uses the existing Catalysts email and password account.
- The server creates a random, device-scoped session token. MongoDB stores only its SHA-256 hash and expiry.
- The app stores the token with `expo-secure-store` and sends it as a Bearer token to the versioned mobile API.
- Sign out asks the server to revoke that session, then removes the token from secure storage.
- The dashboard endpoint derives the user from the server-validated session and returns real, ownership-scoped academic, task, study, and habit data.

Mobile screen guards improve navigation but are not a security boundary. The API validates every token and scopes every data query to its associated user.

## Commands

```bash
npx expo start
npx expo lint
npx tsc --noEmit
```
