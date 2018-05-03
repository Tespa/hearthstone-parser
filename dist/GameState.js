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
    addPlayer(player) {
        this.players.push(player);
        return player;
    }
    getPlayerByIndex(index) {
        if (!this.players[index]) {
            this.players[index] = {
                id: 0,
                name: `Player ${index}`,
                status: 'unknown',
                turn: false
            };
        }
        return this.players[index];
    }
    getPlayerByPosition(position) {
        return this.getPlayerByIndex(position === 'top' ? 1 : 0);
    }
    getPlayerByName(name) {
        return this.players.find(player => player.name === name);
    }
}
exports.GameState = GameState;
//# sourceMappingURL=GameState.js.map