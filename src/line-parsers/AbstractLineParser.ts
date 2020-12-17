import {GameState} from '../GameState';
import * as debug from 'debug';
import {Events, HspEventsEmitter} from './index';

/**
 * Root class of all classes that read lines and emit events.
 */
export abstract class LineParser {
	abstract readonly eventName: string;

	// eslint-disable-next-line @typescript-eslint/member-ordering
	private _logger: debug.IDebugger;

	get logger(): debug.IDebugger {
		if (!this._logger) {
			this._logger = debug(`hlp:${this.eventName}`);
		}

		return this._logger;
	}

	abstract handleLine(
		emitter: HspEventsEmitter,
		gameState: GameState,
		line: string,
	): boolean;
}

/**
 * Regex based parser class used to handle one time events
 */
export abstract class AbstractLineParser extends LineParser {
	abstract readonly eventName: keyof Events;
	abstract readonly regex: RegExp;

	// eslint-disable-next-line @typescript-eslint/member-ordering
	handleLine(emitter: HspEventsEmitter, gameState: GameState, line: string): boolean {
		const parts = this.parseLine(line);
		if (!parts || parts.length <= 0) {
			return false;
		}

		this.lineMatched(parts, gameState);
		const logMessage = this.formatLogMessage(parts, gameState);
		if (logMessage) {
			this.logger(logMessage);
		}

		if (this.shouldEmit(gameState)) {
			emitter.emit(this.eventName);
		}

		return true;
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	parseLine(line: string): RegExpExecArray | null {
		return this.regex.exec(line);
	}

	abstract lineMatched(parts: string[], gameState: GameState): void;

	abstract formatLogMessage(parts: string[], gameState: GameState): string | false;

	abstract shouldEmit(gameState: GameState): boolean;
}
