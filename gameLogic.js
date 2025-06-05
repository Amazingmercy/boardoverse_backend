// Combined Game Logic and Board Constants for Ludo-style Game

// Board Constants
export const GRID_SIZE = 15;
export const TRACK_LENGTH = 52;
export const HOME_COLUMN_LENGTH = 6;
export const TOKENS_PER_PLAYER = 4;

// Player Starting Offsets (index on the common track)
export const PLAYER_START_OFFSETS = {
  RED: (0 + 9) % TRACK_LENGTH,     // New RED: 11
  GREEN: (13 + 9) % TRACK_LENGTH,   // New GREEN: 24
  YELLOW: (26 + 9) % TRACK_LENGTH,  // New YELLOW: 37
  BLUE: (39 + 9) % TRACK_LENGTH     // New BLUE: 50
};

// Home Entry Points (last track index before home path)
export const PLAYER_HOME_ENTRY_POINTS = {
  RED: (PLAYER_START_OFFSETS.RED + TRACK_LENGTH - 1) % TRACK_LENGTH, // Should be 51
  GREEN: (PLAYER_START_OFFSETS.GREEN + TRACK_LENGTH - 1) % TRACK_LENGTH, // Should be 12
  YELLOW: (PLAYER_START_OFFSETS.YELLOW + TRACK_LENGTH - 1) % TRACK_LENGTH, // Should be 25
  BLUE: (PLAYER_START_OFFSETS.BLUE + TRACK_LENGTH - 1) % TRACK_LENGTH // Should be 38
};


export const SAFE_SQUARE_INDICES = [
  PLAYER_START_OFFSETS.RED,    // [6,1]
  PLAYER_START_OFFSETS.GREEN,  // [1,8]
  PLAYER_START_OFFSETS.YELLOW, // [8,13]
  PLAYER_START_OFFSETS.BLUE    // [13,6]
];

// Main Track Coordinates (52 positions) - Removed .reverse()
export const TRACK_COORDINATES = [
  [6,1],[6,2],[6,3],[6,4],[6,5],  // 0-4
  [5,6],[4,6],[3,6],[2,6],[1,6],  // 5-9
  [0,6],[0,7],[0,8],              // 10-12 (Green entry at 12)

  [1,8],[2,8],[3,8],[4,8],[5,8],  // 13-17 (Green start at 13)
  [6,9],[6,10],[6,11],[6,12],[6,13], // 18-22
  [6,14],[7,14],[8,14],           // 23-25 (Yellow entry at 25)

  [8,13],[8,12],[8,11],[8,10],[8,9],  // 26-30 (Yellow start at 26)
  [9,8],[10,8],[11,8],[12,8],[13,8],   // 31-35
  [14,8],[14,7],[14,6],                // 36-38 (Blue entry at 38)

  [13,6],[12,6],[11,6],[10,6],[9,6],  // 39-43 (Blue start at 39)
  [8,5],[8,4],[8,3],[8,2],[8,1],     // 44-48
  [8,0],[7,0],[6,0]                  // 49-51 (Red entry at 51)
];

// Common path indices and coordinates
export const COMMON_PATH = Array.from({ length: TRACK_LENGTH }, (_, i) => i);
export const COMMON_COORDINATES = TRACK_COORDINATES;

// Home Path Coordinates per color - Corrected paths
export const HOME_PATH_COORDINATES = {
  RED:   [[6,7],[5,7],[4,7],[3,7],[2,7],[1,7]],  // Already moves Up (correct)
  GREEN: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]], // Corrected: Moves Left (inward)
  YELLOW: [[8,7],[9,7],[10,7],[11,7],[12,7],[13,7]], // Already moves Down (correct)
  BLUE:  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]]   // Corrected: Moves Right (inward)
};

// Home Entrances (alias for clarity)
export const HOME_ENTRANCES = PLAYER_HOME_ENTRY_POINTS;

// Base positions for tokens inside their home bases
export const BASE_TOKEN_POSITIONS = {
  RED:   [[1,1],[1,4],[4,1],[4,4]],
  GREEN: [[1,10],[1,13],[4,10],[4,13]],
  YELLOW:[[10,10],[10,13],[13,10],[13,13]],
  BLUE:  [[10,1],[10,4],[13,1],[13,4]]
};

// Aliased home bases
export const HOME_BASES = BASE_TOKEN_POSITIONS;

// Safe positions alias
export const SAFE_POSITIONS = SAFE_SQUARE_INDICES;

// Final paths including home stretch indices for all players
// These represent the full sequence a token might take, including entering the home path
export const FINAL_PATHS = {
  RED: [...COMMON_PATH.slice(0), 100,101,102,103,104,105], // Example: 0-51 (track), then 100-105 (home path)
  GREEN: [...COMMON_PATH.slice(13).concat(COMMON_PATH.slice(0,13)), 110,111,112,113,114,115],
  YELLOW: [...COMMON_PATH.slice(26).concat(COMMON_PATH.slice(0,26)), 120,121,122,123,124,125],
  BLUE: [...COMMON_PATH.slice(39).concat(COMMON_PATH.slice(0,39)), 130,131,132,133,134,135]
};

