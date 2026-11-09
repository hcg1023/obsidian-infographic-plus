// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
// Ported verbatim from https://github.com/shuuul/obsidian-infographic (src/parser/InfographicParser.ts)
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

import {Notice} from "obsidian";

export type ParseResult = {
	success: true;
	content: string;
	isJson: boolean;
} | {
	success: false;
	error: string;
};

export function parseInfographicSpec(source: string): ParseResult {
	const trimmed = source.trim();
	
	if (!trimmed) {
		return {
			success: false,
			error: "Empty infographic block",
		};
	}

	if (trimmed.startsWith("{")) {
		try {
			JSON.parse(trimmed);
			return {
				success: true,
				content: trimmed,
				isJson: true,
			};
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			return {
				success: false,
				error: `Invalid JSON: ${message}`,
			};
		}
	}

	return {
		success: true,
		content: trimmed,
		isJson: false,
	};
}

export function showParseError(error: string): void {
	new Notice(`Infographic Error: ${error}`, 5000);
}
