<script lang="ts">
	// regex.dexli.dev — single-page live regex tester.
	//
	// CTO SCAFFOLD: this file is the engineer onboarding surface. Three slots
	// are marked below — Wordmark/brand-shell (CTO-owned, do not edit),
	// functional UI (FRONTEND slice), and family-footer (CTO-owned, do not
	// remove or rewrite links). The bar's brand-inheritance oracle (item 11)
	// is satisfied by the Wordmark render + footer-links here regardless of
	// what frontend builds in the middle.
	import { onMount } from 'svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import FlagToggles from '$lib/components/FlagToggles.svelte';
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import MatchList from '$lib/components/MatchList.svelte';
	import PatternLibrary from '$lib/components/PatternLibrary.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import StatusPanel from '$lib/components/StatusPanel.svelte';
	import { evaluate, type EvalResult, type Match } from '$lib/engine';
	import { PATTERNS, type Pattern } from '$lib/patterns';
	import {
		EMPTY_FLAGS,
		flagsFromString,
		readUrlState,
		writeUrlState,
		type Flags,
		type UrlState
	} from '$lib/url-state';
	import { hydrateFromUrl } from '$lib/hydrate';

	// Frictionless first-load defaults (bar item 1): visible matches on entry,
	// no overlay/walkthrough required to see the tool at work.
	const DEFAULT_PATTERN = String.raw`\d+`;
	const DEFAULT_TEST_TEXT =
		'On a clear March morning in 1492, 3 ships left port carrying 87 sailors.';
	const DEFAULT_FLAGS: Flags = { ...EMPTY_FLAGS, global: true };

	let pattern = $state(DEFAULT_PATTERN);
	let testText = $state(DEFAULT_TEST_TEXT);
	let flags = $state<Flags>({ ...DEFAULT_FLAGS });
	let initialized = $state(false);

	let result = $state<EvalResult | null>(null);
	let evaluating = $state(false);
	let activeMatch = $state<number | null>(null);

	// Stable snapshot for URL-state writes (consumes the four URL-state fns).
	let urlState = $derived<UrlState>({ pattern, testText, flags });

	onMount(() => {
		const next = hydrateFromUrl(readUrlState(), {
			pattern: DEFAULT_PATTERN,
			testText: DEFAULT_TEST_TEXT,
			flags: DEFAULT_FLAGS
		});
		pattern = next.pattern;
		testText = next.testText;
		flags = next.flags;
		initialized = true;
	});

	// URL sync — gated on `initialized` so the debounced replaceState doesn't
	// stomp the URL the user arrived with before onMount hydrated state.
	$effect(() => {
		const snapshot: UrlState = {
			pattern: urlState.pattern,
			testText: urlState.testText,
			flags: { ...urlState.flags }
		};
		if (!initialized) return;
		writeUrlState(snapshot);
	});

	// Live evaluation — fires on every reactive change. Engine is contracted
	// to return inside its step budget (bar items 2 + 6); frontend renders
	// whatever discriminant comes back. Generation counter drops stale awaits
	// if the user types again before the previous evaluate settles.
	let evalGen = 0;
	$effect(() => {
		const p = pattern;
		const t = testText;
		const f: Flags = { ...flags };
		if (!initialized) return;
		const myGen = ++evalGen;
		evaluating = true;
		// Wrap in Promise.resolve so this composes against both the current
		// sync `evaluate` and the upcoming Promise<EvalResult> bump from the
		// engine engineer without a follow-up edit.
		Promise.resolve(evaluate(p, t, f)).then(
			(r: EvalResult) => {
				if (myGen !== evalGen) return;
				result = r;
				evaluating = false;
			},
			(err: unknown) => {
				if (myGen !== evalGen) return;
				result = {
					ok: false,
					kind: 'invalid',
					message: err instanceof Error ? err.message : String(err)
				};
				evaluating = false;
			}
		);
	});

	function pickPattern(p: Pattern) {
		// Bar item 8: clicking a library entry loads the source into the pattern
		// field and LEAVES TEST TEXT UNTOUCHED. Suggested flags merge in so the
		// library entry's intent is preserved without surprising the user with
		// flag-overrides (we OR with current flags, never clear).
		pattern = p.source;
		const merged = flagsFromString(p.flags);
		flags = {
			global: flags.global || merged.global,
			caseInsensitive: flags.caseInsensitive || merged.caseInsensitive,
			multiline: flags.multiline || merged.multiline,
			dotAll: flags.dotAll || merged.dotAll
		};
	}

	let matches = $derived<Match[]>(result && result.ok ? result.matches : []);
