// Native
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Packages
import * as debug from 'debug';
import {EventEmitter2} from 'eventemitter2';
import * as extend from 'extend';
import chokidar = require('chokidar');
import debounce = require('lodash.debounce');
import splitLines = require('split-lines');
import {FSWatcher} from 'chokidar';

// Ours
import {GameState} from './GameState';
import {lineParsers} from './line-parsers';

export interface IOptions {
	logFile: string;
	configFile: string;
}

const defaultOptions = {} as IOptions;
const log = debug('hlw');

// Determine the default location of the config and log files.
if (/^win/.test(os.platform())) {
	log('Windows platform detected.');
	let programFiles = 'Program Files';
	if (/64/.test(os.arch())) {
		programFiles += ' (x86)';
	}
	defaultOptions.logFile = path.join('C:', programFiles, 'Hearthstone', 'Hearthstone_Data', 'output_log.txt');

	if (process.env.LOCALAPPDATA) {
		defaultOptions.configFile = path.join(process.env.LOCALAPPDATA, 'Blizzard', 'Hearthstone', 'log.config');
	}
} else {
	log('OS X platform detected.');
	if (process.env.HOME) {
		defaultOptions.logFile = path.join(process.env.HOME, 'Library', 'Logs', 'Unity', 'Player.log');
		defaultOptions.configFile = path.join(process.env.HOME, 'Library', 'Preferences', 'Blizzard', 'Hearthstone', 'log.config');
	}
}

export interface ILogWatcher {
	update(filePath: string, stats: fs.Stats): void;
}

// The watcher is an event emitter so we can emit events based on what we parse in the log.
export class LogWatcher extends EventEmitter2 implements ILogWatcher {
	options: IOptions;
	gameState: GameState;

	// tslint:disable-next-line:no-empty
	update(_filePath: string, _stats: fs.Stats): void {}

	private _lastFileSize = 0;
	private _watcher: FSWatcher | null;

	constructor(options?: Partial<IOptions>) {
		super();

		this.options = extend({}, defaultOptions, options);
		this.gameState = new GameState();
		this._lastFileSize = 0;
		this.update = debounce((filePath: string, stats: fs.Stats) => {
			this._update(filePath, stats);
		}, 100);

		log('config file path: %s', this.options.configFile);
		log('log file path: %s', this.options.logFile);

		if (!fs.existsSync(path.parse(this.options.configFile).dir)) {
			throw new Error('Config file path does not exist.');
		}

		if (!fs.existsSync(path.parse(this.options.logFile).dir)) {
			throw new Error('Log file path does not exist.');
		}

		// Copy local config file to the correct location.
		// We're just gonna do this every time.
		const localConfigFile = path.join(__dirname, '../log.config');
		fs.createReadStream(localConfigFile).pipe(fs.createWriteStream(this.options.configFile));
		log('Copied log.config file to force Hearthstone to write to its log file.');
	}

	start() {
		this.gameState.reset();
		log('Log watcher started.');

		// Begin watching the Hearthstone log file.
		const watcher = chokidar.watch(this.options.logFile, {
			persistent: true,
			disableGlobbing: true,
			usePolling: true
		});

		watcher.on('add', (filePath, stats) => {
			this.update(filePath, stats);
		});

		watcher.on('change', (filePath, stats) => {
			this.update(filePath, stats);
		});

		this._watcher = watcher;
	}

	_update(filePath: string, stats: fs.Stats) {
		// We're only going to read the portion of the file that we have not read so far.
		const newFileSize = stats.size;
		let sizeDiff = newFileSize - this._lastFileSize;
		if (sizeDiff < 0) {
			sizeDiff = newFileSize;
		}

		const buffer = Buffer.alloc(sizeDiff);
		const fileDescriptor = fs.openSync(filePath, 'r');
		fs.readSync(fileDescriptor, buffer, 0, sizeDiff, this._lastFileSize);
		fs.closeSync(fileDescriptor);
		this._lastFileSize = newFileSize;

		this.parseBuffer(buffer, this.gameState);
	}

	stop() {
		if (!this._watcher) {
			return;
		}

		this._watcher.close();
		this._watcher = null;
		this._lastFileSize = 0;
	}

	parseBuffer(buffer: Buffer, gameState: GameState) {
		if (!gameState) {
			// tslint:disable-next-line:no-parameter-reassignment
			gameState = new GameState();
		}

		// Iterate over each line in the buffer.
		splitLines(buffer.toString()).forEach(line => {
			// Run each line through our entire array of line parsers.
			for (const lineParser of lineParsers) {
				const parts = lineParser.parseLine(line);
				if (!parts || parts.length <= 0) {
					continue;
				}

				lineParser.lineMatched(parts, gameState);

				const logMessage = lineParser.formatLogMessage(parts, gameState);
				if (logMessage) {
					lineParser.logger(logMessage);
				}

				const shouldEmit = lineParser.shouldEmit(gameState);
				if (shouldEmit) {
					this.emit(lineParser.eventName);
				}

				// Stop after the first match we get.
				break;
			}
		});

		return gameState;
	}
}
