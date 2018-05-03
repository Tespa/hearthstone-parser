"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class GameState {
    constructor() {
        this.reset();
    }
    reset() {
        this.players = [];
        this.playerCount = 0;
        this.gameOverCount = 0;
        this.friendlyCount = 0;
        this.opposingCount = 0;
    }
}
exports.GameState = GameState;
//# sourceMappingURL=GameState.js.map