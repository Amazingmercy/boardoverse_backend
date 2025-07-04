/**
 * GameService.js
 * Manages game state and operations for Ludo-like board game
 * Handles game creation, player management, and game state transitions
 */

const { v4: uuidv4 } = require("uuid");
const Logic = require('../gameLogic.js');
const path = require('path')
const fs = require("fs");

/**
 * GameService class provides game management functionality
 * Implemented as a singleton to ensure consistent game state across the application
 */
class GameService {
    /**
     * Initialize the game service with empty collections
     */
    constructor() {
        // Store active games indexed by game ID
        this.games = {};
        // Map socket IDs to game IDs for quick lookup
        this.playerSockets = {};
        this.SAVE_DIR = path.join(__dirname, 'game_states'); // Folder for saves
        this._ensureSaveDir();
    }

    // Create directory if it doesn't exist
    _ensureSaveDir() {
        if (!fs.existsSync(this.SAVE_DIR)) {
            fs.mkdirSync(this.SAVE_DIR);
        }
    }
    /**
     * Singleton pattern implementation to ensure only one instance exists
     * @returns {GameService} The singleton instance of GameService
     */
    static getInstance() {
        return this.instance || (this.instance = new GameService());

    }

    saveGameState(gameId) {
        const game = this.games[gameId];
        if (!game) return;

        const filePath = path.join(this.SAVE_DIR, `${gameId}.json`);

        // Create save-safe version (remove sockets and timers)
        const dataToSave = {
            ...game,
            players: game.players.map(player => ({
                playerId: player.playerId,
                playerIndex: player.playerIndex,
                colors: player.colors,
                tokens: player.tokens
            })),
            tokens: game.tokens,
            currentPlayer: game.currentPlayer,
            diceValue: game.diceValue,
            gameOver: game.gameOver,
            rolledValue: game.rolledValue,
            vsComputer: game.vsComputer,
            createdAt: game.createdAt
        };

        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
    }

    // Load game state from file
    loadGameState(gameId) {
        const filePath = path.join(this.SAVE_DIR, `${gameId}.json`);
        if (!fs.existsSync(filePath)) return null;

        const rawData = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(rawData);
    }


    // Initialize game from saved state (if available)
    initializeGame(gameId) {
        const savedState = this.loadGameState(gameId);
        if (!savedState) return null;

        // Restore game state with proper defaults
        const restoredGame = {
            ...savedState,
            // Players need socket-related properties initialized
            players: savedState.players.map(p => ({
                ...p,
                id: null,  // Will be set when player rejoins
                disconnected: true,
                disconnectTimer: null,
                // Ensure all required player properties exist
                tokens: p.tokens || [],
                colors: p.colors || (p.playerIndex === 0 ? ['red', 'yellow'] : ['green', 'blue'])
            })),

            // Initialize volatile properties
            playerSockets: {},
            lastActivity: Date.now(),

            // Ensure game flow properties exist
            currentRolls: savedState.currentRolls || [],
            rolledValue: savedState.rolledValue || [],
            diceValue: savedState.diceValue || 0,


            // Initialize timers and AI if needed
            aiTimer: null,

            // Ensure tokens exist and are properly formatted
            tokens: savedState.tokens || Logic.initializeTokens()
        };

        this.games[gameId] = restoredGame;
        console.log(`Successfully loaded game ${gameId} from saved state`);
        return restoredGame;
    }


