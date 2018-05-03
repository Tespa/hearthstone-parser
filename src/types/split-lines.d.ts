// Type definitions for split-lines
// Project: https://github.com/sindresorhus/split-lines
// Definitions by: Alex Van Camp <https://github.com/lange>

export = SplitLines;

declare function SplitLines(input: string, options?: ISplitLinesOptions): string[];

declare interface ISplitLinesOptions {
	preserveNewlines?: boolean;
}
