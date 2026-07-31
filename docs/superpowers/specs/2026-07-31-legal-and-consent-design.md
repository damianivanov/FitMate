# Legal Page & Cookie Consent — Design (Lean)

**Date:** 2026-07-31
**Status:** Approved design, pending implementation plan
**Scope:** One static legal page, a cookie consent banner, consent stored on the `User` record

---

## 1. Context

FitMate has no legal documents and no consent mechanism. It is a fitness application storing health data (body metrics, weight log, training profile), sending data to OpenAI, and preparing to take Stripe payments from an EU (Bulgaria) entity serving EU users.

### 1.1 What the app stores on the client today

Verified by inspection:

| Item | Kind | Purpose |
|---|---|---|
| `Token` | HttpOnly cookie | Access token (`AuthController.SetAuthCookies`) |
| `RefreshToken` | HttpOnly cookie | Refresh token |
| `fitmate-theme` | localStorage | Light/dark preference |
| Workout drafts | localStorage | In-progress workout recovery |
| `g_state` | Third-party cookie | Google sign-in |
| `__stripe_mid`, `__stripe_sid` | Third-party cookie | Stripe fraud prevention (once billing ships) |

**No analytics, no advertising pixels, no cross-site tracking** — verified across `package.json` and `index.html`.

Every cookie set today is **strictly necessary**, so none legally requires consent. The banner is built ahead of likely future analytics, not to close a current gap.

### 1.2 Accepted trade-off

Consent lives as columns on `User`, not as an append-only log. Changing a decision **overwrites** the previous value, so there is no consent history. This is a deliberate, accepted simplification: history only matters once there is tracking whose lawfulness must be proven, and there is none. Revisit before enabling analytics.

---

## 2. Decisions

| Decision | Choice |
|---|---|
| Page count | **One** page at `/legal`, all topics as anchored sections |
| Consent storage | Columns on the `User` entity + localStorage for anonymous visitors |
| Banner | Bottom bar, non-blocking, **Accept all** and **Reject all** |
| Category granularity | Analytics + Marketing columns, but no Customize UI yet |
| Terms acceptance | Implied notice at registration, no checkbox, no acceptance record |
| Legal copy | Drafted FitMate-specific, pending legal review |
| Jurisdiction | Bulgaria / EU, GDPR + ePrivacy, no CCPA section |
| Contact | `damian.ivanovv@gmail.com` only |

### 2.1 Out of scope

- Separate `ConsentRecord` audit table
- Terms acceptance checkbox and per-version acceptance records
- Re-consent flow for existing users
- Cookie preferences / Customize modal
- GDPR data export and account deletion (own spec, still required for compliance)

### 2.2 Non-negotiable in the lean build

**Both `Accept all` and `Reject all`, at equal visual weight.** Accept-only is the exact pattern CNIL and the EDPB rule invalid, and it is four lines of code. This must not drift into a single highlighted button during visual polish.

---

## 3. Backend

### 3.1 User entity

`server/FitMate.DB/Entities/User.cs` gains three nullable columns:

```csharp
public bool? CookieConsentAnalytics { get; set; }
public bool? CookieConsentMarketing { get; set; }
public DateTime? CookieConsentAt { get; set; }
```

`null` means "never decided". One EF migration; no new table, no configuration file.

Two category columns rather than one boolean: `Accept all` writes `true/true`, `Reject all` writes `false/false`, and adding a Customize modal later needs **no migration**.

### 3.2 Read path — no new GET endpoint

`UserModel` (`server/FitMate.Core/JsonModels/Auth/UserModel.cs`) gains the same three fields:

```csharp
public bool? CookieConsentAnalytics { get; set; }
public bool? CookieConsentMarketing { get; set; }
public DateTime? CookieConsentAt { get; set; }
```

The existing `getCurrentUser` call already runs on every app load, so consent state arrives with it for free.

### 3.3 Write path — one endpoint

`POST /api/auth/cookie-consent` on `AuthController` (which already owns profile updates), authenticated:

```csharp
public class CookieConsentRequest
{
    public bool Analytics { get; set; }
    public bool Marketing { get; set; }
}
```

Sets the three columns on the current user, stamping `CookieConsentAt` **server-side**. Anonymous visitors call nothing.

Client types come from Reinforced.Typings on backend build — no hand-written interfaces.

---

## 4. Frontend

### 4.1 Consent store

`client/src/stores/consentStore.ts`, zustand, matching `themeStore.ts`, persisting through the existing `lib/localStorage.ts` envelope helpers (key `fitmate-cookie-consent`, schema version `1`).

```ts
type CookieDecision = {
  analytics: boolean;
  marketing: boolean;
  decidedAtUtc: string;
};

type ConsentState = {
  decision: CookieDecision | null;
  isBannerOpen: boolean;
  acceptAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
  reopenBanner: () => void;
  hydrateFromUser: (user: User) => void;
};
```

`decision === null` is the only trigger for showing the banner.

### 4.2 Sync

Called from `initUser` in `userStore.ts` once a user resolves:

| localStorage | User record | Action |
|---|---|---|
| set | null | POST local → server (anonymous choice survives signup) |
| none | set | Write server values into localStorage (new device, no re-prompt) |
| set | set | Server wins; localStorage overwritten |
| none | null | Show banner |

Server wins on conflict — the account is the more durable record, and without consent history there is nothing to reconcile. Sync failures are non-fatal and never block app load.

### 4.3 Banner

`client/src/components/CookieConsentBanner.tsx`, rendered in `Layout.tsx` alongside `ActiveWorkoutSheetHost` so it covers both the authenticated and public shells.

- Bottom-pinned `liquid-surface` card
- Copy: what essential cookies do, that optional ones are not currently in use, link to `/legal#cookies`
- Actions: `Reject all` · `Accept all`, identical visual weight

