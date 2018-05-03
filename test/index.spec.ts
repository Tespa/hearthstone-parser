'use strict';

// Native
import * as fs from 'fs';
import * as path from 'path';

// Packages
import {should} from 'chai';

// Ours
import {LogWatcher} from '../src';

should(); // Initialize chai's "should" interface.

const logFileFixture = path.join(__dirname, '/artifacts/dummy.log');
const configFileFixture = path.join(__dirname, '/artifacts/dummy.config');

interface IEventCounters {
	[key: string]: number;
}

describe('hearthstone-log-watcher', () => {
	describe('constructor', () => {
		// Skipped for now because we throw errors if the paths don't exist.
		it.skip('should configure default options when none are passed in.', () => {
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
		beforeEach(function () {
			this.logWatcher = new LogWatcher({
				logFile: logFileFixture,
				configFile: configFileFixture
			});
		});

		it('should correctly parse the state tree', function () {
			const logBuffer = fs.readFileSync(logFileFixture);
			const gameState = this.logWatcher.parseBuffer(logBuffer);
			gameState.should.deep.equal({
				players: [
					{id: 1, name: 'Apple#1264', status: '', turn: false},
					{id: 2, name: 'Baquio#1418', status: '', turn: true}
				],
				playerCount: 0,
				gameOverCount: 0,
				friendlyCount: 11,
				opposingCount: 11
			});
		});

		it('should emit the expected number of events', function () {
			const logBuffer = fs.readFileSync(logFileFixture);
			const eventCounters = {} as IEventCounters;
			this.logWatcher.onAny((event: string) => {
				if (!(event in eventCounters)) {
					eventCounters[event] = 0;
				}

				eventCounters[event]++;
			});
			this.logWatcher.parseBuffer(logBuffer);

			eventCounters.should.deep.equal({
				'player-joined': 4,
				'game-start': 2,
				'zone-change': 236,
				'turn-change': 36
			});
		});
	});
});
