import {SecretClass} from './data/secrets';

export interface Secret {
	cardId: string;
	cardClass: SecretClass;
	cardName: string;
}

export interface Player {
	id: number;
	name: string;
	status: 'LOST' | 'WON' | 'TIED' | '';
	turn: boolean;
	questCounter: number;
	timeout: number;
	cardCount: number;
	position: 'top' | 'bottom';
	secrets: Secret[];
}

export class GameState {
	playerCount: number;

	gameOverCount: number;

	players: Player[];

	mulliganActive: boolean;

	turnStartTime: Date;

	constructor() {
		this.reset();
	}

	get numPlayers(): number {
		return this.players.length;
	}

	reset(): void {
		this.players = [];
		this.gameOverCount = 0;
	}

	addPlayer(player: Player): Player {
		this.players.push(player);
		return player;
	}

	getPlayerById(index: number): Player | undefined {
		return this.players.find(player => player.id === index);
	}

	getPlayerByPosition(position: 'top' | 'bottom'): Player | undefined {
		return this.players.find(player => player.position === position);
	}

	getPlayerByName(name: string): Player | undefined {
		return this.players.find(player => player.name === name);
	}

	getAllPlayers(): Player[] {
		return this.players.slice(0);
	}
}
