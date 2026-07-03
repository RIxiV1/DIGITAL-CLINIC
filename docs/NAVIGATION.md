# Navigation

We don't use React Router for navigation. We use a hand-rolled `NavigationContext` that exposes a typed `Page` state machine and syncs that state to the URL.

This file explains why, how it works, and the StrictMode async-navigation gotcha that's eaten people before.

---

## The Page union

Every page in the app is a value of this type:

```ts
// src/app/contexts/types.ts
export type Page =
  | { type: 'landing' }
  | { type: 'quiz' }
  | { type: 'recommendedTests' }
  | { type: 'home' }
  | { type: 'healthMap' }
  | { type: 'upload' }
  | { type: 'processing' }
  | { type: 'manualEntry' }
  | { type: 'results'; reportId: string }
  | { type: 'problem'; problemId: string }
  | { type: 'profile' }
  | { type: 'privacy' };
```

Page state is a discriminated union with route params baked in. `results` knows it needs a `reportId`. `problem` knows it needs a `problemId`. There's no global params dictionary that the page has to type-assert against.

`App.tsx` reads the current `Page` from `useNavigation()` and renders the matching component:

```tsx
switch (page.type) {
  case 'landing':           return <LandingPage />;
  case 'home':              return <HomePage />;
  case 'results':           return <ReportResultsPage reportId={page.reportId} />;
  case 'problem':           return <ProblemDetailPage problemId={page.problemId} />;
  // …
  default:                  assertNever(page);
}
```

`assertNever` is a tiny exhaustiveness helper — if you add a new variant to `Page` and forget the switch case, TypeScript fails the build at the `assertNever` call.

---

## The API

```ts
const { page, navigate, replace, back } = useNavigation();
```

- **`page`** — the current Page, derived from the URL. Reactive; re-renders when navigation happens.
- **`navigate(p)`** — go to a page, pushing a new history entry. The back button returns here.
- **`replace(p)`** — go to a page by rewriting the current history entry (no new entry added).
- **`back()`** — step back. It defers to the browser's history; if you're already on the entry where the session started (nothing behind you inside the app), it lands you on the dashboard instead of leaving the app.

Two conventions worth knowing:

1. Use `replace()` for **terminal-state transitions** (you don't want the user to land back here by hitting back). Examples: `/processing` → `/results` after extraction succeeds; `/manualEntry` → `/results` after save.
2. Use `navigate()` for **forward steps** the user might want to come back to. Examples: dashboard → marker detail page; landing → quiz.

---

## URL ↔ state sync

Each Page maps to a clean URL **path** (not a query string). `pageToPath()` and `pathToPage()` in `NavigationContext.tsx` are the two halves of that mapping:

| Page | Path |
|---|---|
| `{ type: 'landing' }` | `/` |
| `{ type: 'home' }` | `/dashboard` |
| `{ type: 'upload' }` | `/upload` |
| `{ type: 'quiz' }` | `/quiz` |
| `{ type: 'recommendedTests' }` | `/tests` |
| `{ type: 'results', reportId }` | `/reports/:reportId` |
| `{ type: 'problem', problemId }` | `/topics/:problemId` |
| `{ type: 'profile' }` | `/profile` |

(`/processing` and `/manual-entry` round out the set.) The mapping is bidirectional, and the **URL is the source of truth** — `page` is derived from `location.pathname`, so `navigate`/`replace` just change the path and the page follows. Pasting a deep link like `/reports/rep-001` works for free, because `pathToPage()` parses it on mount; unknown paths fall back to `landing`.

There's one extra path alias: `/minimal` renders a stripped-down LandingPage variant (4 sections instead of 8). `pathToPage()` maps it to the `landing` page type, and `LandingPage.tsx` reads `useLocation().pathname` to pick the variant. Keeping it path-based makes the variant URL shareable and easy to A/B against `/`.

---

## How back/forward actually works

Here's the part most likely to surprise you — and it's pleasantly small.

Because `page` is derived straight from the URL, back/forward "just work": the browser changes the URL, and the page re-derives. There's no manual history stack, no `popstate` listeners, nothing to keep in sync.

The only thing `back()` has to decide is *"is there anywhere to go back to inside the app?"* We answer that with react-router's `location.key`: every history entry gets a unique key, and we snapshot the one present when the provider mounts (the session's starting point). If `back()` runs while we're still on that entry, there's no in-app history behind us — so we route to the dashboard rather than stepping the user out of the app. Otherwise we hand off to the browser.

```ts
// inside NavigationContext.tsx
const sessionStartKeyRef = useRef(location.key);   // snapshot at mount

const back = () => {
  if (location.key === sessionStartKeyRef.current) {
    routerNavigate(pageToPath({ type: 'home' }));   // nowhere to go back to → dashboard
    return;
  }
  window.history.back();                            // let the browser handle it
};
```