// Aliased home paths for export
export const HOME_PATHS = HOME_PATH_COORDINATES;

export const COLORS = ['RED','GREEN','YELLOW','BLUE'];

/** Initialize tokens for all players */
export function initializeTokens() {
  const tokens = [];
  const COLORS = ['RED','GREEN','YELLOW','BLUE'];
  COLORS.forEach((color, pi) => {
    BASE_TOKEN_POSITIONS[color].forEach((homePos, idx) => {
      tokens.push({
        id: `${color}-${idx}`,
        color,
        playerIndex: pi,
        position: -1, // -1 means in home base
        steps: 0,
        completed: false,
        homeBasePosition: homePos, // Store the [x,y] grid coordinate
        index: idx
      });
    });
  });
  return tokens;
}

/**
 * Generates and returns structured board path data for client-side rendering.
 * This includes common paths, home paths, safe zones, and home base areas.
 */
export function generateBoardPaths() {
  // Define player colors in consistent order
  const PLAYER_COLORS = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

  return {
    // Common path representation (main track)
    commonPath: {
      type: 'path',
      coords: TRACK_COORDINATES,
      length: TRACK_LENGTH,
      // Add path connections for game logic
      next: TRACK_COORDINATES.map((_, i) => (i + 1) % TRACK_LENGTH),
      prev: TRACK_COORDINATES.map((_, i) => (i - 1 + TRACK_LENGTH) % TRACK_LENGTH)
    },

    // Home paths for each color
    homePaths: PLAYER_COLORS.reduce((paths, color) => {
      paths[color] = {
        type: 'homepath',
        coords: HOME_PATH_COORDINATES[color],
        length: HOME_COLUMN_LENGTH,
        // Connect to common path entryPoint
        entryPoint: PLAYER_HOME_ENTRY_POINTS[color]
      };
      return paths;
    }, {}),

    // Safe zones on the common path
    safeZones: SAFE_SQUARE_INDICES.map(idx => {
      const color = Object.keys(PLAYER_START_OFFSETS).find(key => PLAYER_START_OFFSETS[key] === idx) || 'COMMON';
      return {
        type: 'safezone',
        coords: [TRACK_COORDINATES[idx]],
        color: color
      };
    }),

    // Home base areas (where tokens start)
    homeBases: PLAYER_COLORS.reduce((bases, color) => {
      bases[color] = {
        type: 'homebase',
        coords: BASE_TOKEN_POSITIONS[color]
      };
      return bases;
    }, {}),

    // Starting areas (first square on the track for each player)
    startAreas: PLAYER_COLORS.reduce((starts, color) => {
      const startIdx = PLAYER_START_OFFSETS[color];
      starts[color] = {
        type: 'startarea',
        coords: [TRACK_COORDINATES[startIdx]]
      };
      return starts;
    }, {}),

    // Center area (where tokens finish)
    center: {
      type: 'center',
      coords: [[7,7]] // Central square
    }
  };
}


/**
 * Determines the coordinates of a token on the board.
 * @param {Object} token - The token object.
 * @returns {Array} [x, y] coordinates.
 */
export function getCoords(token) {
    // Center position
    const center = [Math.floor(GRID_SIZE/2), Math.floor(GRID_SIZE/2)];

    // If token has reached the center
    if (token.completed) return center;

    // If token is still in home base
    if (token.position === -1) return token.homeBasePosition;

    // If token is on the common path (numeric < 100)
    if (typeof token.position === 'number' && token.position < 100) {
      const idx = token.position % COMMON_COORDINATES.length;
      return COMMON_COORDINATES[idx];
    }

    // If token is on the home path (position encoded >= 100 or as H_color_index)
    const color = token.color;
    let homeIdx;
    if (typeof token.position === 'string') {
      // Position like `H_COLOR_3` (Old format, should ideally be numeric now)
      const parts = token.position.split('_');
      homeIdx = parseInt(parts[2]);
    } else {
      // Position like `100 + playerIndex * 10 + index_in_home_path`
      const playerIndex = token.playerIndex;
      const homePathStart = 100 + playerIndex * 10;
      homeIdx = token.position - homePathStart;
    }
    return HOME_PATH_COORDINATES[color][homeIdx];
}

/**
 * Checks if a move is valid for a given token and dice value.
 * @param {Object} game - The current game state.
 * @param {Object} token - The token to move.
 * @returns {boolean} True if the move is valid, false otherwise.
 */
