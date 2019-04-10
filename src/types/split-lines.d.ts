// Type definitions for split-lines
// Project: https://github.com/sindresorhus/split-lines
// Definitions by: Alex Van Camp <https://github.com/lange>

export = SplitLines;

declare function SplitLines(input: string, options?: SplitLinesOptions): string[];

declare interface SplitLinesOptions {
	preserveNewlines?: boolean;
}
