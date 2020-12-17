import {HspEventsEmitter} from './index';
import {LineParser} from './AbstractLineParser';
import {Discovery, GameState, simplifyEntity} from '../GameState';
import {createSimpleRegexParser, readEntityString} from './readers';
import {cloneDeep} from 'lodash';

export class DiscoveryParser extends LineParser {
	eventName = 'discovery' as const;

	private readonly discoverStartReader = createSimpleRegexParser(
		/^\[Power\]\s+GameState\.DebugPrintEntityChoices\(\)\s+-\s+id=(\w+)\s+Player=(.*)\s+TaskList=.*\s+ChoiceType=GENERAL/,
		parts => ({choiceId: parts[1], playerName: parts[2]})
	);

	private readonly discoverSourceReader = createSimpleRegexParser(
		/^\[Power\]\s+GameState\.DebugPrintEntityChoices\(\)\s-\s+Source=(.*)/,
		parts => ({entityString: parts[1]})
	);

	private readonly discoverOptionReader = createSimpleRegexParser(
		/^\[Power\]\s+GameState\.DebugPrintEntityChoices\(\)\s-\s+Entities\[([0-9]+)\]=(.*)/,
		parts => ({position: Number(parts[1]), entityString: parts[2]})
	);

	private readonly discoverShownReader = createSimpleRegexParser(
		/^\[Power\]\s+ChoiceCardMgr\.WaitThenShowChoices\(\)\s+-\s+id=(\w+)\s+BEGIN/,
		parts => ({choiceId: parts[1]})
	);

	private readonly discoverChosenReader = createSimpleRegexParser(
		/^\[Power\]\s+GameState\.DebugPrintEntitiesChosen\(\)\s+-\s+Entities\[([0-9]+)\]=(.*)/,
		parts => ({position: Number(parts[1]), entityString: parts[2]})
	);

	private readonly discoverEndReader = createSimpleRegexParser(
		/^\[Power\]\s+ChoiceCardMgr\.WaitThenHideChoicesFromPacket\(\)\s+-\s+id=(\w+)\s+END\s+WAIT/,
		parts => ({choiceId: parts[1]})
	);

	private currentDiscover: Discovery | undefined;

	handleLine(emitter: HspEventsEmitter, gameState: GameState, line: string): boolean {
		// Detect that discovery is about to start
		const start = this.discoverStartReader(line);
		if (start) {
			this._handleDiscoverStart(gameState, start);
			return true;
		}

		// Detect discover source (the card that triggered it)
		const sourceData = this.discoverSourceReader(line);
		if (sourceData) {
			const source = readEntityString(sourceData.entityString, gameState);
			if (this.currentDiscover && source?.type === 'card') {
				this.currentDiscover.source = simplifyEntity(source);
			}

			return true;
		}

		// Detect discover options
		const optionData = this.discoverOptionReader(line);
		if (optionData) {
			const option = readEntityString(optionData.entityString, gameState);
			if (this.currentDiscover && option?.type === 'card') {
				this.currentDiscover.options.push(simplifyEntity(option));
			}

			return true;
		}

		// Detect that discover was shown to the player
		// This occurs AFTER source and options
		const shown = this.discoverShownReader(line);
		if (shown) {
			this._handleDiscoverShown(emitter, gameState, shown.choiceId);
			return true;
		}

		// Detect what the player selected
		const chosenData = this.discoverChosenReader(line);
		if (chosenData) {
			const option = readEntityString(chosenData.entityString, gameState);
			if (this.currentDiscover && option?.type === 'card') {
				this.currentDiscover.chosen = simplifyEntity(option);
			}

			return true;
		}

		// Detect that discover has finished
		const end = this.discoverEndReader(line);
		if (end) {
			this._handleDiscoverEnd(emitter, gameState, end.choiceId);
			return true;
		}

		return false;
	}

	/**
	 * Called when a discover is about to start.
	 * @param gameState
	 * @param data player and choice id of the discover that is being built
	 */
	private _handleDiscoverStart(gameState: GameState, data: {choiceId: string; playerName: string}) {
		const {choiceId, playerName} = data;
		const player = gameState.getPlayerByName(playerName);
		if (!player) {
			return;
		}

		player.discovery = {
			id: choiceId,
			enabled: false,
			options: []
		};

		this.currentDiscover = player.discovery;
		this.logger(`Choice ID ${choiceId} is registered for ${playerName}`);
	}

	/**
	 * Called when discover choices are shown to the player.
	 * @param emitter
	 * @param gameState
	 * @param choiceId choice id of the discovery that is showing
	 */
	private _handleDiscoverShown(emitter: HspEventsEmitter, gameState: GameState, choiceId: string) {
		const player = gameState.players.find(player => player.discovery.id === choiceId);
		if (player) {
			player.discovery.enabled = true;
			this.logger(`Discovery has started for choice ID ${choiceId}`);
		}

		// Note: Previous versions always emit, so this is like this so tests continue to work.
		// Do we want to change that behavior?
		emitter.emit('discovery-start');
	}

	/**
	 * Called when discover choices are ended for the player
	 * @param emitter
	 * @param gameState
	 * @param choiceId choice id of the discovery that is ending
	 */
	private _handleDiscoverEnd(emitter: HspEventsEmitter, gameState: GameState, choiceId: string) {
		const player = gameState.players.find(player => player.discovery.id === choiceId);
		if (player) {
			player.discovery.enabled = false;
			player.discoverHistory.push(cloneDeep(player.discovery));
			this.logger(`Discovery has ended for choice ID ${choiceId}`);
		}

		// Note: Previous versions always emit, so this is like this so tests continue to work.
		// Do we want to change that behavior?
		emitter.emit('discovery-end');
	}
}