export function isValidMove(game, token) {
  const diceValue = game.diceValue;

  
  // Rule: Must roll a 6 to get out of home base
  if (token.position === -1) {
    return diceValue === 6;
  }

  // Calculate potential new position
  let newPositionSteps = token.steps + diceValue;

  // Check if token is entering home path
  const playerStartOffset = PLAYER_START_OFFSETS[token.color];
  const playerHomeEntryPoint = PLAYER_HOME_ENTRY_POINTS[token.color];
  const homePathLength = HOME_COLUMN_LENGTH;
  const commonPathLength = TRACK_LENGTH;

  // Determine actual target position on common track
  let targetCommonTrackPosition = (playerStartOffset + newPositionSteps - 1) % commonPathLength;
  if (targetCommonTrackPosition < 0) { // Handle negative modulo results
      targetCommonTrackPosition += commonPathLength;
  }


  // Check if token is entering home path or moving within it
  if (token.steps < (commonPathLength + homePathLength) -1 ) { // Before or in home path
      if (newPositionSteps > commonPathLength + homePathLength -1) {
          return false; // Overshot the final home square
      }

      // Check for overshooting home path
      if (token.steps <= commonPathLength && newPositionSteps > commonPathLength) {
          const stepsIntoHomePath = newPositionSteps - commonPathLength;
          if (stepsIntoHomePath > HOME_COLUMN_LENGTH) {
              return false; // Overshot home path
          }
      }
  }


  // Check for landing on own token (unless capturing or moving out of base)
  const isMovingFromHome = token.position === -1;
  const isTargetSafe = SAFE_SQUARE_INDICES.includes(targetCommonTrackPosition); // This applies to common path
  const isMovingOnHomePath = newPositionSteps > commonPathLength; // If it's on the home path, it's generally safe from other players

  const targetGlobalPosition = getProjectedGlobalPosition(token, diceValue);


  // Check for collision with other tokens
  for (const otherToken of game.tokens) {
      if (otherToken.id === token.id || otherToken.completed) continue;

      const otherTokenGlobalPosition = getProjectedGlobalPosition(otherToken, 0); // Get current global position

      // If moving to an occupied square
      if (targetGlobalPosition === otherTokenGlobalPosition) {
          // Cannot land on own token
          if (otherToken.color === token.color) {
              return false;
          }
          // Can capture opponent's token if not on a safe square
          // If the target position is a safe square, you cannot capture, and thus cannot move there if occupied
          if (isTargetSafe || isMovingOnHomePath) { // Home path squares are safe
              return false;
          }
      }
  }


  return true; // If no invalid conditions met
}

/**
 * Moves a token based on the dice value.
 * @param {Object} game - The current game state.
 * @param {Object} token - The token to move.
 */
export function moveToken(game, token) {
    const diceValue = game.diceValue;

    if (!isValidMove(game, token)) {
        console.warn(`Invalid move attempted for token ${token.id} with dice ${diceValue}`);
        return;
    }

    // Move token out of home base
    if (token.position === -1) {
        token.position = PLAYER_START_OFFSETS[token.color];
        token.steps = 1; // Token has moved one step from the base to the start point
        return;
    }

    // Capture opponent's token if landed on
    const targetSteps = token.steps + diceValue;
    const commonPathLength = TRACK_LENGTH;
    const homePathLength = HOME_COLUMN_LENGTH;

    let newPosition;
    let newSteps;

    // Determine if the token is entering or moving within the home path
    if (token.steps < commonPathLength && targetSteps >= commonPathLength) {
        // Entering home path
        const stepsIntoHomePath = targetSteps - commonPathLength;
        newPosition = 100 + token.playerIndex * 10 + stepsIntoHomePath -1; // New indexing for home path
        newSteps = targetSteps;
    } else if (token.steps >= commonPathLength) {
        // Already in home path
        newSteps = targetSteps;
        const stepsInHomePath = newSteps - commonPathLength;
        newPosition = 100 + token.playerIndex * 10 + stepsInHomePath;
        
    } else {
        // Still on common track
        newSteps = targetSteps;
        newPosition = (PLAYER_START_OFFSETS[token.color] - (newSteps - 1) + commonPathLength) % commonPathLength;
        if (newPosition < 0) newPosition += commonPathLength; // Ensure positive modulo result
    }

    token.position = newPosition;
    token.steps = newSteps;

    // Check for capture (only on common path)
    if (token.steps <= commonPathLength) { // Only check for capture if on common path
        const targetToken = game.tokens.find(t =>
            t.position === token.position &&
            t.color !== token.color &&
            t.position !== -1 && // Not in home
            !SAFE_SQUARE_INDICES.includes(token.position) // Not on safe square
        );

        if (targetToken) {
            targetToken.position = -1; // Send captured token back to home
            targetToken.steps = 0;
        }
    }

    // Check if token has reached the center (completed)
    if (token.steps >= commonPathLength + homePathLength) {
        token.completed = true;
        token.position = 99; // Indicate completion for drawing (any value > 57)
        checkWinCondition(game);
    }
}


