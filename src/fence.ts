// Fence parameter helpers ported from https://github.com/shuuul/obsidian-infographic (src/main.ts)
// Copyright 2025 shuuul
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type {App, Editor, MarkdownPostProcessorContext} from "obsidian";
import {MarkdownView} from "obsidian";

/**
 * Rewrite an ```infographic fence line so it carries `width=N`, preserving
 * any other fence parameters.
 */
export function setFenceWidth(fence: string, width: number): string {
	const match = fence.match(/^(`{3,})(\s*)infographic\b(.*)$/);
	if (!match) return fence;
	const sep = match[2] ?? " ";
	const rest = (match[3] ?? "").replace(/\s+width\s*=\s*\d+/i, "").trim();
	return `${match[1]}${sep}infographic${rest ? ` ${rest}` : ""} width=${width}`;
}

/**
 * Set or remove the `align=center|left` parameter on an ```infographic fence
 * line, preserving every other parameter. `null` removes the parameter so the
 * plugin default applies again.
 */
export function setFenceAlign(fence: string, align: "center" | "left" | null): string {
	const match = fence.match(/^(`{3,})(\s*)infographic\b(.*)$/);
	if (!match) return fence;
	const sep = match[2] ?? " ";
	const rest = (match[3] ?? "").replace(/\s+align\s*=\s*(center|left)\b/i, "").trim();
	if (!align) return `${match[1]}${sep}infographic${rest ? ` ${rest}` : ""}`;
	return `${match[1]}${sep}infographic${rest ? ` ${rest}` : ""} align=${align}`;
}

/**
 * Read the `align=center|left` parameter from a fence line.
 * Returns null when absent (the plugin default applies).
 */
export function getFenceAlign(fence: string): "center" | "left" | null {
	const match = fence.match(/\balign\s*=\s*(center|left)\b/);
	return match ? (match[1] as "center" | "left") : null;
}

/** True when the line opens an infographic code fence. */
export function isInfographicFence(line: string): boolean {
	return /^\s*`{3,}\s*infographic\b/.test(line);
}

/** Parse the `width=N` fence parameter. Returns null when absent or too small. */
export function parseWidthParam(fence: string): number | null {
	const match = fence.match(/\bwidth\s*=\s*(\d+)\b/i);
	if (!match) return null;
	const width = Number(match[1]);
	return Number.isFinite(width) && width >= 200 ? width : null;
}

/**
 * Locate the section inside the editor by matching its lines. Returns the
 * fence line number only when exactly one match exists, so ambiguous blocks
 * are never edited.
 */
export function findUniqueSectionStart(editor: Editor, section: string[]): number | null {
	const first = section[0];
	if (first === undefined) return null;
	const last = section.length - 1;
	let found: number | null = null;
	let matches = 0;
	for (let line = 0; line + last <= editor.lastLine(); line++) {
		if (editor.getLine(line) !== first) continue;
		let ok = true;
		for (let offset = 1; offset <= last; offset++) {
			if (editor.getLine(line + offset) !== section[offset]) {
				ok = false;
				break;
			}
		}
		if (ok) {
			matches++;
			found = line;
		}
	}
	return matches === 1 ? found : null;
}

/**
 * Locate a code block in the editor by matching its fence line against the
 * block's rendered source. Returns the fence line number and text only when
 * exactly one match exists. Used as the live-preview fallback where
 * ctx.getSectionInfo is unavailable.
 */
export function findUniqueBlockFence(editor: Editor, source: string): {line: number, fence: string} | null {
	const contentLines = source.split("\n");
	const last = contentLines.length - 1;
	let found: {line: number, fence: string} | null = null;
	let matches = 0;
	for (let line = 0; line + 1 + last <= editor.lastLine(); line++) {
		const fence = editor.getLine(line);
		if (!/^\s*`{3,}\s*infographic\b/.test(fence)) continue;
		let ok = true;
		for (let offset = 0; offset <= last; offset++) {
			const expected = contentLines[offset];
			if (expected !== undefined && editor.getLine(line + 1 + offset) !== expected) {
				ok = false;
				break;
			}
		}
		if (ok) {
			matches++;
			if (found === null) found = {line, fence};
		}
	}
	return matches === 1 ? found : null;
}

/**
 * Resolve the block's fence line text. ctx.getSectionInfo is preferred,
 * but in live preview it may describe an unrelated section, so anything
 * that is not an infographic fence falls back to locating the block in
 * the editor by its content.
 */
export function resolveFenceText(app: App, ctx: MarkdownPostProcessorContext, el: HTMLElement, source: string): string | null {
	const info = ctx.getSectionInfo(el);
	const sectionFence = info?.text.split("\n")[0];
	if (sectionFence && isInfographicFence(sectionFence)) return sectionFence;

	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view || view.getMode() !== "source") return null;
	if (!view.file || view.file.path !== ctx.sourcePath.split("#")[0]) return null;
	const located = findUniqueBlockFence(view.editor, source);
	return located?.fence ?? null;
}

/**
 * Best-effort persistence of a fence edit (width / align): rewrite the
 * block's fence line in the live editor. Skipped in reading mode, in
 * hover previews of other files, and when the section cannot be located
 * unambiguously, so user content is never edited ambiguously.
 */
export function persistFenceUpdate(app: App, ctx: MarkdownPostProcessorContext, el: HTMLElement, source: string, update: (fence: string) => string): void {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view || view.getMode() !== "source") return;
	const filePath = ctx.sourcePath.split("#")[0];
	if (!view.file || view.file.path !== filePath) return;
	const editor = view.editor;

	// Preferred: the section information captured while rendering.
	// CAVEAT: in live preview this may describe an unrelated section
	// (e.g. the surrounding heading), so only trust it when it actually
	// is an infographic fence.
	const info = ctx.getSectionInfo(el);
	if (info) {
		const fence = info.text.split("\n")[0];
		if (fence && isInfographicFence(fence)) {
			const updatedFence = update(fence);
			if (updatedFence === fence) return;
			const line = editor.getLine(info.lineStart) === fence
				? info.lineStart
				: findUniqueSectionStart(editor, info.text.split("\n"));
			if (line !== null) {
				editor.replaceRange(updatedFence, {line, ch: 0}, {line, ch: fence.length});
				return;
			}
		}
		// Stale or unrelated section info: fall through to content matching.
	}

	// Live preview fallback: ctx.getSectionInfo is unavailable inside
	// CodeMirror widgets, so locate the block by its fence + content.
	const located = findUniqueBlockFence(editor, source);
	if (!located) return;
	const updatedFence = update(located.fence);
	if (updatedFence === located.fence) return;
	editor.replaceRange(updatedFence, {line: located.line, ch: 0}, {line: located.line, ch: located.fence.length});
}

export function persistBlockWidth(
	app: App,
	ctx: MarkdownPostProcessorContext,
	el: HTMLElement,
	source: string,
	width: number,
): void {
	persistFenceUpdate(app, ctx, el, source, (fence) => setFenceWidth(fence, width));
}
