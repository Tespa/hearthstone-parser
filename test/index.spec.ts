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
				gameOverCount: 2,
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
				'game-over': 2,
				'game-start': 2,
				'player-joined': 4,
				'zone-change': 237,
				'turn-change': 36
			});
		});
	});

	describe('foo', () => {
		const fooFileFixture = path.join(__dirname, '/artifacts/wrong_turns.log');
		beforeEach(function () {
			this.logWatcher = new LogWatcher({
				logFile: fooFileFixture,
				configFile: configFileFixture
			});
		});

		it('bar', function () {
			const logBuffer = fs.readFileSync(fooFileFixture);
			const gameState = this.logWatcher.parseBuffer(logBuffer);
			gameState.should.deep.equal({
				friendlyCount: 25,
				gameOverCount: 0,
				opposingCount: 26,
				players: [
					{
						id: 1,
						name: 'HCTObs3#1745',
						status: '',
						turn: true
					},
					{
						id: 2,
						name: 'HCTObs1#1891',
						status: '',
						turn: false
					}
				]
			});
		});
	});
});
