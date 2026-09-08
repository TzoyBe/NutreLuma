# NutreLuma Native

React Native / Expo client for NutreLuma.

The native app uses the existing NutreLuma backend at `https://www.nutreluma.com`:

- `POST /api/auth/mobile/login`
- `POST /api/auth/mobile/register`
- authenticated requests with `Authorization: Bearer <token>`
- `GET /api/dashboard`

## Run

```sh
npm install
npm start
```

Then open with Expo Go, an iOS simulator, or an Android emulator.

## Current Scope

- Native login/register shell
- Email verification handoff message after signup
- Native onboarding/profile setup
- Bearer-token API client
- Secure token persistence and auto-login
- Liquid-glass native app shell matching the web navigation
- Dashboard summary, macros, meals
- Native add meal with camera/photo picker upload
- Native meal detail with analysis polling and meal confirmation
- Native weight tracking with add/list/delete
- Native notifications screen with unread bell and mark-as-read
- Expo push notification registration
- EAS build profiles for iOS/Android preview and production builds

## Full Native Rewrite Roadmap

The target is feature parity with the web app without WebView. The native navigation follows the
web structure:

- Today: dashboard, add meal and meal detail
- Progress: weight, history, stats and insights
- Goals: goals, achievements and maintenance
- Recipes: recipes and meal plan
- Profile: settings, billing, account, notifications and data/privacy controls

Next native screens to build:

- native edit meal / clarification answers
- deeper profile/settings management
- meal history and progress charts
- goals, achievements and maintenance flows
- recipes and meal plan flows
- billing and account management

## Push Notifications

The app registers an Expo push token after login and sends it to
`POST /api/notifications/push-token`. For production iOS/Android builds, configure EAS project
metadata plus APNs/FCM credentials in Expo.

## RevenueCat subscriptions

NutreLuma uses RevenueCat only for native iOS and Android subscriptions. The app logs the
RevenueCat customer in with the NutreLuma backend user ID, so that ID is the RevenueCat
**App User ID**. Support can search that exact NutreLuma user ID in RevenueCat's Customers
page when investigating a purchase or entitlement.

Configure the following in the EAS environment for every profile that produces a native
binary (preview and production as appropriate):

```dotenv
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro
```

Only `EXPO_PUBLIC_*` variables enter an EAS/native build. The iOS and Android API keys are
RevenueCat public SDK keys; they are deliberately build-visible. Do **not** put
`REVENUECAT_SECRET_API_KEY` in EAS, `app.json`, source code, or any `EXPO_PUBLIC_*` variable.
That key belongs only to the web/backend deployment environment.

### External setup and release order

1. In App Store Connect and Google Play Console, create the matching auto-renewable
   subscriptions with product IDs `nutreluma_pro_monthly` and
   `nutreluma_pro_yearly`; complete the store agreements, tax/banking, and tester setup
   required by each store.
2. In RevenueCat, add the iOS and Android apps using bundle/package ID
   `com.joybeedigital.nutreluma`, connect their respective store credentials, import the
   same two product IDs, and attach both products to the `pro` entitlement. Configure a
   current offering/paywall that exposes those packages, and enable Customer Center if the
   in-app management screen is to be available.
3. Deploy the backend configuration and code first, including the secret REST API key,
   entitlement `pro`, and the comma-separated allow-list of the same product IDs. The
   backend must be live before distributing a binary, because it is authoritative for
   NutreLuma access.
4. Set the three public values above in EAS, then build and distribute a new development
   client/preview/production binary. Changing an `EXPO_PUBLIC_*` value requires a new
   native build; it cannot be fixed by changing only the backend environment.

The entitlement and product IDs must match exactly across the stores, RevenueCat, EAS, and
backend allow-list. Lifetime products are not supported by this integration.

### Sandbox test flow

For store sandbox/TestFlight/internal-track testing, the backend deployment used by that
test binary must set `REVENUECAT_ALLOW_SANDBOX=true`; production should keep it `false`.
Use an Apple sandbox tester or Google Play license tester, make a monthly/yearly purchase,
and confirm that the backend returns active billing after the app's immediate sync. Then
test Restore Purchases and Customer Center/store cancellation. Expo Go cannot exercise this
native RevenueCat module; use a development client or an EAS-built binary.

After a purchase or restore, the native app calls authenticated
`POST /api/billing/revenuecat/sync` immediately. Local RevenueCat entitlement state alone
does not grant NutreLuma access: the backend fetches the customer by NutreLuma user ID and
accepts only the configured entitlement, allow-listed product, supported store, and allowed
sandbox state. If confirmation fails, the app retains a retry/restore path instead of
claiming active access.

## EAS Builds

The project includes `eas.json` with three profiles:

- `development`: internal development client builds
- `preview`: internal installable test builds
- `production`: store-ready builds with remote app version auto-increment

First-time setup:

```sh
npm install
npm run eas:init
```

`eas init` links the local project to Expo and writes the real EAS project id into app config.
Do not invent this id manually.

Preview builds:

```sh
npm run build:ios:preview
npm run build:android:preview
```

Production builds:

```sh
npm run build:ios:production
npm run build:android:production
```

Store submission:

```sh
npm run submit:ios
npm run submit:android
```

Before production submission, configure:

- Apple Developer account and App Store Connect app for `com.joybeedigital.nutreluma`
- Google Play app for `com.joybeedigital.nutreluma`
- APNs credentials for iOS push notifications
- FCM credentials for Android push notifications
- optional backend `EXPO_ACCESS_TOKEN` if Expo push security is enabled
- RevenueCat iOS/Android public SDK keys and entitlement ID as EAS `EXPO_PUBLIC_*` variables
- RevenueCat secret API key and product allow-list only in the backend deployment environment

## Codemagic Unsigned IPA

`codemagic.yaml` includes an `ios-unsigned-ipa` workflow for external re-signing services.
It uses Codemagic macOS/Xcode runners to:

- install the Expo dependencies
- generate the native iOS project with `expo prebuild`
- build an unsigned `iphoneos` archive
- package `Payload/NutreLuma.app` as `NutreLuma-unsigned.ipa`

Run this workflow in Codemagic and download the `.ipa` artifact. This artifact is intended for
external signing/re-signing, for example with Signulous.

There is also an `ios-simulator-app` workflow that produces an unsigned simulator `.app`. That
artifact is only for iOS Simulator, not for installation on a real iPhone.
