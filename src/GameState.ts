export interface Player {
	id: number;
	name: string;
	status: string;
	turn: boolean;
}

export class GameState {
	playerCount: number;
	gameOverCount: number;
	friendlyCount: number;
	opposingCount: number;
	private players: Player[];

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

	addPlayer(player: Player) {
		this.players.push(player);
		return player;
	}

	getPlayerByIndex(index: number) {
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

	getPlayerByPosition(position: 'top' | 'bottom') {
		return this.getPlayerByIndex(position === 'top' ? 1 : 0);
	}

	getPlayerByName(name: string) {
		return this.players.find(player => player.name === name);
	}
}
