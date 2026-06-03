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
  | { type: 'upload' }
  | { type: 'processing' }
  | { type: 'manualEntry' }
  | { type: 'results'; reportId: string }
  | { type: 'problem'; problemId: string }
  | { type: 'profile' };
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
const { page, navigate, replace, goBack, canGoBack } = useNavigation();
```

- **`page`** — the current Page. Reactive; re-renders when navigation happens.
- **`navigate(p)`** — push a new entry into history. Back button returns here.
- **`replace(p)`** — swap the current entry without pushing.
- **`goBack()`** — equivalent to the browser back button.
- **`canGoBack`** — boolean. `false` only at the user's very first entry into the app.

Two conventions worth knowing:

1. Use `replace()` for **terminal-state transitions** (you don't want the user to land back here by hitting back). Examples: `/processing` → `/results` after extraction succeeds; `/manualEntry` → `/results` after save.
2. Use `navigate()` for **forward steps** the user might want to come back to. Examples: dashboard → marker detail page; landing → quiz.

---

## URL ↔ state sync

The Page state is serialised to the URL as `?page=<type>&<paramKey>=<paramValue>`. So `{ type: 'results', reportId: 'rep-001' }` becomes `?page=results&reportId=rep-001`.

This is bidirectional:

- `navigate(p)` updates the URL via `history.pushState` (under the hood, via react-router's `useNavigate`).
- A user pasting a URL in directly works because mount-time we read `?page=...` and seed the Page state from it.

There's one route alias outside the `?page=` system: `/minimal` renders a stripped-down LandingPage variant (4 sections instead of 8). `LandingPage.tsx` reads `useLocation().pathname` to decide. Why path-based: it makes the variant URL shareable, and it lets us A/B `/minimal` against `/` cleanly.

---

## How back/forward actually works

This is the part most likely to surprise you.

We use `location.key` (from react-router) as our "are we at history-stack position N" signal. Every history entry has a unique `key`. The very first entry — the user's initial landing on the site — has `key === 'default'`.

```ts
// inside NavigationContext.tsx
const isInitialEntry = location.key === 'default';
const canGoBack = !isInitialEntry;
```

That's the entire mechanism. No manual history stack to maintain, no `popstate` listeners, no fighting the browser. The browser owns the history stack; we just observe its current position.

The previous implementation maintained a `historyRef.current: Page[]` and pushed/popped from it on every `navigate()` call. That broke for back/forward across multiple steps and for direct-URL-paste deep links. The `location.key === 'default'` approach replaced ~80 lines of fragile state-machine code with one comparison.

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
