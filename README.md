# Email Launchpad

Internal G-III email marketing application for loading campaign workbooks,
finding Workzone and Box assets, and uploading approved image assets to
brand-specific Klaviyo accounts.

## Current application shape

- React + Vite frontend
- Node + Express backend
- Playwright fallback for public Box shared folders
- Sharp compression below Klaviyo's request-size limit
- Docker deployment

The React build and API are served by the same Express process in production.

## Local development

Install the frontend and backend dependencies:

```bash
npm ci
cd server
npm ci
```

Copy `server/.env.example` to `server/.env` and fill only the values available
for the environment. Never commit `server/.env`.

Start the backend and frontend in separate terminals:

```bash
cd server
npm start
```

```bash
npm run dev
```

## Validation

Run these checks before deployment:

```bash
npm test
npm run lint
npm run build
```

Tests cover workbook parsing, Box URL restrictions, JPG/PSD classification,
upload-job idempotency, and oversized-image compression.

## Security model

- Production currently uses a temporary Basic Authentication gate.
- All Playwright navigation is restricted to HTTPS Box shared links.
- Klaviyo keys remain server-side.
- API responses are not cached and standard security headers are applied.
- Upload jobs are rate limited and heavy browser jobs run one at a time.

Before wider company access, replace Basic Authentication with company-managed
Microsoft Entra authentication at the hosting layer. Production secrets should
be stored in the hosting platform's secret manager or Azure Key Vault.

## Credential-dependent integrations

### SharePoint

The Microsoft Graph integration and manual-upload fallback are implemented.
IT must supply the tenant, application, site, drive, workbook paths, and
least-privilege Graph permissions.

### Workzone

OAuth configuration and the manual Box-link fallback are implemented. The
company-specific project-search endpoint mapping still requires approved API
documentation and credentials.

### Box

The active provider uses public shared links with Playwright. Environment keys
for an official Box application are reserved in `server/.env.example`, but the
official provider cannot be completed until IT supplies the authentication
method, enterprise ID, application credentials, and approved scopes.

### Klaviyo

Each supported brand uses a separate server-side private API key. Uploads run
as tracked jobs, preserve previous successes, skip already uploaded assets on a
retry, and only mark a campaign ready when the complete expected set succeeds.

## Deliberately out of scope

This stage does not create templates, clone templates, create campaigns,
schedule campaigns, or generate email HTML.
