// URL-to-state hydration logic for the regex page. Lives here (not in
// url-state.ts) because the parser is the contract and stays pure: it
// returns what the URL literally said, including empty strings.
//
// Hydration is the UI-side concern of mapping that parsed state plus
// defaults into the live editor state. Symmetric per-field rule across
// all three URL dimensions (p, t, f): absent OR empty in URL → field
// keeps its DEFAULT_*; non-empty in URL → honored verbatim.
//
// The flag axis treats "empty" as "no flag toggled on" (the parser
// maps empty `?f=` to an all-false Flags struct). That collapses the
// on-wire ambiguity between "explicitly all-off" and "no user intent"
// — per item 3a we accept that collapse and default in both cases.
// Cycle-1's URL writer never emitted `?f=` when all flags were off
// (it omits the param entirely), so a cycle-1-generated share URL
// that has all-flags-off will now hydrate as default flags rather
// than all-off. This is the acknowledged narrow regression noted in
// the bar amendment.
//
// Exported as a pure function so the hydration matrix can be
// unit-tested without mounting the page component.

import { type Flags, type UrlState } from './url-state';

export interface HydrationDefaults {
	pattern: string;
	testText: string;
	flags: Flags;
}

function anyFlagOn(flags: Flags): boolean {
	return flags.global || flags.caseInsensitive || flags.multiline || flags.dotAll;
}

export function hydrateFromUrl(
	fromUrl: Partial<UrlState>,
	defaults: HydrationDefaults
): UrlState {
	const pattern =
		fromUrl.pattern !== undefined && fromUrl.pattern !== ''
			? fromUrl.pattern
			: defaults.pattern;
	const testText =
		fromUrl.testText !== undefined && fromUrl.testText !== ''
			? fromUrl.testText
			: defaults.testText;
	const flags: Flags =
		fromUrl.flags && anyFlagOn(fromUrl.flags)
			? { ...fromUrl.flags }
			: { ...defaults.flags };
	return { pattern, testText, flags };
}
