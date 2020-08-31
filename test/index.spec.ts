'use strict';

// Native
import * as fs from 'fs';
import * as path from 'path';

// Packages
import {should, expect} from 'chai';
import * as mockdate from 'mockdate';

// Ours
import {LogWatcher, GameState, Player} from '../src';

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

			expect(gameState).deep.equal({
				players: [
					{
						id: 1,
						name: 'SpookyPatron#1959',
						status: 'WON',
						turn: false,
						quests: [{cardName: 'Fire Plume\'s Heart', class: 'WARRIOR', progress: 6, requirement: 7, sidequest: false, timestamp: date.getTime()}],
						timeout: 75,
						cardCount: 16,
						secrets: [],
						position: 'bottom',
						cardsReplacedInMulligan: 1,
						discovery: {enabled: false, id: '3'},
						cards: [{state: 'DECK', cardEntityId: 4, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 5, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 6, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 7, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 8, cardId: 47825, cardName: 'Militia Commander', isSpawnedCard: true}, {state: 'HAND', cardEntityId: 9, cardId: 47133, cardName: 'Town Crier', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 10, cardId: 41406, cardName: 'Cornered Sentry', isSpawnedCard: true}, {state: 'HAND', cardEntityId: 11, cardId: 49184, cardName: 'Zilliax', isSpawnedCard: true}, {state: 'DECK', cardEntityId: 12, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 13, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 14, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 15, cardId: 41427, cardName: 'Fire Plume\'s Heart', isSpawnedCard: true}, {state: 'HAND', cardEntityId: 16, cardId: 75, cardName: 'Brawl', isSpawnedCard: true}, {state: 'DECK', cardEntityId: 17, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 18, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 19, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 20, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'HAND', cardEntityId: 21, cardId: 1023, cardName: 'Shield Block', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 22, cardId: 41243, cardName: 'Stonehill Defender', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 23, cardId: 46031, cardName: 'Drywhisker Armorer', isSpawnedCard: true}, {state: 'DECK', cardEntityId: 24, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 25, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 26, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 27, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 28, cardId: 50776, cardName: 'Amani War Bear', isSpawnedCard: true}, {state: 'DECK', cardEntityId: 29, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'HAND', cardEntityId: 30, cardId: 41243, cardName: 'Stonehill Defender', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 31, cardId: 1659, cardName: 'Acolyte of Pain', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 32, cardId: 47133, cardName: 'Town Crier', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 33, cardId: 46634, cardName: 'Phantom Militia', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 80, cardId: 1746, cardName: 'The Coin', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 102, cardId: 38738, cardName: 'Bloodhoof Brave', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 155, cardId: 46634, cardName: 'Phantom Militia', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 157, cardId: 46634, cardName: 'Phantom Militia', isSpawnedCard: true}]
					},
					{
						id: 2,
						name: 'SnarkyPatron#1301',
						status: 'LOST',
						turn: true,
						timeout: 75,
						cardCount: 18,
						secrets: [],
						quests: [],
						position: 'top',
						cardsReplacedInMulligan: 3,
						discovery: {enabled: false, id: null},
						cards: [{state: 'HAND', cardEntityId: 34, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 37, cardId: 493, cardName: 'Force of Nature', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 38, cardId: 52819, cardName: 'The Forest\'s Aid', isSpawnedCard: true}, {state: 'DECK', cardEntityId: 39, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 40, cardId: 51781, cardName: 'Crystalsong Portal', isSpawnedCard: true}, {state: 'DECK', cardEntityId: 41, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 42, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 43, cardId: 52438, cardName: 'Archmage Vargoth', isSpawnedCard: true}, {state: 'HAND', cardEntityId: 44, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 45, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 46, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 47, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 48, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 49, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'HAND', cardEntityId: 50, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 51, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 54, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'HAND', cardEntityId: 55, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 56, cardId: 742, cardName: 'Savage Roar', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 57, cardId: 52810, cardName: 'Dreamway Guardians', isSpawnedCard: true}, {state: 'DECK', cardEntityId: 58, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 61, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 62, cardId: 836, cardName: 'Wrath', isSpawnedCard: true}, {state: 'DECK', cardEntityId: 65, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 66, cardId: 51790, cardName: 'Acornbearer', isSpawnedCard: true}, {state: 'DECK', cardEntityId: 67, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 68, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 69, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 72, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'DECK', cardEntityId: 75, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 106, cardId: 54315, cardName: 'Squirrel', isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 107, cardId: 54315, cardName: 'Squirrel', isSpawnedCard: true}, {state: 'HAND', cardEntityId: 124, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'OTHERS', cardEntityId: 125, cardId: 40973, cardName: 'Shellshifter', isSpawnedCard: true}, {state: 'HAND', cardEntityId: 128, cardId: undefined, cardName: undefined, isSpawnedCard: true}, {state: 'HAND', cardEntityId: 148, cardId: undefined, cardName: undefined, isSpawnedCard: true}]
					}
				],
				gameOverCount: 2,
				mulliganActive: false,
				turnStartTime: date,
				matchLog: []
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
				attack: 65,
				'card-played': 56,
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
			expect(gameState.players[0].cardCount).to.equal(10);
			expect(gameState.players[1].cardCount).to.equal(16);
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
			const timestamp = date.getTime();
			expect(gameState.players[1].quests).to.deep.equal([]);
			expect(gameState.players[1].secrets).to.deep.equal([{
				cardClass: 'PALADIN',
				cardId: 'EX1_132',
				cardName: 'Eye for an Eye',
				timestamp
			},
			{
				cardClass: 'PALADIN',
				cardId: 'DAL_570',
				cardName: 'Never Surrender!',
				timestamp
			},
			{
				cardClass: 'PALADIN',
				cardId: 'GIL_903',
				cardName: 'Hidden Wisdom',
				timestamp
			},
			{
				cardClass: 'PALADIN',
				cardId: 'EX1_379',
				cardName: 'Repentance',
				timestamp
			},
			{
				cardClass: 'PALADIN',
				cardId: 'BOT_908',
				cardName: 'Autodefense Matrix',
				timestamp
			}]);
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

describe('Gamestate', () => {
	describe('addPlayer', () => {
		it('should update names', () => {
			const basePlayer: Player = {
				id: 0,
				name: 'UNKNOWN HUMAN PLAYER',
				status: '',
				turn: false,
				timeout: 45,
				cardCount: 0,
				cards: [],
				position: 'bottom',
				secrets: [],
				quests: [],
				discovery: {
					enabled: false,
					id: null
				},
				cardsReplacedInMulligan: 0
			};

			const state = new GameState();
			state.addPlayer({...basePlayer, id: 1, name: 'hello'});
			state.addPlayer({...basePlayer, id: 2});
			state.addPlayer({...basePlayer, id: 2, name: 'world'});
			state.playerCount.should.equal(2, 'expected 2 players');
			state.getPlayerById(2)?.name.should.equal('world', 'expected name to update');
		});
	});
});
