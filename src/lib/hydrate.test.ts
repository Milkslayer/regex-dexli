// Hydration-matrix tests for the patch cycle. Bar items 1, 2, 3, 5.
//
// The function under test takes (parsed URL state, defaults) → live state.
// It does NOT speak to the engine or to the URL primitives; those are
// covered elsewhere.

import { describe, expect, it } from 'vitest';
import { hydrateFromUrl, type HydrationDefaults } from './hydrate';
import { EMPTY_FLAGS, type Flags } from './url-state';

const DEFAULT_PATTERN = String.raw`\d+`;
const DEFAULT_TEST_TEXT = 'a sample text with 42 digits in it';
const DEFAULT_FLAGS: Flags = { ...EMPTY_FLAGS, global: true };
const DEFAULTS: HydrationDefaults = {
	pattern: DEFAULT_PATTERN,
	testText: DEFAULT_TEST_TEXT,
	flags: DEFAULT_FLAGS
};

describe('item 1 — `?p=` absent → default pattern hydration', () => {
	it('absent ?p= with present ?t= keeps default pattern and uses URL test text', () => {
		const result = hydrateFromUrl({ testText: 'webhook body content' }, DEFAULTS);
		expect(result.pattern).toBe(DEFAULT_PATTERN);
		expect(result.testText).toBe('webhook body content');
	});

	it('absent ?p= with present ?t= AND ?f= keeps default pattern', () => {
		const result = hydrateFromUrl(
			{ testText: 'body', flags: { ...EMPTY_FLAGS, caseInsensitive: true } },
			DEFAULTS
		);
		expect(result.pattern).toBe(DEFAULT_PATTERN);
	});
});

describe('item 2 — `?p=` empty string → default pattern hydration', () => {
	it('empty-string ?p= with present ?t= keeps default pattern (empty = absent)', () => {
		const result = hydrateFromUrl({ pattern: '', testText: 'body' }, DEFAULTS);
		expect(result.pattern).toBe(DEFAULT_PATTERN);
		expect(result.testText).toBe('body');
	});

	it('empty-string ?p= alone keeps default pattern', () => {
		const result = hydrateFromUrl({ pattern: '' }, DEFAULTS);
		expect(result.pattern).toBe(DEFAULT_PATTERN);
	});

	it('symmetric — empty-string ?t= with present ?p= keeps default test text', () => {
		const result = hydrateFromUrl({ pattern: 'foo', testText: '' }, DEFAULTS);
		expect(result.testText).toBe(DEFAULT_TEST_TEXT);
		expect(result.pattern).toBe('foo');
	});

	it('symmetric — absent ?t= with present ?p= keeps default test text', () => {
		const result = hydrateFromUrl({ pattern: 'foo' }, DEFAULTS);
		expect(result.testText).toBe(DEFAULT_TEST_TEXT);
	});
});

describe('item 3 — `?p=` non-empty honored, no regression', () => {
	it('non-empty ?p= is used verbatim', () => {
		const result = hydrateFromUrl({ pattern: '[a-z]+' }, DEFAULTS);
		expect(result.pattern).toBe('[a-z]+');
	});

	it('non-empty ?p= and ?t= both honored', () => {
		const result = hydrateFromUrl({ pattern: '\\w+', testText: 'hello world' }, DEFAULTS);
		expect(result.pattern).toBe('\\w+');
		expect(result.testText).toBe('hello world');
	});

	it('regex metacharacters in non-empty ?p= pass through unchanged', () => {
		const result = hydrateFromUrl({ pattern: '(?:foo|bar)\\b' }, DEFAULTS);
		expect(result.pattern).toBe('(?:foo|bar)\\b');
	});

	it('non-empty ?p= with present ?f= preserves URL-supplied flags', () => {
		const result = hydrateFromUrl(
			{ pattern: 'foo', flags: { ...EMPTY_FLAGS, caseInsensitive: true, multiline: true } },
			DEFAULTS
		);
		expect(result.pattern).toBe('foo');
		expect(result.flags.caseInsensitive).toBe(true);
		expect(result.flags.multiline).toBe(true);
		expect(result.flags.global).toBe(false);
	});
});

