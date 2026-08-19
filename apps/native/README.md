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
