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
					{id: 1, name: 'SpookyPatron#1959', status: 'WON', turn: false, quest: {progress: 6, requirement: 7}, timeout: 75, cardCount: 16, secrets: [], position: 'bottom', cardsReplacedInMulligan: 1, discovery: {enabled: false, id: '3'}},
					{id: 2, name: 'SnarkyPatron#1301', status: 'LOST', turn: true, timeout: 75, cardCount: 18, secrets: [], position: 'top', cardsReplacedInMulligan: 3, discovery: {enabled: false, id: null}}
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
				'discovery-end': 2,
				'discovery-start': 2,
				'gamestate-changed': 1,
				'game-over': 2,
				'game-start': 2,
				'game-tag-change': 2102,
				'player-joined': 4,
				'zone-change': 360,
				'turn-change': 66,
				'tag-change': 3066,
				'mulligan-result': 4
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
					{id: 1, name: 'SnarkyPatron#1301', status: '', turn: false, timeout: 75, cardCount: 10, secrets: [], position: 'bottom', cardsReplacedInMulligan: 4, discovery: {enabled: false, id: null}},
					{id: 2, name: 'SpookyPatron#1959', status: '', turn: true, timeout: 75, cardCount: 16, secrets: [], position: 'top', cardsReplacedInMulligan: 3, discovery: {enabled: false, id: '7'}}
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
					{id: 1, name: 'SnarkyPatron#1301', status: 'WON', turn: true, timeout: 75, cardCount: 15, position: 'top', secrets: [], cardsReplacedInMulligan: 4, discovery: {enabled: false, id: null}},
					{id: 2, name: 'YAYtears#1552', status: 'LOST', turn: false, timeout: 75, cardCount: 12, position: 'bottom', cardsReplacedInMulligan: 2, discovery: {enabled: false, id: null},
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

		it('should correctly handle discovery of bottom', () => {
			const logFilePath = path.resolve(__dirname, 'artifacts/discovery-bottom.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const eventCounters: EventCounters = {};
			logWatcher.onAny((event: string) => {
				if (!(event in eventCounters)) {
					eventCounters[event] = 0;
				}

				eventCounters[event]++;
			});
			const logBuffer = fs.readFileSync(logFilePath);
			logWatcher.parseBuffer(logBuffer);

			expect(eventCounters['discovery-start']).to.equal(1);
			expect(eventCounters['discovery-end']).to.equal(1);
		});

		it('should correctly handle discovery of top', () => {
			const logFilePath = path.resolve(__dirname, 'artifacts/discovery-top.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const eventCounters: EventCounters = {};
			logWatcher.onAny((event: string) => {
				if (!(event in eventCounters)) {
					eventCounters[event] = 0;
				}

				eventCounters[event]++;
			});
			const logBuffer = fs.readFileSync(logFilePath);
			logWatcher.parseBuffer(logBuffer);

			expect(eventCounters['discovery-start']).to.equal(1);
			expect(eventCounters['discovery-end']).to.equal(1);
		});

		it('should correctly handle discovery with Spirit of the Shark', () => {
			const logFilePath = path.resolve(__dirname, 'artifacts/discovery-double.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const eventCounters: EventCounters = {};
			logWatcher.onAny((event: string) => {
				if (!(event in eventCounters)) {
					eventCounters[event] = 0;
				}

				eventCounters[event]++;
			});
			const logBuffer = fs.readFileSync(logFilePath);
			logWatcher.parseBuffer(logBuffer);

			expect(eventCounters['discovery-start']).to.equal(2);
			expect(eventCounters['discovery-end']).to.equal(2);
		});

		it('should correctly handle a new game', () => {
			const logFilePath = path.resolve(__dirname, 'artifacts/new-game.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const logBuffer = fs.readFileSync(logFilePath);
			const gameState = logWatcher.parseBuffer(logBuffer);
			expect(gameState.players.length).to.equal(2);
			expect(gameState.mulliganActive).to.equal(true);
			expect(gameState.players[0].status).to.equal('');
			expect(gameState.players[1].status).to.equal('');
			expect(gameState.players[0].position).not.to.equal(gameState.players[1].position);
		});

		it('should correctly end mulligan', () => {
			const logFilePath = path.resolve(__dirname, 'artifacts/mulligan-end.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const logBuffer = fs.readFileSync(logFilePath);
			const gameState = logWatcher.parseBuffer(logBuffer);
			expect(gameState.mulliganActive).to.equal(false);
		});

		it('should correctly count cards replaced in mulligan', () => {
			const logFilePath = path.resolve(__dirname, 'artifacts/mulligan-card-count.log');
			const logWatcher = new LogWatcher({
				logFile: logFilePath,
				configFile: configFileFixture
			});
			const logBuffer = fs.readFileSync(logFilePath);
			const gameState = logWatcher.parseBuffer(logBuffer);
			// 2, 4
			expect(gameState.getPlayerByPosition('bottom')!.cardsReplacedInMulligan).to.equal(2);
			expect(gameState.getPlayerByPosition('top')!.cardsReplacedInMulligan).to.equal(4);
		});
	});
});
