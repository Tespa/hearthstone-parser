import {HspEventsEmitter} from './index';
import {LineParser} from './AbstractLineParser';
import {GameState} from '../GameState';
import {createSimpleRegexParser} from './readers';

export class DiscoveryParser extends LineParser {
	eventName = 'discovery' as const;

	private readonly discoverStartReader = createSimpleRegexParser(
		/^\[Power\]\s+GameState\.DebugPrintEntityChoices\(\)\s+-\s+id=(\w+)\s+Player=(.*)\s+TaskList=.*\s+ChoiceType=GENERAL/,
		parts => ({choiceId: parts[1], playerName: parts[2]})
	);

	private readonly discoverShownReader = createSimpleRegexParser(
		/^\[Power\]\s+ChoiceCardMgr\.WaitThenShowChoices\(\)\s+-\s+id=(\w+)\s+BEGIN/,
		parts => ({choiceId: parts[1]})
	);

	private readonly discoverEndReader = createSimpleRegexParser(
		/^\[Power\]\s+ChoiceCardMgr\.WaitThenHideChoicesFromPacket\(\)\s+-\s+id=(\w+)\s+END\s+WAIT/,
		parts => ({choiceId: parts[1]})
	);

	handleLine(emitter: HspEventsEmitter, gameState: GameState, line: string): boolean {
		const start = this.discoverStartReader(line);
		if (start) {
			this._handleDiscoverStart(gameState, start);
			return true;
		}

		const shown = this.discoverShownReader(line);
		if (shown) {
			this._handleDiscoverShown(emitter, gameState, shown.choiceId);
			return true;
		}

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

		player.discovery.id = choiceId;
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
			this.logger(`Discovery has ended for choice ID ${choiceId}`);
		}

		// Note: Previous versions always emit, so this is like this so tests continue to work.
		// Do we want to change that behavior?
		emitter.emit('discovery-end');
	}
}
