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
    reset(): void;
    addPlayer(player: Player): Player;
    getPlayerByIndex(index: number): Player;
    getPlayerByPosition(position: 'top' | 'bottom'): Player;
    getPlayerByName(name: string): Player | undefined;
}
