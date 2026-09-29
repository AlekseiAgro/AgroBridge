# AgroBridge mobile

Expo / React Native foundation for the AgroBridge app. This package is the first mobile shell. It is not the marketplace, and it does not change the website or the API.

## Run

From the repository root:

```bash
pnpm install
pnpm --filter @agrobridge/mobile start
```

Then open the project in Expo Go or a simulator. The script is `start`, not `dev`, so `pnpm dev` still starts only the existing web and API tasks.

## API

Set `EXPO_PUBLIC_API_URL` to the public Nest origin, including `/api`. See `.env.example`. The default is `https://api.agrobridge.ge/api`.

The app calls Nest directly with `Authorization: Bearer`. It does not call the Next.js BFF and does not use the `agrobridge_token` cookie. There is no refresh token. A 401 on an authenticated request clears the secure-store token.

## Not in this package yet

Home, the Requests tab, and product/request details read the public Nest catalog (`GET /products`, `GET /categories`, `GET /purchase-requests`, and the matching detail routes). Sign-in UI, offers, chat, push, subscriptions, My Products, editing, KYC, payments, and admin are still not in this package.
