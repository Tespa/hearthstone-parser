export interface Player {
	id: number;
	name: string;
	status: string;
}

export class GameState {
	players: Player[];
	playerCount: number;
	gameOverCount: number;
	friendlyCount: number;
	opposingCount: number;

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
