export interface Player {
    id: number;
    name: string;
    status: string;
}
export declare class GameState {
    players: Player[];
    playerCount: number;
    gameOverCount: number;
    friendlyCount: number;
    opposingCount: number;
    constructor();
    reset(): void;
}