function getProjectedGlobalPosition(token, diceValue) {
    if (token.position === -1) {
        if (diceValue === 6) {
            return PLAYER_START_OFFSETS[token.color];
        } else {
            return -1; // Still in home
        }
    }

    let projectedSteps = token.steps + diceValue;
    const commonPathLength = TRACK_LENGTH;
    const homePathLength = HOME_COLUMN_LENGTH;

    if (projectedSteps >= commonPathLength + homePathLength) {
        return 99; // Represents completion
    } else if (projectedSteps >= commonPathLength) {
        // In home path
        const stepsInHomePath = projectedSteps - commonPathLength;
        return 100 + token.playerIndex * 10 + stepsInHomePath -1;
    } else {
        // On common track
        let projectedCommonPosition = (PLAYER_START_OFFSETS[token.color] + projectedSteps -1) % commonPathLength;
        if (projectedCommonPosition < 0) projectedCommonPosition += commonPathLength;
        return projectedCommonPosition;
    }
}


/**
 * Checks if a player has won the game.
 * @param {Object} game - The current game state.
 */
function checkWinCondition(game) {
  game.players.forEach(player => {
    const playerTokens = game.tokens.filter(t => t.playerIndex === player.playerIndex);
    const allTokensCompleted = playerTokens.every(t => t.completed);

    if (allTokensCompleted && !game.winners.includes(player.playerIndex)) {
      game.winners.push(player.playerIndex);
    }
  });

  if (game.winners.length === game.players.length) {
    game.gameOver = true;
  }
}

/**
 * Advances the game to the next player's turn.
 * @param {Object} game - The current game state.
 */
export function nextTurn(game) {
  game.currentRolls = []; // Clear remaining rolls
  game.originalRolls = []; // Clear original rolls

  // Find the next active player
  let nextPlayerIndex = (game.currentPlayer + 1) % game.players.length;
  game.currentPlayer = nextPlayerIndex;


  // If next player is AI, trigger AI move
  if (game.vsComputer && game.players[game.currentPlayer].id === 'AI') {
    setTimeout(() => makeComputerMove(game), 1500); // Delay AI move for better UX
  }
}

/**
 * Checks if the current player has any valid moves with the given dice value.
 * @param {Object} game - The current game state.
 * @param {number} playerIndex - The index of the current player.
 * @returns {boolean} True if there's at least one valid move, false otherwise.
 */
export function checkForValidMoves(game, playerIndex) {
  const allowedColors = game.players[playerIndex].colors;
  return game.tokens.some(token => {
    if (!allowedColors.includes(token.color.toLowerCase())) return false; // Only current player's tokens
    return isValidMove(game, token); // Uses game.diceValue which is set temporarily
  });
}

/**
 * Makes a computer move (AI player).
 * @param {Object} game - The current game state.
 */
export function makeComputerMove(game) {
  if (game.gameOver) return; // Do not make moves if game is over

  // Simulate dice roll for AI
  const rolls = [1, 2].map(() => Math.floor(Math.random() * 6) + 1);
  game.originalRolls = [...rolls];
  game.currentRolls = [...rolls];
  game.rolledValue = game.originalRolls;


  // Filter for valid moves with available rolls
  const possibleMoves = [];
  game.currentRolls.forEach((r, i) => {
    game.diceValue = r; // Set dice value for isValidMove check
    game.tokens.forEach(t => {
      if (game.players[game.currentPlayer].colors.includes(t.color.toLowerCase()) && isValidMove(game, t)) {
        possibleMoves.push({ t: t, r: r, i: i });
      }
    });
  });

  // If no valid moves, skip turn
  if (!possibleMoves.length) {
    nextTurn(game);
    return;
  }

  // Simple AI: Prioritize getting out of base or moving closest to home
  let bestMove = null;
  // If a 6 is rolled, try to get a token out of the home base
  if (rolls.includes(6)) {
      bestMove = possibleMoves.find(m => m.r === 6 && m.t.position === -1);
  }

  // If no 6 or already out, pick the first valid move
  if (!bestMove) {
    bestMove = possibleMoves[0]; // Simple: just take the first available valid move
  }


  // Execute the move
  if (bestMove) {
    game.diceValue = bestMove.r; // Set the actual dice value for the move
    moveToken(game, bestMove.t);
    // Remove the used roll value
    game.currentRolls.splice(bestMove.i, 1);
  }

  // If a 6 was used and there are remaining rolls, AI takes another turn
  if (bestMove && bestMove.r === 6 && game.currentRolls.length) {
      setTimeout(() => makeComputerMove(game), 500); // Recursive call for extra turn on 6
  } else {
      nextTurn(game); // End AI turn
  }
}