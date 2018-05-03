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
    getPlayerById(index) {
        return this.players.find(player => player.id === index);
    }
    getPlayerByPosition(position) {
        return this.getPlayerById(position === 'top' ? 1 : 2);
    }
    getPlayerByName(name) {
        return this.players.find(player => player.name === name);
    }
}
exports.GameState = GameState;
//# sourceMappingURL=GameState.js.map