    /**
     * Create a new game instance
     * @param {string} socketId - The socket ID of the player creating the game
     * @param {boolean} vsComputer - Whether this is a single-player game against AI
     * @returns {Object} The newly created game object
     */
    createGame(socketId, vsComputer, playerId) {
        // Generate a short, unique game ID
        const id = uuidv4().slice(0, 6);

        // Initialize players array with the creator
        const players = [{ playerId, id: socketId, playerIndex: 0, colors: ['red', 'yellow'] }];

        // Add AI player if single-player mode
        if (vsComputer) players.push({ playerId: 'AI', id: 'AI', playerIndex: 1, colors: ['green', 'blue'] });

        // Create game state object
        const game = {
            id,
            players,
            currentPlayer: 0,
            originalRolls: [],        // Store original dice rolls
            currentRolls: [],         // Remaining dice rolls to be used
            rolledValue: [],          // Store the rolled value for the current turn
            gameStarted: !!vsComputer,// Game starts immediately in single-player mode
            tokens: Logic.initializeTokens(),
            winners: [],              // Store winning players in order
            gameOver: false,
            vsComputer: !!vsComputer,
            createdAt: Date.now(),
            lastActivity: Date.now()
        };

        // Store game in collection
        this.games[id] = game;

        // Associate socket with game
        this.playerSockets[socketId] = id;
        this.saveGameState(game.id)
        return game;
    }



    /**
     * Handle a player joining an existing game
     * @param {string} socketId - The socket ID of the joining player
     * @param {string} gameId - The ID of the game to join
     * @returns {Object} The updated game object
     * @throws {Error} If the game doesn't exist or is full
     */
    joinGame(socketId, gameId, playerId) {
        const game = this.games[gameId];

        // Validate game exists and has room
        if (!game) throw new Error('Game does not exist');


        // Check if player was already in the game (reconnecting)
        const existingPlayer = game.players.find(p => p.playerId === playerId);
        if (existingPlayer) {
            existingPlayer.id = socketId; // Update socket ID
            this.playerSockets[socketId] = gameId;
            return game;
        } else {
            if (game.players.length >= 2) throw new Error('Game is already full');
        }

        // Add player to the game
        game.players.push({ playerId, id: socketId, playerIndex: 1, colors: ['green', 'blue'] });

        // Associate socket with game
        this.playerSockets[socketId] = gameId;

        // Mark game as started
        game.gameStarted = true;
        game.lastActivity = Date.now(); // Update activity timestamp

        this.saveGameState(gameId)
        return game;
    }



    /**
     * Roll the dice for a player's turn
     * @param {string} socketId - The socket ID of the player rolling
     * @returns {Object} The updated game object
     * @throws {Error} If it's not the player's turn
     */


