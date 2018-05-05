export interface Player {
    id: number;
    name: string;
    status: string;
    turn: boolean;
}
export declare class GameState {
    playerCount: number;
    gameOverCount: number;
    friendlyCount: number;
    opposingCount: number;
    private players;
    constructor();
    readonly numPlayers: number;
    reset(): void;
    addPlayer(player: Player): Player;
    getPlayerById(index: number): Player | undefined;
    getPlayerByPosition(position: 'top' | 'bottom'): Player | undefined;
    getPlayerByName(name: string): Player | undefined;
    getAllPlayers(): Player[];
}