Positioning:
- Authenticated + mobile: `bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)]` to clear `MobileBottomNav` (authenticated branch only, `Sidebar.tsx:187`)
- Otherwise: `bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]`

Given this project's history with stacked safe-area insets breaking the bottom nav, verify on a real device rather than devtools emulation.

Accessibility: `role="dialog"`, `aria-label`, focus moves to the banner on mount, Escape does not dismiss.

---

## 5. The Legal Page

### 5.1 Route

`/legal`, public, no `AccessGate`. One route, one page component.

### 5.2 Structure

```
client/src/pages/Legal/
  Legal.tsx          # renders sections, handles anchor scroll
  content.ts         # typed section data
  index.ts
```

```ts
type LegalSubsection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { columns: string[]; rows: string[][] };
};

type LegalSection = {
  id: string;
  title: string;
  subsections: LegalSubsection[];
};
```

The `table` variant carries the cookie inventory and the sub-processor list — both genuinely tabular, and both things a regulator asks to see.

A sticky in-page nav links the six anchors. Sections are plain (not collapsed) so browser find-in-page and printing work.

### 5.3 Sections

| Anchor | Section |
|---|---|
| `#terms` | Terms of Service |
| `#disclaimer` | Medical & AI Disclaimer |
| `#privacy` | Privacy Policy |
| `#cookies` | Cookie Policy |
| `#refunds` | Refund & Cancellation |
| `#imprint` | Legal Notice |

`/legal#terms` is a stable, reachable URL, which is what Stripe asks for at onboarding.

### 5.4 Content requirements

**Terms of Service** — subscription tiers and AI usage limits (already modelled by `UsageBucket` / `UsageEntry`), acceptable use, account termination, IP, limitation of liability, Bulgarian governing law. Includes the implied-acceptance statement that registration constitutes agreement.

**Medical & AI Disclaimer** — not medical advice; consult a physician before starting a programme; assumption of risk for physical training; AI-generated guidance may be inaccurate and requires user judgement. Highest-value section for a training app.

**Privacy Policy** — body metrics, weight log and training profile identified as **Art. 9 special-category health data** with lawful basis stated; **OpenAI** named as the LLM sub-processor (the only one implemented, `FitMate.Integrations/AI/OpenAI/`) for both completions and image generation, with what is transmitted and the US transfer basis; `AIRedactionService.cs` cited as an implemented safeguard; retention, data-subject rights, contact route.

Sub-processor table: OpenAI (AI coaching, image generation), Google (authentication), Stripe (payments), Azure Blob Storage (exercise images).

**Cookie Policy** — the real inventory from §1.1, columns: name · provider · purpose · duration · category. States explicitly that no analytics or advertising cookies are currently used.

**Refund & Cancellation** — EU 14-day right of withdrawal, explicit waiver for immediate digital access, Stripe billing cycle, cancellation mechanics.

**Legal Notice** — operator identification, contact, VAT/EIK, register entry.

### 5.5 Link placement

- `HomeFooter.tsx` — currently logo + copyright only; gains `Legal` and `Cookie preferences`
- `UserMenu` — same two entries for signed-in users
- Login / Register — compact `Legal` link, plus the implied-acceptance line under the submit button:
  > By creating an account you agree to our [Terms and Privacy Policy](/legal).

**Cookie preferences** calls `reopenBanner()`. This is a legal requirement, not polish — withdrawing consent must be as easy as giving it. If the only way to change your mind is clearing browser storage, the banner is not compliant.

### 5.6 Naming constraints

- The only contact address anywhere is `damian.ivanovv@gmail.com`
- **No other brand, product, or company name appears** in any document, UI string, or comment. Verified: the repository currently contains none.

### 5.7 Placeholders required before launch

| Field | Needed for |
|---|---|
| `[[OPERATOR_NAME]]` | Legal Notice, Terms, Privacy |
| `[[OPERATOR_ADDRESS]]` | Legal Notice, Privacy |
| `[[VAT_OR_EIK]]` | Legal Notice |

**EU law requires the operator's name and a physical address** (Bulgarian E-Commerce Act Art. 4, mirroring the EU E-Commerce Directive). An email address alone does not satisfy this. Sole-trader details are acceptable; the fields cannot stay blank at public launch.

### 5.8 Legal review caveat

Drafted by an AI assistant, not a lawyer. Researched and specific to FitMate's actual data flows, which generic generators do not cover. **Have a Bulgarian lawyer review it before taking payments** — special-category health data combined with third-party AI processing is not a template case.

---

## 6. Testing

**Backend**
- `POST /api/auth/cookie-consent` sets all three columns and stamps `CookieConsentAt` server-side
- The endpoint rejects unauthenticated callers
- `getCurrentUser` returns the consent fields

**Frontend**
- Decision persists across reload; `null` opens the banner
- Sync matrix (§4.2), all four cases
- Banner clears `MobileBottomNav` when authenticated on mobile
- `Cookie preferences` reopens the banner
- `npm run lint` clean

---

## 7. Delivery Order

1. Backend: three `User` columns, migration, `UserModel` fields
2. Backend: `CookieConsentRequest` + `POST /api/auth/cookie-consent`, tests
3. Frontend: regenerate types, consent store, sync in `userStore`
4. Frontend: banner
5. Legal page: types, content, route
6. Link placement: footer, `UserMenu`, auth pages
7. Lint, tests, real-device check of banner positioning

---

## 8. Deferred

- **GDPR data rights** — account deletion and data export. Required for compliance, touches every user-owned table plus blob storage. Own spec.
- **Consent history** — revisit the append-only table before enabling any analytics (§1.2).
- **Cookie preferences modal** — per-category toggles; the schema already supports it without a migration.
