// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
// Ported verbatim from https://github.com/shuuul/obsidian-infographic (src/types/obsidian-window.ts)
/**
 * Obsidian exposes its DOM helper functions (createEl, createDiv, ...) as
 * window-level globals in every app window, so they are reachable through
 * `element.win` / `doc.win`. obsidian.d.ts models them only on Node and as
 * unexported module functions, so calling them via a Window reference (as
 * recommended by the obsidianmd/prefer-create-el lint rule) needs this
 * augmentation.
 *
 * The options parameter is intentionally `unknown`: the obsidian package
 * does not export DomElementInfo, and current call sites pass no options.
 */
declare global {
	interface Window {
		createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: unknown, callback?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K];
		createDiv(o?: unknown, callback?: (el: HTMLDivElement) => void): HTMLDivElement;
		createSpan(o?: unknown, callback?: (el: HTMLSpanElement) => void): HTMLSpanElement;
		createSvg<K extends keyof SVGElementTagNameMap>(tag: K, o?: unknown, callback?: (el: SVGElementTagNameMap[K]) => void): SVGElementTagNameMap[K];
		createFragment(callback?: (el: DocumentFragment) => void): DocumentFragment;
	}
}

export {};