describe('item 5 — edge states', () => {
	it('both ?p= and ?t= absent → fresh defaults across all three fields', () => {
		const result = hydrateFromUrl({}, DEFAULTS);
		expect(result.pattern).toBe(DEFAULT_PATTERN);
		expect(result.testText).toBe(DEFAULT_TEST_TEXT);
		expect(result.flags).toEqual(DEFAULT_FLAGS);
	});

	it('?p= absent + ?t= empty string → both default', () => {
		const result = hydrateFromUrl({ testText: '' }, DEFAULTS);
		expect(result.pattern).toBe(DEFAULT_PATTERN);
		expect(result.testText).toBe(DEFAULT_TEST_TEXT);
	});

	it('?p= and ?t= both empty strings → both default, fresh-equivalent', () => {
		const result = hydrateFromUrl({ pattern: '', testText: '' }, DEFAULTS);
		expect(result.pattern).toBe(DEFAULT_PATTERN);
		expect(result.testText).toBe(DEFAULT_TEST_TEXT);
	});
});

describe('item 3a — `?f=` absent → default flags hydration', () => {
	it('?t= only → flags default (global=on); symmetric counterpart to item 1', () => {
		const result = hydrateFromUrl({ testText: 'webhook body' }, DEFAULTS);
		expect(result.flags).toEqual(DEFAULT_FLAGS);
		expect(result.flags.global).toBe(true);
	});

	it('?p=foo (absent ?f=) → flags default', () => {
		const result = hydrateFromUrl({ pattern: 'foo' }, DEFAULTS);
		expect(result.flags).toEqual(DEFAULT_FLAGS);
	});

	it('?p=&t=foo&f= (empty f) → flags default; absent-or-empty symmetric to items 1+2', () => {
		const result = hydrateFromUrl(
			{ pattern: '', testText: 'foo', flags: { ...EMPTY_FLAGS } },
			DEFAULTS
		);
		expect(result.flags).toEqual(DEFAULT_FLAGS);
	});

	it('?p=&t=&f= (all empty) → all three defaults', () => {
		const result = hydrateFromUrl(
			{ pattern: '', testText: '', flags: { ...EMPTY_FLAGS } },
			DEFAULTS
		);
		expect(result.pattern).toBe(DEFAULT_PATTERN);
		expect(result.testText).toBe(DEFAULT_TEST_TEXT);
		expect(result.flags).toEqual(DEFAULT_FLAGS);
	});

	it('?t=foo&f=i (explicit non-empty ?f=) → flags honored verbatim', () => {
		const result = hydrateFromUrl(
			{ testText: 'foo', flags: { ...EMPTY_FLAGS, caseInsensitive: true } },
			DEFAULTS
		);
		expect(result.flags.caseInsensitive).toBe(true);
		expect(result.flags.global).toBe(false);
		expect(result.flags.multiline).toBe(false);
		expect(result.flags.dotAll).toBe(false);
	});

	it('?p=foo&f=gm (multiple flags) → all honored verbatim', () => {
		const result = hydrateFromUrl(
			{ pattern: 'foo', flags: { ...EMPTY_FLAGS, global: true, multiline: true } },
			DEFAULTS
		);
		expect(result.flags.global).toBe(true);
		expect(result.flags.multiline).toBe(true);
		expect(result.flags.caseInsensitive).toBe(false);
		expect(result.flags.dotAll).toBe(false);
	});

	it('NEW BEHAVIOR — cycle-1 share URL with all-off flags (omitted ?f=) now hydrates to DEFAULT_FLAGS', () => {
		// Bar amendment's acknowledged narrow regression: cycle-1's URL
		// writer omits ?f= when all flags are off, so the on-wire form is
		// indistinguishable from "no user intent." Item 3a chooses default
		// over all-off because the primary cycle-3 handoff flow needs the
		// default and the on-wire ambiguity was never explicit.
		const cycle1ShareAllOff = { pattern: 'foo', testText: 'bar' }; // no flags
		const result = hydrateFromUrl(cycle1ShareAllOff, DEFAULTS);
		expect(result.flags).toEqual(DEFAULT_FLAGS);
		expect(result.flags.global).toBe(true); // cycle-1 would have hydrated false
	});

	it('fully empty URL → all defaults (no regression on bare URL)', () => {
		const result = hydrateFromUrl({}, DEFAULTS);
		expect(result.flags).toEqual(DEFAULT_FLAGS);
	});
});

describe('returned flags are a fresh copy (no aliasing)', () => {
	it('mutating returned.flags does NOT mutate defaults.flags', () => {
		const result = hydrateFromUrl({}, DEFAULTS);
		result.flags.global = false;
		expect(DEFAULT_FLAGS.global).toBe(true);
	});

	it('mutating returned.flags does NOT mutate fromUrl.flags', () => {
		const fromUrl: Partial<{ flags: Flags }> = {
			flags: { ...EMPTY_FLAGS, global: true }
		};
		const result = hydrateFromUrl(fromUrl as any, DEFAULTS);
		result.flags.global = false;
		expect(fromUrl.flags?.global).toBe(true);
	});
});