    rollDice(gameId, playerId) {
        const game = this.games[gameId];
        if (!game) throw new Error('Game not found');

        // Find player by playerId
        const player = game.players.find(p => p.playerId === playerId);
        if (!player) throw new Error('Player not found in game');

        // Validate it's the player's turn using playerIndex
        if (player.playerIndex !== game.currentPlayer) {
            game.rolledValue = []; // Clear any existing rolls
            throw new Error(`Not your turn. Current player: ${game.currentPlayer}`);
        }

        // Generate two random dice rolls (1-6)
        const rolls = [1, 2].map(() => Math.floor(Math.random() * 6) + 1);

        game.originalRolls = [...rolls];
        game.currentRolls = [...rolls]; // These are the rolls currently available for token movement
        game.rolledValue = [...rolls];  // This specifically holds the values to be displayed

        // Temporarily set game.diceValue for internal validation checks, then reset it.
        let hasValidMove = false;
        // Loop through the rolled dice to check if any move is valid
        for (const val of game.currentRolls) {
            game.diceValue = val; // Set the current dice value for the isValidMove check
            if (Logic.checkForValidMoves(game, player.playerIndex)) {
                hasValidMove = true;
                break; // Found at least one valid move, no need to check further
            }
        }

        // Reset the dice value after checking
        game.diceValue = 0;

        // If no valid moves are possible with the rolled dice, end the turn immediately.
        if (!hasValidMove) {
            Logic.nextTurn(game);

            // If it's an AI game and it's now the AI's turn, trigger the AI move after a delay.
            if (game.vsComputer && game.players[game.currentPlayer].id === 'AI') {
                setTimeout(() => {
                    Logic.makeComputerMove(game);
                }, 1500); // Small delay for better user experience
            }
        }
        this.saveGameState(gameId)
        return game;
    }
    /**
     * Play a token move using a specific dice roll
     * @param {string} socketId - The socket ID of the player making the move
     * @param {string} tokenId - The ID of the token to move
     * @param {number} rollIdx - The index of the roll to use
     * @returns {Object} The updated game object
     * @throws {Error} If the move is invalid
     */
    playRoll(gameId, socketId, tokenId, rolledValue) {
        const game = this.games[gameId];
        if (!game) throw new Error('Game not found');

        // Find the token
        const token = game.tokens.find(t => t.id === tokenId);
        if (!token) throw new Error('Token not found');

        // Find player by socketId to verify ownership
        const player = game.players.find(p => p.id === socketId);
        if (!player) throw new Error('Player not found in game');

        // Find a matching die face in currentRolls
        const idx = game.currentRolls.findIndex(v => v === rolledValue);
        if (idx < 0) throw new Error('Invalid roll value');

        // Use that face to move
        game.diceValue = rolledValue;

        // Validate the move
        if (!Logic.isValidMove(game, token)) throw new Error('Invalid move');

        // Execute the move
        Logic.moveToken(game, token);

        // Remove exactly that one die from currentRolls
        game.currentRolls.splice(idx, 1);

        // If no more rolls or no valid moves remain, advance turn
        if (
            game.currentRolls.length === 0 ||
            !Logic.checkForValidMoves(game, game.currentPlayer)
        ) {
            Logic.nextTurn(game);
        }

        // If it’s AI’s turn, schedule the AI move
        if (game.vsComputer && game.currentPlayer === 1) {
            setTimeout(() => {
                Logic.makeComputerMove(game);
            }, 1000);
        }

        this.saveGameState(gameId)
        return game;
    }

    /**
     * Skip the current player's turn
     * @param {string} socketId - The socket ID of the player skipping
     * @returns {Object} The updated game object
     */
    skipTurn(gameId, socketId) {
        const game = this.games[gameId];
        if (!game) throw new Error('Game not found');


        const pIdx = game.players.findIndex(p => p.id === socketId);
        if (!pIdx) throw new Error('Player with index not found');
        // Validate it's the player's turn
        if (pIdx !== game.currentPlayer) throw new Error('Not your turn');

        // End the current turn
        Logic.nextTurn(game);

        // If AI's turn, trigger AI move
        if (game.vsComputer && game.currentPlayer === 1) {
            setTimeout(() => {
                Logic.makeComputerMove(game);
            }, 1000);
        }

        this.saveGameState(gameId)
        return game;
    }


    /**
     * Handle a player disconnecting
     * @param {string} socketId - The socket ID of the disconnected player
     * @returns {string|undefined} The game ID the player was in, if any
     */
    handleDisconnect(socketId) {
        const gameId = this.playerSockets[socketId];
        const game = this.games[gameId];
        if (!game) return null;

        delete this.playerSockets[socketId];

        const player = game.players.find(p => p.id === socketId);
        if (!player) return gameId;

        // Only set timer if it's not already set (prevent multiple timers)
        if (!player.disconnectTimer) {
            player.disconnected = true;
            player.disconnectTimer = setTimeout(() => {
                const index = game.players.findIndex(p => p.id === socketId);
                if (index !== -1) {
                    game.players.splice(index, 1);

                    // Only cleanup if no human players left
                    if (!game.players.some(p => p.id !== 'AI')) {
                        // Save state before deletion if needed
                        this.saveGameState(gameId);
                        delete this.games[gameId];
                    }
                }
            }, 60 * 60 * 1000);
        }
        return gameId;
    }




    // Add this method to GameService class
    verifyPlayerInGame(gameId, playerId) {
        // Try to load game if not in memory
        if (!this.games[gameId]) {
            this.initializeGame(gameId);
        }

        const game = this.games[gameId];
        if (!game) return false;

        // Check if player was in this game
        return game.players.some(p => p.playerId === playerId);
    }