An earlier version kept its own `historyRef: Page[]` and pushed/popped on every `navigate()`. It desynced whenever someone used the browser's own back/forward, which made the "fall back to home" branch fire too early (teleporting people to the dashboard mid-navigation). Letting the browser own the history and just observing `location.key` replaced ~80 lines of fragile state-machine code.

---

## StrictMode async gotcha

React 18's `StrictMode` double-mounts every component in development. Effects fire twice, their cleanups fire twice. For most code this is fine — the effects are idempotent. For navigation effects, it's a foot-gun.

The common bug pattern:

```tsx
useEffect(() => {
  let cancelled = false;
  parseUploadedReport(file).then((result) => {
    if (cancelled) return;   // ← THIS LINE
    if (result.parsedFromFile) {
      navigate({ type: 'results', reportId });
    }
  });
  return () => {
    cancelled = true;
  };
}, []);
```

Looks fine. Isn't.

In StrictMode dev:

1. First mount fires the effect. `parseUploadedReport()` starts.
2. StrictMode unmounts → cleanup sets `cancelled = true` on the first closure.
3. Second mount fires the effect again. A *new* `cancelled` variable is created (still `false`). A *new* `parseUploadedReport()` call starts.
4. The FIRST parse resolves. The `if (cancelled)` check sees `true` from the first closure. Returns. **Doesn't navigate.**
5. The SECOND parse resolves. The `if (cancelled)` check sees `false` from its own closure. Navigates.

In production this works because there's no double-mount. In dev, if both resolves race the wrong way, the navigate is skipped and the user is stranded on `/processing` with no progress.

**The fix:** don't gate the final `.then` behind `cancelled` when the effect's terminal action is navigation. Instead, use a `mountedRef` that survives across mounts, or guard inside the navigate target page, or just let both fire and rely on `replace()` idempotency.

The existing pattern in `ProcessingPage.tsx`:

```tsx
const mountedRef = useRef(true);
useEffect(() => () => { mountedRef.current = false; }, []);

// later, inside an async handler:
const result = await parseWithAi(file);
if (!mountedRef.current) return;   // safe — ref is stable across re-renders
// proceed with navigation
```

`mountedRef` survives StrictMode's double-mount because refs aren't recreated on remount. The first mount's ref is reused on the second mount.

This pattern is intentionally documented in [`feedback_strictmode_async_navigation.md`](../memory/feedback_strictmode_async_navigation.md) (the AI agent memory file) because it's bitten the team before.

---

## Common patterns

### Navigate to results after async work

```tsx
const { navigate } = useNavigation();

const onConfirm = async () => {
  await markReportReady(reportId, { biomarkers });
  navigate({ type: 'results', reportId });
};
```

`navigate` is stable across renders (memoised in the context). Safe to call from inside async handlers, safe in deps arrays of other hooks.

### Replace, don't push, on terminal transitions

```tsx
// after the user confirms extraction:
replace({ type: 'results', reportId });

// NOT navigate({ type: 'results', reportId })
```

Why: if they hit back, you don't want them landing on `/processing` for a report they already confirmed. `replace()` swaps out `/processing` for `/results` in the same history slot.

### Restore-on-back via persistence

`ProcessingPage` persists the extracted-but-unconfirmed state to `dc_pendingConfirm`. If the user navigates away mid-confirm and comes back, we restore from localStorage instead of re-running the parser against a now-consumed file.

```tsx
const persisted = loadPendingConfirm<Biomarker>();
if (persisted && persisted.processingId === processingId) {
  setPendingConfirm({ ...persisted });
  return;
}
```

This is the only place in the app where we round-trip parser output through localStorage. Don't expand the pattern without a good reason.

---

## Anti-patterns

- **Don't read `window.location` directly.** Use `useNavigation().page`. Direct reads can fall out of sync during transitions.
- **Don't push to history outside the context.** Anything else that calls `history.pushState` corrupts the `location.key === 'default'` sentinel.
- **Don't gate async navigation behind `cancelled` closures.** See the StrictMode gotcha above.
- **Don't add new route params via URL search params freestyle.** Add them to the `Page` union so they're typed and the serialiser/deserialiser in NavigationContext is updated together.

---

## When to reach for React Router instead

If you ever need nested routes, route-level data loaders, or path-based routing (like `/reports/:id/markers/:markerId`), the home-rolled context starts to feel cramped. At that point, the migration is one PR — replace `NavigationContext` with React Router's `useNavigate` + a route config that maps `Page` variants to URL patterns. The page components themselves don't change.

For the current scope (10 pages, 2 path-level routes, a typed param dictionary), the hand-rolled version is simpler and easier to reason about.
