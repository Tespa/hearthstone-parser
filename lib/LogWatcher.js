'use strict';

// Native
const EventEmitter = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Packages
const chokidar = require('chokidar');
const debounce = require('lodash.debounce');
const debug = require('debug');
const extend = require('extend');
const splitLines = require('split-lines');

// Ours
const ParserState = require('./ParserState');
const lineParsers = require('./line-parsers');

const defaultOptions = {};

// Define some debug logging functions for easy and readable debug messages.
const log = {
	main: debug('hlw'),
	gameStart: debug('hlw:game-start'),
	zoneChange: debug('hlw:zone-change'),
	gameOver: debug('hlw:game-over')
};

// Determine the default location of the config and log files.
if (/^win/.test(os.platform())) {
	log.main('Windows platform detected.');
	let programFiles = 'Program Files';
	if (/64/.test(os.arch())) {
		programFiles += ' (x86)';
	}
	defaultOptions.logFile = path.join('C:', programFiles, 'Hearthstone', 'Hearthstone_Data', 'output_log.txt');
	defaultOptions.configFile = path.join(process.env.LOCALAPPDATA, 'Blizzard', 'Hearthstone', 'log.config');
} else {
	log.main('OS X platform detected.');
	defaultOptions.logFile = path.join(process.env.HOME, 'Library', 'Logs', 'Unity', 'Player.log');
	defaultOptions.configFile = path.join(process.env.HOME, 'Library', 'Preferences', 'Blizzard', 'Hearthstone', 'log.config');
}

// The watcher is an event emitter so we can emit events based on what we parse in the log.
class LogWatcher extends EventEmitter {
	constructor(options) {
		super();

		this.options = extend({}, defaultOptions, options);
		this.parserState = new ParserState();
		this._lastFileSize = 0;
		this.update = debounce(this.update, 100);

		log.main('config file path: %s', this.options.configFile);
		log.main('log file path: %s', this.options.logFile);

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
		log.main('Copied log.config file to force Hearthstone to write to its log file.');
	}

	start() {
		this.parserState.reset();
		log.main('Log watcher started.');

		// Begin watching the Hearthstone log file.
		const watcher = chokidar.watch(this.options.logFile, {
			persistent: true,
			disableGlobbing: true,
			usePolling: true
		});

		watcher.on('add', (path, stats) => {
			this.update(path, stats);
		});

		watcher.on('change', (path, stats) => {
			this.update(path, stats);
		});

		this._watcher = watcher;
	}

	update(path, stats) {
		// We're only going to read the portion of the file that we have not read so far.
		const newFileSize = stats.size;
		let sizeDiff = newFileSize - this._lastFileSize;
		if (sizeDiff < 0) {
			sizeDiff = newFileSize;
		}

		const buffer = Buffer.alloc(sizeDiff);
		const fileDescriptor = fs.openSync(path, 'r');
		fs.readSync(fileDescriptor, buffer, 0, sizeDiff, this._lastFileSize);
		fs.closeSync(fileDescriptor);
		this._lastFileSize = newFileSize;

		this.parseBuffer(buffer, this.parserState);
	}

	stop() {
		if (this._watcher) {
			this._watcher.close();
			this._watcher = null;
			this._lastFileSize = 0;
		}
	}

	parseBuffer(buffer, parserState) {
		if (!parserState) {
			parserState = new ParserState();
		}

		// Iterate over each line in the buffer.
		splitLines(buffer.toString()).forEach(line => {
			// Run each line through our entire array of line parsers.
			lineParsers.forEach(lineParser => {
				lineParser(line, parserState, this, log);
			});

			// // Check when both mulligans are complete
			// var gameReadyRegex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=GameEntity tag=STEP value=MAIN_READY$/;
			// if(gameReadyRegex.test(line)) {
			//   friendlyCount = 30;
			//   opposingCount = 30;
			// }
		});

		return parserState;
	}
}

// Set the entire module to our emitter.
module.exports = LogWatcher;