    // Modify rejoinGame to be more secure
    rejoinGame(socketId, gameId, playerId) {
        // First verify player was in this game
        if (!this.verifyPlayerInGame(gameId, playerId)) {
            throw new Error("Player was not part of this game");
        } else {
            console.log(`Player ${playerId} verified in game ${gameId}`);
        }

        const game = this.games[gameId];
        const player = game.players.find(p => p.playerId === playerId);

        // Update connection info
        player.id = socketId;
        player.disconnected = false;

        if (player.disconnectTimer) {
            clearTimeout(player.disconnectTimer);
            player.disconnectTimer = null;
        }

        this.playerSockets[socketId] = gameId;
        game.lastActivity = Date.now();

        console.log(`Player ${playerId} reconnected to game ${gameId}`);

        return {
            ...this.buildGameState(gameId),
            playerId,
            playerIndex: player.playerIndex,
            colors: player.colors,
            myTurn: game.currentPlayer === player.playerIndex,
            gameOver: game.gameOver,
        };
    }


    handleDisconnect(socketId) {
        const gameId = this.playerSockets[socketId];
        const game = this.games[gameId];

        if (!game) return null; // Game already cleaned up

        delete this.playerSockets[socketId];

        const player = game.players.find(p => p.id === socketId);
        if (!player) return gameId; // Not a player (e.g., spectator)

        // Mark as disconnected and set 1-hour reconnection window
        player.disconnected = true;
        player.disconnectTimer = setTimeout(() => {
            // Remove player after timeout
            game.players = game.players.filter(p => p.id !== socketId);

            // Clean up game if no humans left (or only AI remains)
            const hasHumanPlayers = game.players.some(p => p.id !== 'AI');
            if (!hasHumanPlayers) {
                delete this.games[gameId];
            }
        }, 60 * 60 * 1000); // 1 hour (was 10 minutes)

        return gameId;
    }



    cleanupOldGames() {
        const now = Date.now();
        const staleTime = 42 * 60 * 60 * 1000; // 42 hours (more conservative)

        Object.entries(this.games).forEach(([gameId, game]) => {
            if (now - game.lastActivity > staleTime) {
                // Only delete if game is inactive AND has no recent players
                if (game.players.every(p => p.disconnected)) {
                    this.saveGameState(gameId); // Optional: save final state
                    delete this.games[gameId];
                }
            }
        });
    }


    /**
     * Builds the game state for client consumption
     * @param {string} gameId - The ID of the game to build state for
     * @returns {Object} Simplified game state for the client
     */
    buildGameState(gameId) {
        const g = this.games[gameId];
        if (!g) throw new Error('Game not found');

        const currentPlayer = g.players[g.currentPlayer]; // current player object
        const allowedColors = currentPlayer.colors; // e.g. ['red', 'yellow']

        // Map tokens to client-friendly format with coordinates
        const tokens = g.tokens.map(t => {
            const coord = this._getCoords(t);
            return {
                id: t.id,
                color: t.color,
                x: coord[0],
                y: coord[1],
                position: t.position,
                index: t.index,
                isClickable: !g.gameOver &&
                    allowedColors.includes(t.color.toLowerCase()) &&
                    g.currentRolls.some(val => {
                        g.diceValue = val;
                        return Logic.isValidMove(g, t);
                    })
            };
        });



        return {
            id: g.id,
            tokens,
            dice: g.rolledValue || [],
            currentPlayer: g.currentPlayer, // Added
            gameOver: g.gameOver // Added
        };
    }



    /**
     * Get the board coordinates for a token
     * @param {Object} token - The token to get coordinates for
     * @returns {Array} [x, y] coordinates
     * @private
     */
    _getCoords(token) {
        const coords = Logic.getCoords(token)
        return coords
    }

    generateBoardPaths() {
        const paths = Logic.generateBoardPaths()
        return paths
    }


}

module.exports = GameService;