</script>

<svelte:head>
	<title>regex — live regex tester · dexli.dev</title>
</svelte:head>

<div class="page">
	<!-- BRAND-SHELL :: CTO-owned. Frontend may add controls AROUND the
	     Wordmark in the header; do not remove or replace the Wordmark
	     component itself. -->
	<header class="topbar wrap">
		<Wordmark />
		<div class="topbar-actions">
			<ShareButton value={urlState} />
		</div>
	</header>

	<!-- FUNCTIONAL UI :: FRONTEND slice. -->
	<main class="wrap" data-engineer-slot="frontend">
		<section class="inputs" aria-label="pattern and test text">
			<label class="field pattern">
				<span class="label-row">
					<span class="lbl">pattern</span>
					<span class="hint">JS regex source (no surrounding slashes)</span>
				</span>
				<div class="pattern-wrap">
					<span class="slash" aria-hidden="true">/</span>
					<input
						type="text"
						bind:value={pattern}
						spellcheck="false"
						autocapitalize="off"
						autocomplete="off"
						autocorrect="off"
						class="input mono"
						class:invalid={result !== null && !result.ok && result.kind === 'invalid'}
						aria-invalid={result !== null && !result.ok && result.kind === 'invalid'}
					/>
					<span class="slash" aria-hidden="true">/</span>
				</div>
			</label>

			<div class="field">
				<span class="label-row">
					<span class="lbl">flags</span>
				</span>
				<FlagToggles {flags} onChange={(next) => (flags = next)} />
			</div>

			<label class="field">
				<span class="label-row">
					<span class="lbl">test text</span>
					<span class="hint">the string the pattern is matched against</span>
				</span>
				<textarea
					bind:value={testText}
					spellcheck="false"
					autocapitalize="off"
					autocomplete="off"
					rows="4"
					class="input mono textarea"
				></textarea>
			</label>
		</section>

		<section class="results" aria-label="match results">
			<header class="results-head">
				<h2>matches</h2>
				<span class="meta">
					{#if result === null}
						{evaluating ? 'evaluating…' : ''}
					{:else if result.ok}
						{result.matches.length}
						{result.matches.length === 1 ? 'match' : 'matches'}
					{:else if result.kind === 'invalid'}
						<span class="meta-err">invalid pattern</span>
					{:else}
						<span class="meta-err">aborted</span>
					{/if}
				</span>
			</header>

			{#if pattern.length === 0}
				<StatusPanel
					title="Type a pattern to start matching."
					body="The /…/ field above is empty. Try {DEFAULT_PATTERN}, or pick one from the library."
				/>
			{:else if result === null}
				<StatusPanel title="Evaluating…" body="One moment." />
			{:else if !result.ok && result.kind === 'invalid'}
				<StatusPanel tone="error" title={result.message} body={result.hint ?? null} />
			{:else if !result.ok && result.kind === 'aborted'}
				<StatusPanel
					tone="error"
					title="Evaluation aborted."
					body={`${result.message} — edit your pattern to avoid catastrophic backtracking.`}
				/>
			{:else if result.ok && testText.length === 0}
				<StatusPanel
					title="0 matches"
					body="Test text is empty. Type something into the field above to match against."
				/>
			{:else if result.ok && result.matches.length === 0}
				<StatusPanel
					title="0 matches"
					body="Pattern is valid but does not match anywhere in the test text."
				/>
			{:else if result.ok}
				<div class="match-views">
					<div class="view-highlight">
						<header class="view-head"><h3>in context</h3></header>
						<HighlightedText text={testText} matches={result.matches} activeIndex={activeMatch} />
					</div>
					<div class="view-list">
						<header class="view-head">
							<h3>enumerated</h3>
							<span class="dim">click any value to copy</span>
						</header>
						<MatchList
							{matches}
							activeIndex={activeMatch}
							onHover={(i) => (activeMatch = i)}
						/>
					</div>
				</div>
			{/if}
		</section>

		<section class="library-section" aria-label="pattern library">
			<PatternLibrary patterns={PATTERNS} onPick={pickPattern} />
		</section>
	</main>

	<!-- FAMILY-FOOTER :: CTO-owned (bar item 11). -->
	<footer class="foot wrap">
		<span>A tiny tool for reading regex matches.</span>
		<span class="family">
			Part of the
			<a href="https://dexli.dev">dexli.dev</a>
			tiny-tools family —
			<a href="https://webhook.dexli.dev" rel="external">webhook.dexli.dev</a>
			·
			<a href="https://cron.dexli.dev" rel="external">cron.dexli.dev</a>
		</span>
		<span class="dim">2026 · regex · dexli.dev</span>
	</footer>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background:
			radial-gradient(800px 420px at 78% -10%, var(--accent-glow), transparent 60%),
			radial-gradient(900px 500px at 8% 110%, rgba(198, 241, 53, 0.05), transparent 60%);
	}
	.wrap {
		width: 100%;
		max-width: var(--maxw);
		margin: 0 auto;
		padding: 0 24px;
	}
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-top: 22px;
		padding-bottom: 22px;
	}
	.topbar-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	main {
		flex: 1;
		padding-top: 8px;
		padding-bottom: 56px;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.inputs {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.label-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.lbl {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}
	.hint {
		font-size: 11.5px;
		color: var(--text-faint);
	}
	.pattern-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 4px 10px;
		transition: border-color 90ms ease;
	}
	.pattern-wrap:focus-within {
		border-color: var(--accent);
	}
	.slash {
		color: var(--text-faint);
		font-family: var(--mono);
		font-size: 16px;
	}
	.input {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		background: transparent;
		border: 0;
		color: var(--fg);
		font-size: 14.5px;
		padding: 0;
	}
	.input:focus {
		outline: none;
	}
	.input.invalid {
		color: #ee8a8a;
	}
	.mono {
		font-family: var(--mono);
	}
	.textarea {
		display: block;
		width: 100%;
		padding: 12px 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		resize: vertical;
		min-height: 96px;
		line-height: 1.55;
	}
	.textarea:focus {
		outline: none;
		border-color: var(--accent);
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.results-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	h2 {
		font-family: var(--display);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
		font-weight: 600;
	}
	.meta {
		font-size: 12px;
		color: var(--text-faint);
		font-family: var(--mono);
	}
	.meta-err {
		color: #ee8a8a;
	}
	.match-views {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 14px;
	}
	.view-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 8px;
	}
	h3 {
		font-family: var(--display);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
		font-weight: 600;
	}
	.dim {
		font-size: 11px;
		color: var(--text-faint);
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		padding-top: 18px;
		padding-bottom: 26px;
		border-top: 1px solid var(--border-soft);
		font-size: 12px;
		color: var(--muted);
	}
	.foot .family {
		color: var(--muted);
	}
	.foot .family a {
		color: var(--accent);
	}
	.foot .dim {
		color: var(--text-faint);
	}

	@media (max-width: 880px) {
		.match-views {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 640px) {
		.wrap {
			padding: 0 14px;
		}
		.topbar {
			flex-wrap: wrap;
			gap: 10px;
		}
		.topbar-actions {
			width: 100%;
		}
		.foot {
			flex-direction: column;
			align-items: flex-start;
			gap: 6px;
		}
	}
</style>
