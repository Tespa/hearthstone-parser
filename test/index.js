'use strict';

// Native
const fs = require('fs');
const path = require('path');

// Packages
require('chai').should();

// Ours
const LogWatcher = require('../index');

const logFileFixture = path.join(__dirname, '/artifacts/logan_log.txt');
const configFileFixture = path.join(__dirname, '/artifacts/dummy.config');

describe('hearthstone-log-watcher', () => {
	describe('constructor', () => {
		it('should configure default options when none are passed in.', () => {
			const logWatcher = new LogWatcher();
			logWatcher.should.have.property('options');
			logWatcher.options.should.have.property('logFile');
			logWatcher.options.should.have.property('configFile');
		});

		it('should override the options with passed in values.', () => {
			const logWatcher = new LogWatcher({
				logFile: logFileFixture,
				configFile: configFileFixture
			});

			logWatcher.should.have.property('options');
			logWatcher.options.should.have.property('logFile', logFileFixture);
			logWatcher.options.should.have.property('configFile', configFileFixture);
		});
	});

	describe('instance', () => {
		it('should allow the watcher to be started and stopped.', () => {
			const logWatcher = new LogWatcher({
				logFile: logFileFixture,
				configFile: configFileFixture
			});

			logWatcher.start();
			logWatcher.stop();
		});
	});

	describe('parsing', () => {
		beforeEach(() => {
			this.logWatcher = new LogWatcher({
				logFile: logFileFixture,
				configFile: configFileFixture,
				endOfLineChar: '\r\n'
			});
		});

		it('should correctly parse player deck sizes', () => {
			const logBuffer = fs.readFileSync(logFileFixture);
			const parserState = this.logWatcher.parseBuffer(logBuffer);
			parserState.friendlyCount.should.equal(11);
			parserState.opposingCount.should.equal(11);
		});
	});
});
