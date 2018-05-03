import {GameState} from '../GameState';
import * as debug from 'debug';

export abstract class AbstractLineParser {
	abstract regex: RegExp;
	abstract eventName: string;

	private _logger: debug.IDebugger;

	get logger() {
		if (!this._logger) {
			this._logger = debug(`hlw:${this.eventName}`);
		}

		return this._logger;
	}

	parseLine(line: string) {
		return this.regex.exec(line);
	}

	abstract lineMatched(parts: string[], gameState: GameState): void;
	abstract formatLogMessage(parts: string[], gameState: GameState): string | false;
	abstract shouldEmit(gameState: GameState): boolean;
}
