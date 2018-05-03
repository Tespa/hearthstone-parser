"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AbstractLineParser_1 = require("./AbstractLineParser");
// Check if the game is over.
class GameOverLineParser extends AbstractLineParser_1.AbstractLineParser {
    constructor() {
        super(...arguments);
        this.regex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=(.*) tag=PLAYSTATE value=(LOST|WON|TIED)/;
        this.eventName = 'game-over';
    }
    lineMatched(parts, gameState) {
        // Set the status for the appropriate player.
        const player = gameState.getPlayerByName(parts[0]);
        if (player) {
            player.status = parts[1];
        }
        gameState.gameOverCount++;
    }
    formatLogMessage(_parts, gameState) {
        if (gameState.gameOverCount === 2) {
            return 'The current game has ended.';
        }
        return false;
    }
    shouldEmit(gameState) {
        // When both players have lost, emit a game-over event.
        return gameState.gameOverCount === 2;
    }
}
exports.GameOverLineParser = GameOverLineParser;
//# sourceMappingURL=game-over.js.map