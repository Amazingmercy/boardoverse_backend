/**
 * GameService.js
 * Manages game state and operations for Ludo-like board game
 * Handles game creation, player management, and game state transitions
 */

const { v4: uuidv4 } = require("uuid");
const Logic = require('../gameLogic.js');

// Import missing constants from gameLogic.js
const {
    FINAL_PATHS,
    COMMON_PATH,
    HOME_PATHS,
    HOME_ENTRANCES,
    COMMON_COORDINATES,
    SAFE_POSITIONS
} = require('../gameLogic.js');

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
    }

    /**
     * Singleton pattern implementation to ensure only one instance exists
     * @returns {GameService} The singleton instance of GameService
     */
    static getInstance() {
        return this.instance || (this.instance = new GameService());
    }

    /**
     * Create a new game instance
     * @param {string} socketId - The socket ID of the player creating the game
     * @param {boolean} vsComputer - Whether this is a single-player game against AI
     * @returns {Object} The newly created game object
     */
    createGame(socketId, vsComputer) {
        // Generate a short, unique game ID
        const id = uuidv4().slice(0, 6);

        // Initialize players array with the creator
        const players = [{ id: socketId, playerIndex: 0, colors: ['red', 'yellow'] }];

        // Add AI player if single-player mode
        if (vsComputer) players.push({ id: 'AI', playerIndex: 1, colors: ['green', 'blue'] });

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
        };

        // Store game in collection
        this.games[id] = game;

        // Associate socket with game
        this.playerSockets[socketId] = id;

        return game;
    }

    /**
     * Handle a player joining an existing game
     * @param {string} socketId - The socket ID of the joining player
     * @param {string} gameId - The ID of the game to join
     * @returns {Object} The updated game object
     * @throws {Error} If the game doesn't exist or is full
     */
    joinGame(socketId, gameId) {
        const game = this.games[gameId];

        // Validate game exists and has room
        if (!game || game.players.length >= 2) throw new Error('Game not available');

        // Add player to the game
        game.players.push({ id: socketId, playerIndex: 1, colors: ['green', 'blue'] });

        // Associate socket with game
        this.playerSockets[socketId] = gameId;

        // Mark game as started
        game.gameStarted = true;

        return game;
    }

    /**
     * Roll the dice for a player's turn
     * @param {string} socketId - The socket ID of the player rolling
     * @returns {Object} The updated game object
     * @throws {Error} If it's not the player's turn
     */
    rollDice(socketId) {
        const game = this._getGameBySocket(socketId);
        const pIdx = game.players.findIndex(p => p.id === socketId);

        // Validate it's the player's turn
        if (pIdx !== game.currentPlayer) throw new Error('Not your turn');

        // Generate two random dice rolls (1-6)
        const rolls = [1, 2].map(() => Math.floor(Math.random() * 6) + 1);
        game.originalRolls = [...rolls];
        game.currentRolls = [...rolls];
        game.rolledValue = game.originalRolls


        // Check if at least one valid move exists with the rolled values
        const hasValidMove = game.currentRolls.some(val => {
            game.diceValue = val;
            return Logic.checkForValidMoves(game, pIdx);
        });

        // If no valid moves, end turn
        if (!hasValidMove) {

            if (!game.vsCompute) {
                Logic.nextTurn(game);
                game.rolledValue = game.originalRolls
                return game;
            }

            // If AI's turn, trigger AI move after a delay
            if (game.vsComputer && game.currentPlayer === 1) {
                setTimeout(() => {
                    Logic.makeComputerMove(game);
                }, 1500);
            } else {
                // Move to next player
                Logic.nextTurn(game);
            }
        }

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
    playRoll(socketId, tokenId, rollIdx) {
        const game = this._getGameBySocket(socketId);

        // Find the token to move
        const token = game.tokens.find(t => t.id === tokenId);

        // Get the dice value to use
        const val = game.currentRolls[rollIdx];
        game.diceValue = val;

        // Validate the move
        if (!Logic.isValidMove(game, token)) throw new Error('Invalid move');

        // Execute the move
        Logic.moveToken(game, token);

        // Remove the used roll
        game.currentRolls.splice(rollIdx, 1);

        // Check if no more valid moves, then end turn
        if (!Logic.checkForValidMoves(game, game.currentPlayer)) Logic.nextTurn(game);

        // If AI's turn, trigger AI move
        if (game.vsComputer && game.currentPlayer === 1) Logic.makeComputerMove(game);

        return game;
    }

    /**
     * Skip the current player's turn
     * @param {string} socketId - The socket ID of the player skipping
     * @returns {Object} The updated game object
     */
    skipTurn(socketId) {
        const game = this._getGameBySocket(socketId);

        // End the current turn
        Logic.nextTurn(game);

        // If AI's turn, trigger AI move
        if (game.vsComputer && game.currentPlayer === 1) Logic.makeComputerMove(game);

        return game;
    }

    /**
     * Handle a player rejoining an existing game
     * @param {string} socketId - The new socket ID of the rejoining player
     * @param {string} gameId - The ID of the game to rejoin
     * @param {number} playerIndex - The player's index in the game
     * @returns {Object} The updated game object
     * @throws {Error} If the rejoin parameters are invalid
     */
    rejoinGame(socketId, gameId, playerIndex) {
        const game = this.games[gameId];

        // Validate game exists and player position is valid
        if (!game || !game.players[playerIndex]) throw new Error('Invalid rejoin');

        // Update player's socket ID
        game.players[playerIndex].id = socketId;

        // Associate socket with game
        this.playerSockets[socketId] = gameId;

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

        // Remove socket association
        delete this.playerSockets[socketId];

        if (game) {
            // Remove player from game
            game.players = game.players.filter(p => p.id !== socketId);

            // Clean up empty games
            if (!game.players.length) delete this.games[gameId];
        }

        return gameId;
    }

    /**
     * Builds the game state for client consumption
     * @param {string} gameId - The ID of the game to build state for
     * @returns {Object} Simplified game state for the client
     */
    buildGameState(gameId) {
        const g = this.games[gameId];

        // Map tokens to client-friendly format with coordinates
        const tokens = g.tokens.map(t => {
            const coord = this._getCoords(t);
            return {
                id: t.id,
                color: t.color,
                x: coord[0],
                y: coord[1],
                isClickable: !g.gameOver &&
                    g.currentPlayer === t.playerIndex &&
                    Logic.isValidMove(g, t)
            };
        });


        return {
            id: g.id,
            tokens,
            dice: [...g.rolledValue]
        };
    }

    /**
     * Get a game by socket ID
     * @param {string} socketId - The socket ID to look up
     * @returns {Object} The game object
     * @throws {Error} If no game is found for the socket
     * @private
     */
    _getGameBySocket(socketId) {
        const gameId = this.playerSockets[socketId];
        const game = this.games[gameId];

        if (!game) throw new Error('Game not found');

        return game;
    }

    /**
     * Get the board coordinates for a token
     * @param {Object} token - The token to get coordinates for
     * @returns {Array} [x, y] coordinates
     * @private
     */
    _getCoords(token) {
        // If token has reached the center
        if (token.completed) return [7, 7];

        // If token is still in home base
        if (token.position === -1) return token.homeBasePosition;

        // If token is on the common path
        if (token.position < COMMON_PATH.length) return COMMON_COORDINATES[token.position];

        // If token is on the home path
        return HOME_PATHS[token.color][token.position - COMMON_PATH.length];
    }

    /**
 * Generates all drawing paths for the Ludo board using game constants
 * @returns {Object} Contains all paths needed to render the board
 */
    generateBoardPaths() {
        console.log("Generating board paths..."); 
        // Main board structure
        const paths = {
            // Outer and inner borders (calculated based on grid size)
            borders: [
                {
                    type: 'square',
                    coords: [
                        [0, 0],
                        [COMMON_COORDINATES.length / 4 - 1, 0],
                        [COMMON_COORDINATES.length / 4 - 1, COMMON_COORDINATES.length / 4 - 1],
                        [0, COMMON_COORDINATES.length / 4 - 1]
                    ]
                },
                {
                    type: 'square',
                    coords: [
                        [1, 1],
                        [COMMON_COORDINATES.length / 4 - 2, 1],
                        [COMMON_COORDINATES.length / 4 - 2, COMMON_COORDINATES.length / 4 - 2],
                        [1, COMMON_COORDINATES.length / 4 - 2]
                    ]
                }
            ],

            // Center cross
            cross: [
                {
                    type: 'line',
                    coords: [
                        [Math.floor(COMMON_COORDINATES.length / 8), 1],
                        [Math.floor(COMMON_COORDINATES.length / 8), COMMON_COORDINATES.length / 4 - 2]
                    ]
                },
                {
                    type: 'line',
                    coords: [
                        [1, Math.floor(COMMON_COORDINATES.length / 8)],
                        [COMMON_COORDINATES.length / 4 - 2, Math.floor(COMMON_COORDINATES.length / 8)]
                    ]
                }
            ],

            // Home bases (generated from HOME_BASES constant)
            homeBases: Object.keys(HOME_BASES).reduce((acc, color) => {
                const baseCoords = HOME_BASES[color];
                acc[color] = {
                    type: 'polygon',
                    coords: [
                        baseCoords[0], // Top-left
                        [baseCoords[2][0], baseCoords[0][1]], // Top-right
                        baseCoords[2], // Bottom-right
                        [baseCoords[0][0], baseCoords[2][1]]  // Bottom-left
                    ]
                };
                return acc;
            }, {}),

            // Starting areas (derived from home entrance positions)
            startAreas: Object.keys(HOME_ENTRANCES).reduce((acc, color) => {
                const entrancePos = HOME_ENTRANCES[color];
                const entranceCoord = COMMON_COORDINATES[entrancePos];

                // Determine direction based on color quadrant
                let startAreaCoords;
                if (color === 'red') {
                    startAreaCoords = [
                        entranceCoord,
                        [entranceCoord[0] + 1, entranceCoord[1]],
                        [entranceCoord[0] + 1, entranceCoord[1] + 1],
                        [entranceCoord[0], entranceCoord[1] + 1]
                    ];
                } else if (color === 'green') {
                    startAreaCoords = [
                        entranceCoord,
                        [entranceCoord[0] - 1, entranceCoord[1]],
                        [entranceCoord[0] - 1, entranceCoord[1] - 1],
                        [entranceCoord[0], entranceCoord[1] - 1]
                    ];
                } else if (color === 'yellow') {
                    startAreaCoords = [
                        entranceCoord,
                        [entranceCoord[0] + 1, entranceCoord[1]],
                        [entranceCoord[0] + 1, entranceCoord[1] - 1],
                        [entranceCoord[0], entranceCoord[1] - 1]
                    ];
                } else { // blue
                    startAreaCoords = [
                        entranceCoord,
                        [entranceCoord[0] - 1, entranceCoord[1]],
                        [entranceCoord[0] - 1, entranceCoord[1] + 1],
                        [entranceCoord[0], entranceCoord[1] + 1]
                    ];
                }

                acc[color] = { type: 'square', coords: startAreaCoords };
                return acc;
            }, {}),

            // Safe zones (from SAFE_POSITIONS constant)
            safeZones: SAFE_POSITIONS.map(pos => {
                const coord = COMMON_COORDINATES[pos];
                return {
                    type: 'square',
                    coords: [
                        [coord[0] - 1, coord[1] - 1],
                        [coord[0] + 1, coord[1] - 1],
                        [coord[0] + 1, coord[1] + 1],
                        [coord[0] - 1, coord[1] + 1]
                    ]
                };
            }),

            // Center home (calculated from common path center)
            center: {
                type: 'square',
                coords: [
                    [Math.floor(COMMON_COORDINATES.length / 8) - 1, Math.floor(COMMON_COORDINATES.length / 8) - 1],
                    [Math.floor(COMMON_COORDINATES.length / 8) + 1, Math.floor(COMMON_COORDINATES.length / 8) - 1],
                    [Math.floor(COMMON_COORDINATES.length / 8) + 1, Math.floor(COMMON_COORDINATES.length / 8) + 1],
                    [Math.floor(COMMON_COORDINATES.length / 8) - 1, Math.floor(COMMON_COORDINATES.length / 8) + 1]
                ]
            },

            // Common path (from COMMON_COORDINATES)
            commonPath: {
                type: 'polyline',
                coords: COMMON_COORDINATES
            },

            // Home stretch paths (from HOME_PATHS constant)
            homePaths: Object.keys(HOME_PATHS).reduce((acc, color) => {
                acc[color] = {
                    type: 'polyline',
                    coords: HOME_PATHS[color]
                };
                return acc;
            }, {})
        };

        console.log("Generated board paths:", paths); // Debugging output
        return paths;
    }


}

module.exports = GameService;