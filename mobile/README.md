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

## Offline use and notifications

- On Android and iOS, successful authenticated GET responses are cached in a per-account SQLite database. Session tokens remain in secure device storage, not SQLite.
- Task edits and deletions, task/study-session/habit/memory creates, and selected academic updates can be queued while offline. The sync banner reports pending or failed changes; reconnect to retry. Queued create requests use stable mutation IDs so reconnect retries do not create duplicate records.
- Reads not previously loaded on this device have no offline copy. Tutor/AI requests, uploads, generated notes, sign-in, and other server-dependent actions still require a network connection. The browser build does not use the native SQLite queue.
- Daily study/task reminders are scheduled locally. Enabling the daily task reminder also schedules local reminders for the next 50 upcoming task due dates, using the selected reminder time.
- Cross-device alerts are opt-in under **Profile & settings → Notifications**. Task creates, edits, and deletions notify the user's other registered devices; the device that made the change is excluded. Notification registration and delivery require a network connection and a physical development/production build. Expo Go does not support this remote-push setup.
- Configure Android push credentials for the Expo project before expecting device delivery. If Expo push access tokens are enabled for the project, set the matching `EXPO_ACCESS_TOKEN` on the Catalysts server. The app must be rebuilt after adding native modules or changing Expo notification configuration.

## Commands

```bash
npx expo start
npx expo lint
npx tsc --noEmit
```

In Windows PowerShell with script execution restricted, use the command shims
instead (for example, `npx.cmd expo start` or
`npx.cmd eas-cli@latest build --platform android --profile preview`).

## Install a personal Android build

Use EAS Build to create an installable APK for your own Android phone. No
Google Play release is needed. The APK talks to the deployed Catalysts API;
do not use `localhost` for a build installed on your phone.

1. Deploy the web/API and make sure its HTTPS URL is reachable.
2. Create or sign in to an Expo account:

   ```bash
   npx eas-cli@latest login
   ```

3. From this `mobile/` directory, link the app to your Expo project. This
   prompts for the Expo account and stores the project ID in `app.json`:

   ```bash
   npx eas-cli@latest init
   ```

4. Set the API URL for the `preview` EAS environment. Replace the example
   with the actual deployed service URL, with no trailing slash:

   ```bash
   npx eas-cli@latest env:set --name EXPO_PUBLIC_CATALYSTS_API_URL --value https://your-service.onrender.com --environment preview --visibility plaintext
   ```

   This URL is bundled into the client app, so it is configuration, not a
   secret. Never put database credentials, API keys, or `NEXTAUTH_SECRET` in
   an `EXPO_PUBLIC_` variable.

5. Start the Android APK build:

   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```

   The first build may ask EAS to create and manage an Android signing key;
   accept that for this personal install and keep the key associated with
   this Expo project for future updates.

6. When the build finishes, open its EAS install link on your Android phone
   and install the APK. Android may ask you to allow installs from the
   browser used to open the link. Keep the build link private; anyone with it
   may be able to download the APK.

To update the app later, repeat the build command and install the new APK.
Keep the same Expo project and Android package name so updates use the same
signing identity. This EAS build profile is for Android APKs; iPhone
installation requires a separate iOS build and device provisioning.
