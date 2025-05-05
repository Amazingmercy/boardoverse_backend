/**
 * GameLogic.js
 * Core game logic for a Ludo-like board game implementation
 * Handles token movement, rules enforcement, and AI behavior
 */

/**
 * Common path representing the main board track (50 positions)
 * @type {Array<number>}
 */
const COMMON_PATH = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
    30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
    40, 41, 42, 43, 44, 45, 46, 47, 48, 49
];

/**
 * Board coordinates for each position on the common path
 * @type {Array<Array<number>>}
 */
// const COMMON_COORDINATES = [
//     [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
//     [6, 5], [6, 4], [6, 3], [6, 2], [6, 1],
//     [7, 1], [8, 1], [8, 2], [8, 3], [8, 4],
//     [8, 5], [9, 6], [10, 6], [11, 6], [12, 6],
//     [13, 6], [13, 7], [13, 8], [12, 8], [11, 8],
//     [10, 8], [9, 8], [8, 9], [8, 10], [8, 11],
//     [8, 12], [8, 13], [7, 13], [6, 13], [6, 12],
//     [6, 11], [6, 10], [6, 9], [5, 8], [4, 8],
//     [3, 8], [2, 8], [1, 8], [1, 7], [1, 6], [2, 6],
//     [3, 6], [4, 6], [5, 6], [6, 6]
// ];
const COMMON_COORDINATES = [
    // Red quadrant (top-left, moves right then down)
    [1,6], [2,6], [3,6], [4,6], [5,6], [6,6],
    [6,5], [6,4], [6,3], [6,2], [6,1],
    [7,1], // Red entry to green quadrant
    
    // Green quadrant (top-right, moves down then left)
    [8,1], [8,2], [8,3], [8,4], [8,5], [8,6],
    [9,6], [10,6], [11,6], [12,6], [13,6],
    [13,7], // Green entry to yellow quadrant
    
    // Yellow quadrant (bottom-right, moves left then up)
    [13,8], [12,8], [11,8], [10,8], [9,8], [8,8],
    [8,9], [8,10], [8,11], [8,12], [8,13],
    [7,13], // Yellow entry to blue quadrant
    
    // Blue quadrant (bottom-left, moves up then right)
    [6,13], [6,12], [6,11], [6,10], [6,9], [6,8],
    [5,8], [4,8], [3,8], [2,8], [1,8],
    [1,7]  // Blue entry back to red quadrant
];

/**
 * Entry positions for each color's home stretch
 * @type {Object}
 */
// const HOME_ENTRANCES = {
//     red: 0,
//     green: 13,
//     yellow: 26,
//     blue: 39
// };
const HOME_ENTRANCES = {
    red: 0,    // After completing full loop
    green: 12, // After red quadrant +1
    yellow: 25, // After green quadrant +1
    blue: 38   // After yellow quadrant +1
};

/**
 * Complete path for each color, including common path and home stretch
 * @type {Object}
 */
// const FINAL_PATHS = {
//     red: [...COMMON_PATH.slice(HOME_ENTRANCES.red), ...COMMON_PATH.slice(0, HOME_ENTRANCES.red), 50, 51, 52, 53, 54, 55, 56, 57],
//     green: [...COMMON_PATH.slice(HOME_ENTRANCES.green), ...COMMON_PATH.slice(0, HOME_ENTRANCES.green), 50, 51, 52, 53, 54, 55, 56, 57],
//     yellow: [...COMMON_PATH.slice(HOME_ENTRANCES.yellow), ...COMMON_PATH.slice(0, HOME_ENTRANCES.yellow), 50, 51, 52, 53, 54, 55, 56, 57],
//     blue: [...COMMON_PATH.slice(HOME_ENTRANCES.blue), ...COMMON_PATH.slice(0, HOME_ENTRANCES.blue), 50, 51, 52, 53, 54, 55, 56, 57]
// };
const FINAL_PATHS = {
    red: {
        common: [...Array(52).keys()], // 0-51
        home: [52,53,54,55,56,57,58]  // Red home stretch
    },
    green: {
        common: [...Array(52).keys()],
        home: [59,60,61,62,63,64,65]  // Green home stretch
    },
    yellow: {
        common: [...Array(52).keys()],
        home: [66,67,68,69,70,71,72] // Yellow home stretch
    },
    blue: {
        common: [...Array(52).keys()],
        home: [73,74,75,76,77,78,79] // Blue home stretch
    }
};

/**
 * Board coordinates for home stretch paths
 * @type {Object}
 */
