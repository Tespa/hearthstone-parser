/// <reference types="node" />
import * as fs from 'fs';
import { EventEmitter2 } from 'eventemitter2';
import { GameState } from './GameState';
export interface IOptions {
    logFile: string;
    configFile: string;
}
export interface ILogWatcher {
    update(filePath: string, stats: fs.Stats): void;
}
export declare class LogWatcher extends EventEmitter2 implements ILogWatcher {
    options: IOptions;
    gameState: GameState;
    update(_filePath: string, _stats: fs.Stats): void;
    private _lastFileSize;
    private _watcher;
    constructor(options?: Partial<IOptions>);
    start(): void;
    stop(): void;
    parseBuffer(buffer: Buffer, gameState: GameState): GameState;
    _update(filePath: string, stats: fs.Stats): void;
}
