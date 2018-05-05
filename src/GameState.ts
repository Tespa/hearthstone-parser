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

	get numPlayers() {
		return this.players.length;
	}

	reset() {
		this.players = [];
		this.gameOverCount = 0;
		this.friendlyCount = 0;
		this.opposingCount = 0;
	}

	addPlayer(player: Player) {
		this.players.push(player);
		return player;
	}

	getPlayerById(index: number) {
		return this.players.find(player => player.id === index);
	}

	getPlayerByPosition(position: 'top' | 'bottom') {
		return this.getPlayerById(position === 'top' ? 2 : 1);
	}

	getPlayerByName(name: string) {
		return this.players.find(player => player.name === name);
	}

	getAllPlayers() {
		return this.players.slice(0);
	}
}
