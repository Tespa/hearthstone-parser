'use strict';

// Native
import * as fs from 'fs';
import * as path from 'path';

// Packages
import {should, expect} from 'chai';
import * as mockdate from 'mockdate';

// Ours
import {LogWatcher} from '../src';

should(); // Initialize chai's "should" interface.

const logFileFixture = path.join(__dirname, '/artifacts/dummy.log');
const configFileFixture = path.join(__dirname, '/artifacts/dummy.config');

interface EventCounters {
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
			const date = new Date();
			mockdate.set(date);
			const gameState = this.logWatcher.parseBuffer(logBuffer);
			mockdate.reset();

			gameState.should.deep.equal({
				players: [
					{id: 1, name: 'SpookyPatron#1959', status: 'WON', turn: false, questCounter: 6, timeout: 75, cardCount: 16, secrets: [], position: 'bottom'},
					{id: 2, name: 'SnarkyPatron#1301', status: 'LOST', turn: true, questCounter: -1, timeout: 75, cardCount: 18, secrets: [], position: 'top'}
				],
				gameOverCount: 2,
				mulliganActive: false,
				turnStartTime: date
			});
		});

		it('should emit the expected number of events', function () {
			const logBuffer = fs.readFileSync(logFileFixture);
			const eventCounters: EventCounters = {};
			this.logWatcher.onAny((event: string) => {
				if (!(event in eventCounters)) {
					eventCounters[event] = 0;
				}

				eventCounters[event]++;
			});
			this.logWatcher.parseBuffer(logBuffer);

			eventCounters.should.deep.equal({
				'gamestate-changed': 1,
				'game-over': 2,
				'game-start': 2,
				'game-tag-change': 2236,
				'player-joined': 4,
				'zone-change': 360,
				'turn-change': 66,
				'tag-change': 2936
			});
		});

		it('should correctly handle a togwaggle deck swap', () => {
			const logFilePath = path.join(__dirname, '/artifacts/togwaggle_deck_swap.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const date = new Date();
			mockdate.set(date);
			const logBuffer = fs.readFileSync(logFilePath);
			const gameState = logWatcher.parseBuffer(logBuffer);
			mockdate.reset();
			gameState.should.deep.equal({
				players: [
					{id: 1, name: 'SnarkyPatron#1301', status: '', turn: false, questCounter: -1, timeout: 75, cardCount: 10, secrets: [], position: 'bottom'},
					{id: 2, name: 'SpookyPatron#1959', status: '', turn: true, questCounter: -1, timeout: 75, cardCount: 16, secrets: [], position: 'top'}
				],
				gameOverCount: 0,
				mulliganActive: false,
				turnStartTime: date
			});
		});

		it('should correctly handle secrets', () => {
			const logFilePath = path.join(__dirname, '/artifacts/secrets_test.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const date = new Date();
			mockdate.set(date);
			const logBuffer = fs.readFileSync(logFilePath);
			const gameState = logWatcher.parseBuffer(logBuffer);
			mockdate.reset();
			gameState.should.deep.equal({
				players: [
					{id: 1, name: 'SnarkyPatron#1301', status: 'WON', turn: true, questCounter: -1, timeout: 75, cardCount: 15, position: 'top', secrets: []},
					{id: 2, name: 'YAYtears#1552', status: 'LOST', turn: false, questCounter: -1, timeout: 75, cardCount: 12, position: 'bottom',
						secrets: [{
							cardClass: 'PALADIN',
							cardId: 'EX1_132',
							cardName: 'Eye for an Eye'
						},
						{
							cardClass: 'PALADIN',
							cardId: 'DAL_570',
							cardName: 'Never Surrender!'
						},
						{
							cardClass: 'PALADIN',
							cardId: 'GIL_903',
							cardName: 'Hidden Wisdom'
						},
						{
							cardClass: 'PALADIN',
							cardId: 'EX1_379',
							cardName: 'Repentance'
						},
						{
							cardClass: 'PALADIN',
							cardId: 'BOT_908',
							cardName: 'Autodefense Matrix'
						}]}
				],
				gameOverCount: 2,
				mulliganActive: false,
				turnStartTime: date
			});
		});

		it('should correctly handle tied game', () => {
			const logFilePath = path.resolve(__dirname, 'artifacts/game_over_tied.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const logBuffer = fs.readFileSync(logFilePath);
			const gamestate = logWatcher.parseBuffer(logBuffer);

			expect(gamestate.gameOverCount).to.equal(2);
			expect(gamestate.players[0].status).to.equal('TIED');
			expect(gamestate.players[1].status).to.equal('TIED');
		});

		it('should correctly handle game over', () => {
			const logFilePath = path.resolve(__dirname, 'artifacts/game_over.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const logBuffer = fs.readFileSync(logFilePath);
			const gamestate = logWatcher.parseBuffer(logBuffer);

			expect(gamestate.gameOverCount).to.equal(2);
			expect(gamestate.players[0].status).to.equal('LOST');
			expect(gamestate.players[1].status).to.equal('WON');
		});

		it('should not update turn start time until new turn animation', () => {
			const logFilePath = path.resolve(__dirname, 'artifacts/long-animation-end-of-turn.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const logBuffer = fs.readFileSync(logFilePath);
			const gameState = logWatcher.parseBuffer(logBuffer);
			expect(gameState.turnStartTime).equal(undefined);
		});

		it('should correctly handle a new turn', () => {
			const logFilePath = path.resolve(__dirname, 'artifacts/new-turn.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const date = new Date();
			mockdate.set(date);
			const logBuffer = fs.readFileSync(logFilePath);
			const gameState = logWatcher.parseBuffer(logBuffer);
			mockdate.reset();
			expect(gameState.turnStartTime.getTime()).equal(date.getTime());
		});
	});
});
