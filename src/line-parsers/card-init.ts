import {LineParser} from './AbstractLineParser';
import {HspEventsEmitter} from './index';
import {GameState} from '../GameState';
import {createSimpleRegexParser, FullEntityReader} from './readers';

/**
 * Handles when entities are first created to add the entries to the gamestate.
 * Does nothing once mulligan phase has ended.
 */
export class CardInitParser extends LineParser {
	eventName = 'card-init';

	private readonly beginPhaseEndReader = createSimpleRegexParser(
		/\[LoadingScreen\] MulliganManager.HandleGameStart\(\) - IsPastBeginPhase\(\)=False/,
		_parts => ({ended: true})
	);

	private readonly fullEntityReader = new FullEntityReader('[Power] GameState.DebugPrintPower() -');

	handleLine(_emitter: HspEventsEmitter, gameState: GameState, line: string): boolean {
		// If this executes, the begin phase is done
		if (this.beginPhaseEndReader(line)) {
			gameState.beginPhaseActive = false;
			return true;
		}

		// Does nothing if mulligan is inactive
		// We should consider somehow detecting if we're in a block (aka only top level)
		if (gameState.active && gameState.beginPhaseActive) {
			const fullEntityResult = this.fullEntityReader.handleLine(line, gameState);
			if (fullEntityResult.result) {
				gameState.resolveEntity(fullEntityResult.result.entity);
				return true;
			}
		}

		return false;
	}
}
