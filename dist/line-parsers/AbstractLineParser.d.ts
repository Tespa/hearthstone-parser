import { GameState } from '../GameState';
import * as debug from 'debug';
export declare abstract class AbstractLineParser {
    abstract regex: RegExp;
    abstract eventName: string;
    private _logger;
    readonly logger: debug.IDebugger;
    parseLine(line: string): RegExpExecArray | null;
    abstract lineMatched(parts: string[], gameState: GameState): void;
    abstract formatLogMessage(parts: string[], gameState: GameState): string | false;
    abstract shouldEmit(gameState: GameState): boolean;
}