// const HOME_PATHS = {
//     red: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7]],
//     green: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7]],
//     yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7], [7, 7]],
//     blue: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8], [7, 7]]
// };
const HOME_PATHS = {
    red:   [[6,7], [5,7], [4,7], [3,7], [2,7], [1,7], [0,7]],
    green: [[7,6], [7,5], [7,4], [7,3], [7,2], [7,1], [7,0]],
    yellow: [[8,7], [9,7], [10,7], [11,7], [12,7], [13,7], [14,7]],
    blue:  [[7,8], [7,9], [7,10], [7,11], [7,12], [7,13], [7,14]]
};
/**
 * Safe positions where tokens cannot be captured
 * @type {Array<number>}
 */
//const SAFE_POSITIONS = [0, 8, 13, 21, 26, 34, 39, 47];
const SAFE_POSITIONS = [0, 12, 25, 38, 6, 19, 32, 45];

/**
 * Initialize tokens for all players
 * @returns {Array<Object>} Array of token objects
 */
function initializeTokens() {
    const tokens = [];
    const COLORS = ['red', 'green', 'yellow', 'blue'];
    
    // Starting positions for each color's tokens in their home base
    const HOME_BASES = {
        red: [[2, 2], [2, 4], [4, 2], [4, 4]],
        green: [[10, 2], [10, 4], [12, 2], [12, 4]],
        yellow: [[10, 10], [10, 12], [12, 10], [12, 12]],
        blue: [[2, 10], [2, 12], [4, 10], [4, 12]]
    };

    // Create 4 tokens for each player color
    COLORS.forEach((color, playerIndex) => {
        for (let i = 0; i < 4; i++) {
            tokens.push({
                id: `${color}-${i}`,
                color,
                playerIndex,
                position: -1,            // -1 means in home base
                completed: false,        // Whether token has reached the center
                homeBasePosition: HOME_BASES[color][i],
                steps: 0                 // Track progress along path
            });
        }
    });

    return tokens;
}

/**
 * Check if a move is valid for a given token
 * @param {Object} game - The game state
 * @param {Object} token - The token to check
 * @returns {boolean} Whether the move is valid
 */
function isValidMove(game, token) {
    const val = game.diceValue;

    // Skip if token has already reached center
    if (token.completed) return false;

    // Get all tokens for this player
    const playerTokens = game.tokens.filter(t => t.playerIndex === token.playerIndex);

    // Check if player has any tokens on the board
    const hasTokenOnBoard = playerTokens.some(t => t.position >= 0 && !t.completed);

    // If trying to move a token out from home base
    if (token.position === -1) {
        // Can only leave home base with a 6, unless a token is already on board
        // NOTE: This logic seems questionable - should likely be just "val === 6"
        return val === 6 || hasTokenOnBoard;
    }

    // If token is already on board, check if the move stays within valid path
    return token.steps + val <= 57;
}

/**
 * Check if player has any valid moves with current dice rolls
 * @param {Object} game - The game state
 * @param {number} playerIndex - The player to check
 * @returns {boolean} Whether any valid moves exist
 */
function checkForValidMoves(game, playerIndex) {
    const rolls = game.currentRolls;
    const playerTokens = game.tokens.filter(t => t.playerIndex === playerIndex);

    // Check if player has any tokens on the board
    const hasTokenOnBoard = playerTokens.some(t => t.position >= 0 && !t.completed);

    // Check each token for possible moves
    return playerTokens.some(token => {
        if (token.completed) return false;

        // Home base tokens can only move with a 6 roll
        if (token.position === -1) {
            // NOTE: This logic seems questionable - should likely be just "rolls.includes(6)"
            return rolls.includes(6) || hasTokenOnBoard;
        }

        // Check if any roll allows token to move within path limits
        return rolls.some(val => token.steps + val <= 57);
    });
}

/**
 * Move a token according to the current dice value
 * @param {Object} game - The game state
 * @param {Object} token - The token to move
 */
function moveToken(game, token) {
    const val = game.diceValue;
    const path = FINAL_PATHS[token.color];

    console.log(`Moving token ${token.id} from ${token.position} ${val} steps`);

    // Case 1: Token is leaving home base
    if (token.position === -1 && val === 6) {
        token.position = path[0]; // Set to starting position
        token.steps = 0;
    }
    // Case 2: Token is already on the board
    else if (token.position >= 0) {
        const newSteps = token.steps + val;
        
        // Ensure move stays within valid range
        if (newSteps <= 57) {
            token.steps = newSteps;
            token.position = path[token.steps]; // Update position based on steps

            // Check if token has reached the center
            if (token.steps === 57) {
                token.completed = true;
            }

            // Check for opponent captures
            killOpponentToken(game, token);
            
            // Check if player has won
            checkWin(game, token.playerIndex);
        }
    }
}

/**
 * Capture opponent tokens that share the same position
 * @param {Object} game - The game state
 * @param {Object} token - The token that just moved
 */
function killOpponentToken(game, token) {
    game.tokens.forEach(t => {
        if (
            t.id !== token.id &&
            t.color !== token.color &&
            t.position === token.position &&
            !t.completed &&
            !SAFE_POSITIONS.includes(token.position) &&
            !areOnSameTeam(token.playerIndex, t.playerIndex)
        ) {
            // Send the token back to home base
            t.position = -1;
            t.steps = 0;
        }
    });
}

