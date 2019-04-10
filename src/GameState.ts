export interface Player {
	id: number;
	name: string;
	status: string;
	turn: boolean;
	questCounter: number;
}

export class GameState {
	playerCount: number;

	gameOverCount: number;

	friendlyCount: number;

	opposingCount: number;

	players: Player[];

	constructor() {
		this.reset();
	}

	get numPlayers(): number {
		return this.players.length;
	}

	reset(): void {
		this.players = [];
		this.gameOverCount = 0;
		this.friendlyCount = 0;
		this.opposingCount = 0;
	}

	addPlayer(player: Player): Player {
		this.players.push(player);
		return player;
	}

	getPlayerById(index: number): Player | undefined {
		return this.players.find(player => player.id === index);
	}

	getPlayerByPosition(position: 'top' | 'bottom'): Player | undefined {
		return this.getPlayerById(position === 'top' ? 2 : 1);
	}

	getPlayerByName(name: string): Player | undefined {
		return this.players.find(player => player.name === name);
	}

	getAllPlayers(): Player[] {
		return this.players.slice(0);
	}
}
