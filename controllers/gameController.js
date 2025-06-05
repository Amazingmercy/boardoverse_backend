const GameService = require('../services/gameService')


class GameController {
    constructor(io, socket) {
        this.io = io;
        this.socket = socket;
        this.service = GameService.getInstance();
    }

    registerHandlers() {
        this.socket.on("createGame", (opts, cb) => this.createGame(opts, cb));
        this.socket.on("joinGame", (id, cb) => this.joinGame(id, cb));
        this.socket.on("getBoardPaths", (cb) => this.generateBoardPaths(cb));
        this.socket.on("rollDice", () => this.rollDice());
        this.socket.on("playRoll", (data) => this.playRoll(data));
        this.socket.on("skipTurn", () => this.skipTurn());
        this.socket.on("disconnect", () => this.disconnect());

        console.log(`Socket connected: ${this.socket.id}`);
        return this;
    }

    createGame({ vsComputer }, cb) {
        try {
            setInterval(() => this.service.cleanupOldGames(), 3600000);
            const game = this.service.createGame(this.socket.id, vsComputer);
            this.socket.join(game.id);
            cb({ gameId: game.id, playerId: 0, colors: game.players[0].colors });
            if (vsComputer) {
                // Immediately broadcast initial state for AI games
                this.broadcastState(game);
            }
        } catch (error) {
            console.error("Error creating game:", error);
            cb({ error: error.message || "Could not create game" });
        }
    }

    generateBoardPaths(cb) {
        try {
            const boardPaths = this.service.generateBoardPaths();
            // Send response to the requesting client
            if (cb && typeof cb === 'function') {
                cb(boardPaths);
            }
        } catch (error) {
            console.error("Error generating board paths:", error);
            if (cb && typeof cb === 'function') {
                cb({ error: error.message || "Could not generate board paths" });
            }
        }
    }

    joinGame(gameId, cb) {
        try {
            const game = this.service.joinGame(this.socket.id, gameId);
            this.socket.join(game.id);
            const p = game.players.find((p) => p.id === this.socket.id);
            cb({ gameId: game.id, playerId: p.playerIndex, colors: p.colors });
            this.broadcastState(game);
        } catch (e) {
            console.error("Error joining game:", e);
            cb({ error: e.message });
        }
    }

    rollDice() {
        try {
            const game = this.service.rollDice(this.socket.id);
            this.broadcastDice(game);
            this.broadcastState(game);
        } catch (error) {
            console.error("Error rolling dice:", error);
            this.socket.emit("error", { message: error.message });
        }
    }

    playRoll({ tokenId, rolledValue }) {
        try {
            const game = this.service.playRoll(this.socket.id, tokenId, rolledValue);
            this.broadcastState(game);
        } catch (error) {
            console.error("Error playing roll:", error);
            this.socket.emit("error", { message: error.message });
        }
    }

    skipTurn() {
        try {
            const game = this.service.skipTurn(this.socket.id);
            this.broadcastState(game);
        } catch (error) {
            console.error("Error skipping turn:", error);
            this.socket.emit("error", { message: error.message });
        }
    }


    disconnect() {
        try {
            const gameId = this.service.handleDisconnect(this.socket.id);
            if (gameId) {
                this.io.to(gameId).emit("playerDisconnected");
                console.log(`Player ${this.socket.id} disconnected from game ${gameId}`);
            }
        } catch (error) {
            console.error("Error handling disconnect:", error);
        }
    }

    broadcastDice(game) {
        if (!game || !game.players) return;

        const payload = {
            dice: Array.isArray(game.rolledValue) ? [...game.rolledValue] : []
        };

        game.players.forEach((p) => {
            if (p.id !== "AI") {
                this.io.to(p.id).emit("diceRolled", {
                    playerId: game.currentPlayer,
                    dice: Array.isArray(game.rolledValue) ? [...game.rolledValue] : [],
                });
            }
        });
    }

    broadcastState(game) {
        if (!game || !game.players) return;

        game.players.forEach((p) => {
            if (p.id !== "AI") {
                try {
                    const payload = this.composePayload(game, p.id);
                    this.io.to(p.id).emit("gameStateUpdated", payload);
                } catch (error) {
                    console.error("Error composing payload for player", p.id, error);
                }
            }
        });
    }

    composePayload(game, socketId) {
        try {
            const base = this.service.buildGameState(game.id);
            const player = game.players.find((p) => p.id === socketId);
            const playerIndex = player ? player.playerIndex : -1;

            const playData = {
                tokens: base.tokens,
                dice: base.dice,
                myTurn: playerIndex === game.currentPlayer,
                gameOver: game.gameOver,
                winner: game.winners.length ? game.winners[0] : null,
            };
            return playData;
        } catch (error) {
            console.error("Error composing payload:", error);
            return {
                tokens: [],
                dice: [],
                myTurn: false,
                gameOver: false,
                winner: null,
            };
        }
    }
}

module.exports = GameController;