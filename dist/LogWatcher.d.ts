/// <reference types="node" />
import * as EventEmitter from 'events';
import * as fs from 'fs';
import { GameState } from './GameState';
export interface IOptions {
    logFile: string;
    configFile: string;
}
export interface ILogWatcher {
    update(filePath: string, stats: fs.Stats): void;
}
export declare class LogWatcher extends EventEmitter implements ILogWatcher {
    options: IOptions;
    gameState: GameState;
    update(_filePath: string, _stats: fs.Stats): void;
    private _lastFileSize;
    private _watcher;
    constructor(options?: IOptions);
    start(): void;
    _update(filePath: string, stats: fs.Stats): void;
    stop(): void;
    parseBuffer(buffer: Buffer, gameState: GameState): GameState;
}