/**
 * Check if a player has won the game
 * @param {Object} game - The game state 
 * @param {number} playerIndex - The player to check
 */
function checkWin(game, playerIndex) {
    // Get all tokens for this player
    const tokens = game.tokens.filter(t => t.playerIndex === playerIndex);
    
    // Check if all tokens have reached the center
    if (tokens.every(t => t.completed)) {
        // Add player to winners list if not already there
        if (!game.winners.includes(playerIndex)) {
            game.winners.push(playerIndex);
        }

        // Check if game is over (all players have finished)
        if (game.winners.length === game.players.length) {
            game.gameOver = true;
        }
    }
}

/**
 * Advance to the next player's turn
 * @param {Object} game - The game state
 */
function nextTurn(game) {
    // Cycle to next player
    game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
    
    // Reset dice values
    game.diceValue = 0;
    game.currentRolls = [];
}

/**
 * Execute an AI player's turn
 * @param {Object} game - The game state
 */
function makeComputerMove(game) {
    // Generate random dice rolls
    const rolls = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
    ];

    game.originalRolls = [...rolls];
    game.currentRolls = [...rolls];

    // Get computer player's tokens that aren't completed
    const tokens = game.tokens.filter(t => t.playerIndex === 1 && !t.completed);
    const validMoves = [];

    // Find all valid moves with current rolls
    for (let rollIdx = 0; rollIdx < rolls.length; rollIdx++) {
        const val = rolls[rollIdx];
        game.diceValue = val;

        tokens.forEach(token => {
            if (isValidMove(game, token)) {
                const path = FINAL_PATHS[token.color];
                let targetPos = token.position === -1 ? path[0] : path[token.steps + val];

                validMoves.push({
                    token,
                    val,
                    rollIdx,
                    targetPos
                });
            }
        });
    }

    // Skip turn if no valid moves
    if (validMoves.length === 0) {
        nextTurn(game);
        return;
    }

    // Sort moves by strategy priority: kill > enter board > furthest token
    validMoves.sort((a, b) => {
        // Check if move results in capturing an opponent
        const aKills = game.tokens.some(
            t =>
                t.id !== a.token.id &&
                t.color !== a.token.color &&
                t.position === a.targetPos &&
                !t.completed &&
                !SAFE_POSITIONS.includes(a.targetPos) &&
                !areOnSameTeam(t.playerIndex, a.token.playerIndex)
        );

        const bKills = game.tokens.some(
            t =>
                t.id !== b.token.id &&
                t.color !== b.token.color &&
                t.position === b.targetPos &&
                !t.completed &&
                !SAFE_POSITIONS.includes(b.targetPos) &&
                !areOnSameTeam(t.playerIndex, b.token.playerIndex)
        );

        // Priority 1: Moves that capture opponent tokens
        if (bKills - aKills !== 0) return bKills - aKills;

        // Priority 2: Moves that bring tokens out of home base
        if ((b.token.position === -1 ? 1 : 0) - (a.token.position === -1 ? 1 : 0) !== 0) {
            return (b.token.position === -1 ? 1 : 0) - (a.token.position === -1 ? 1 : 0);
        }

        // Priority 3: Move the token that's furthest along
        return (b.token.steps) - (a.token.steps);
    });

    // Execute the best move
    const bestMove = validMoves[0];
    game.diceValue = bestMove.val;
    moveToken(game, bestMove.token);
    game.currentRolls.splice(bestMove.rollIdx, 1);

    // Check if AI can make another move
    const canStillMove = game.tokens
        .filter(t => t.playerIndex === 1 && !t.completed)
        .some(t => game.currentRolls.some(val => {
            game.diceValue = val;
            return isValidMove(game, t);
        }));

    // Continue with next AI move or end turn
    if (canStillMove && game.currentRolls.length > 0) {
        setTimeout(() => makeComputerMove(game), 1000);
    } else {
        game.originalRolls = [];
        game.currentRolls = [];
        nextTurn(game);
    }
}

/**
 * Check if two players are on the same team
 * @param {number} playerA - First player index
 * @param {number} playerB - Second player index
 * @returns {boolean} Whether the players are teammates
 */
function areOnSameTeam(playerA, playerB) {
    // Players with same parity are on the same team (0&2, 1&3)
    return (playerA % 2) === (playerB % 2); 
}

module.exports = {
    initializeTokens,
    isValidMove,
    checkForValidMoves,
    moveToken,
    nextTurn,
    makeComputerMove,
    FINAL_PATHS,
    COMMON_PATH,
    HOME_PATHS,
    HOME_ENTRANCES,
    COMMON_COORDINATES,
    SAFE_POSITIONS
};