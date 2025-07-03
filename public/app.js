

// Global variables
let socket;
let gameId = null;
let playerId = localStorage.getItem('playerId') || crypto.randomUUID();
let playerIndex = null; // 0-3 index
let playerColors = [];
let boardPaths = null;
let selectedToken = null;
let currentRolls = [];
let gameState = null;
let isMyTurn = false;
let gridSize = 40;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let connectionInitialized = false;
let connectionStatus = 'disconnected';

// DOM Elements
const gameLobby = document.getElementById('game-lobby');
const gameContainer = document.getElementById('game-container');
const createGameBtn = document.getElementById('create-game-btn');
const createAIGameBtn = document.getElementById('create-ai-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const rejoinGameBtn = document.getElementById('rejoin-game-btn');
const gameIdInput = document.getElementById('game-id-input');
const gameIdDisplay = document.getElementById('game-id');
const playerNumberDisplay = document.getElementById('player-number');
const playerColorsDisplay = document.getElementById('player-colors');
const turnStatusDisplay = document.getElementById('turn-status');
const gameOverBanner = document.getElementById('game-over-banner');
const winnerMessage = document.getElementById('winner-message');
const copyLinkBtn = document.getElementById('copy-link-btn');
const gameBoard = document.getElementById('game-board');
const rollDiceBtn = document.getElementById('roll-dice-btn');
const skipTurnBtn = document.getElementById('skip-turn-btn');
const dice1 = document.getElementById('dice1');
const dice2 = document.getElementById('dice2');
const toastContainer = document.getElementById('toast-container');



// Connect to the server
function connectToServer() {
  // Generate a new playerId each time
  if (connectionInitialized && socket?.connected) {
    console.log('Already connected');
    return;
  }

  // Clean up previous connection
  if (socket) {
    socket.removeAllListeners();
    if (socket.connected) socket.disconnect();
  }
  
  console.log('Generated playerId:', playerId);
  localStorage.setItem('playerId', playerId); // Store playerId in localStorage
  // Determine host URL
  const host = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : window.location.origin;

  // Establish socket connection
  socket = io(host, {
    auth: {
      playerId: playerId,
      gameId: gameId || null
    },
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket'],
    upgrade: false,
    rememberUpgrade: true,
    withCredentials: true
  });

  // Setup socket event listeners
  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);
  socket.on('reconnect', onReconnect);
  socket.on('reconnect_failed', onReconnectFailed);
  socket.on('gameStateUpdated', onGameStateUpdated);
  socket.on('diceRolled', onDiceRolled);
  socket.on('playerDisconnected', onPlayerDisconnected);
  socket.on('game_error', onGameError);
  socket.on('error', onError);
  socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    connectionStatus = 'error';
    showToast(`Connection error: ${err.message}`, 'error');
  });

  connectionInitialized = true;
}

// Socket event handlers
function onConnect() {
  console.log('Connected to server');
  reconnectAttempts = 0;

  // Request board paths
  socket.emit('getBoardPaths', (paths) => {
    boardPaths = paths;
    console.log('Board paths received:', boardPaths);

    // Check for URL game ID
    const urlParams = new URLSearchParams(window.location.search);
    const joinGameId = urlParams.get('join');
    
    if (joinGameId) {
      gameIdInput.value = joinGameId;
      joinGame(joinGameId);
    }
    // Note: Removed checkSavedGame() call since we're not using localStorage
  });
}

function onDisconnect() {
  showToast('Disconnected from server. Attempting to reconnect...', 'warning');
  showReconnectForm();
}

function onReconnect(attempt) {
  showToast(`Reconnected after ${attempt} attempts`, 'success');
  reconnectAttempts = 0;
  playerId = localStorage.getItem('playerId') 
  
  console.log('Reconnected successfully');
  if (gameId && playerId) {
    socket.emit('rejoinGame', { gameId, playerId }, (response) => {
      if (!response.error) {
        onGameStateUpdated(response);
      }
    });
  }
}

function onReconnectFailed() {
  showToast('Failed to reconnect to server. Please refresh the page.', 'error');
  showReconnectForm();
}

function onGameError(error) {
  showToast(error.message || 'Game error occurred', 'error');
  console.error('Game error:', error);
  if (error.isTurnError) {
    rollDiceBtn.disabled = true;
  }
}

function onError(error) {
  showToast(error.message || 'An error occurred', 'error');
}

function rejoinGame() {
  const gameIdValue = gameIdInput.value.trim();
  
  if (!gameIdValue) {
    showToast('Please enter Game ID to rejoin', 'error');
    return;
  }

  console.log('Rejoining game with ID:', gameIdValue, playerId);
  socket.emit('rejoinGame', { gameId: gameIdValue, playerId: playerId }, (response) => {
    if (response.error) {
      showToast(response.error, 'error');
      console.log('Rejoin error:', response.error);
      return;
    }

    console.log('Rejoined game response:', response);

    // Update global variables with successful rejoin data
    gameId = gameIdValue;
    playerId = playerId || response.playerId;
    playerIndex = response.playerIndex;
    playerColors = response.colors || [];
    
    showGameBoard();
    onGameStateUpdated(response);
    showToast('Successfully rejoined game!', 'success');
  });
}

function onGameStateUpdated(data) {
  console.log("Game state updated:", data);
  gameState = data;
  currentRolls = data.dice || [];
  isMyTurn = data.myTurn;

  // Update turn status
  updateTurnStatus();

  // Handle game over state
  if (data.gameOver) {
    gameOverBanner.style.display = 'block';
    if (data.winner !== null) {
      winnerMessage.textContent = data.winner === playerIndex
        ? 'You won! 🎉'
        : 'You lost. Better luck next time!';
    }
    // rollDiceBtn.disabled = true;
    // skipTurnBtn.disabled = true;
  }

  // Update dice display
  updateDiceDisplay();

  // Update board
  drawBoard();
}

function onDiceRolled(data) {
  // Update dice UI
  updateDiceUI(data.dice);

  // Display toast message
  const message = data.playerId === playerId
    ? `You rolled ${data.dice.join(' and ')}!`
    : `Opponent rolled ${data.dice.join(' and ')}!`;

  showToast(message, data.playerId === playerId ? 'info' : 'default');
}

function onPlayerDisconnected() {
  showToast('A player has disconnected from the game.', 'error');
}

// Game actions
function createGame(vsComputer) {
  socket.emit('createGame', { vsComputer, playerId }, (response) => {
    if (response.error) {
      showToast(response.error, 'error');
      return;
    }

    gameId = response.gameId;
    playerIndex = 0; // Creator is always player 0
    playerColors = response.colors || ['red', 'yellow'];
    console.log('Game created:', response);

    showGameBoard();
    showToast(`Game created! ID: ${response.gameId}`, 'success');
  });
}

function joinGame(id) {
  socket.emit('joinGame', { gameId: id, playerId }, (response) => {
    if (response.error) {
      showToast(response.error, 'error');
      return;
    }

    gameId = response.gameId;
    playerIndex = 1; // Joiner is always player 1
    playerColors = response.colors || ['green', 'blue'];

    showGameBoard();
    showToast(`Joined game ${response.gameId}`, 'success');
  });
}

function rollDice() {
  if (!isMyTurn) {
    showToast("It's not your turn!", 'warning');
    return;
  }

  if (!gameId || !socket?.id || !playerId) {
    showToast("Game connection error", 'error');
    return;
  }

  // Disable roll button while processing
  rollDiceBtn.disabled = true;

  socket.emit('rollDice', { gameId }, (response) => {
    if (response?.error) {
      showToast(response.error, 'error');
      rollDiceBtn.disabled = false;
    }
  });
}

function playToken(tokenId, rolledValue) {
  if (!isMyTurn || currentRolls.length === 0) {
    showToast("Cannot move token now", 'warning');
    return;
  }

  socket.emit('playRoll', {
    gameId,
    tokenId,
    rolledValue
  });

  selectedToken = null;
  drawBoard(); // Update board to remove selection
}

function skipTurn() {
  if (!isMyTurn) {
    showToast("It's not your turn!", 'warning');
    return;
  }

  socket.emit('skipTurn', { gameId });
}

// UI Functions
function showGameBoard() {
  gameLobby.style.display = 'none';
  gameContainer.style.display = 'block';
  rejoinGameBtn.style.display = 'none';

  // Update game info
  gameIdDisplay.textContent = gameId;
  playerNumberDisplay.textContent = playerId;

  // Show player colors
  playerColorsDisplay.innerHTML = '';
  playerColors.forEach(color => {
    const colorDot = document.createElement('span');
    colorDot.className = 'color-dot';
    colorDot.style.backgroundColor = getColorHex(color);
    playerColorsDisplay.appendChild(colorDot);
  });

  // Set canvas size based on container
  resizeGameBoard();
  window.addEventListener('resize', resizeGameBoard);
}

function resizeGameBoard() {
  const container = gameBoard.parentElement;
  const size = Math.min(container.clientWidth, window.innerHeight * 0.7);

  gameBoard.width = size;
  gameBoard.height = size;

  // Adjust grid size based on canvas size
  gridSize = size / 15; // Assuming a 15x15 grid

  // Redraw if data exists
  if (boardPaths && gameState && gameState.tokens) {
    drawBoard();
  }
}

function updateTurnStatus() {
  turnStatusDisplay.textContent = isMyTurn ?
    "It's your turn!" :
    "Waiting for other player...";

  turnStatusDisplay.className = isMyTurn ? 'your-turn' : 'waiting';

  // Update buttons
  rollDiceBtn.disabled = !isMyTurn || currentRolls.length > 0;
  skipTurnBtn.disabled = !isMyTurn || currentRolls.length === 0;
}

function updateDiceDisplay() {
  if (currentRolls.length === 0) {
    dice1.textContent = '';
    dice2.textContent = '';
    dice1.classList.add('disabled');
    dice2.classList.add('disabled');
  } else if (currentRolls.length === 1) {
    dice1.textContent = currentRolls[0];
    dice2.textContent = '';
    dice1.classList.remove('disabled');
    dice2.classList.add('disabled');
  } else {
    dice1.textContent = currentRolls[0];
    dice2.textContent = currentRolls[1];
    dice1.classList.remove('disabled');
    dice2.classList.remove('disabled');
  }
}

function updateDiceUI(dice) {
  if (dice.length >= 1) {
    dice1.textContent = dice[0];
    animateDice(dice1);
  }

  if (dice.length >= 2) {
    dice2.textContent = dice[1];
    animateDice(dice2);
  }
}

function animateDice(diceElement) {
  diceElement.classList.add('animate');
  diceElement.style.animation = 'none';
  diceElement.offsetHeight; // Trigger reflow
  diceElement.style.animation = 'dice-roll 0.5s';

  setTimeout(() => {
    diceElement.classList.remove('animate');
  }, 500);
}

function drawBoard() {
  if (!boardPaths || !gameBoard || !gameState) return;

  const ctx = gameBoard.getContext('2d');
  const width = gameBoard.width;
  const height = gameBoard.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw board background
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, width, height);

  // Draw color quadrants
  drawQuadrant(ctx, 'RED', 0, 0);
  drawQuadrant(ctx, 'GREEN', 0, height - 6 * gridSize);
  drawQuadrant(ctx, 'YELLOW', width - 6 * gridSize, height - 6 * gridSize);
  drawQuadrant(ctx, 'BLUE', width - 6 * gridSize, 0);

  // Draw common path
  drawCommonPath(ctx);

  // Draw home paths
  drawHomePaths(ctx);

  // Draw safe zones
  drawSafeZones(ctx);

  // Draw center
  drawCenter(ctx);

  // Draw tokens
  drawTokens(ctx);
}

function drawQuadrant(ctx, color, x, y) {
  ctx.fillStyle = getLightColorHex(color);
  ctx.fillRect(x, y, 6 * gridSize, 6 * gridSize);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, 6 * gridSize, 6 * gridSize);

  // Draw home base
  const homeBaseSize = 4 * gridSize;
  const homeBaseX = x + gridSize;
  const homeBaseY = y + gridSize;

  ctx.fillStyle = getColorHex(color);
  ctx.fillRect(homeBaseX, homeBaseY, homeBaseSize, homeBaseSize);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(homeBaseX, homeBaseY, homeBaseSize, homeBaseSize);
}

function drawCommonPath(ctx) {
  if (!boardPaths?.commonPath) return;
  const pathCoords = boardPaths.commonPath.coords;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < pathCoords.length; i++) {
    const [x, y] = pathCoords[i];
    ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * gridSize, y * gridSize, gridSize, gridSize);
  }
}

function drawHomePaths(ctx) {
  if (!boardPaths?.homePaths) return;
  Object.entries(boardPaths.homePaths).forEach(([color, path]) => {
    const pathCoords = path.coords;
    ctx.fillStyle = getLightColorHex(color);
    for (let i = 0; i < pathCoords.length; i++) {
      const [x, y] = pathCoords[i];
      ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.strokeRect(x * gridSize, y * gridSize, gridSize, gridSize);
    }
  });
}

function drawSafeZones(ctx) {
  if (!boardPaths?.safeZones) return;
  boardPaths.safeZones.forEach(zone => {
    if (!zone.coords) return;
    const [x, y] = zone.coords[0];
    ctx.fillStyle = getLightColorHex(zone.color);
    ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * gridSize, y * gridSize, gridSize, gridSize);
  });
}

function drawCenter(ctx) {
  if (!boardPaths?.center) return;
  const centerCoords = boardPaths.center.coords;
  if (!centerCoords || centerCoords.length < 1) return;
  
  const [x, y] = centerCoords[0];
  const centerSize = gridSize;
  const colors = ['red', 'green', 'yellow', 'blue'];
  const centerX = x * gridSize + gridSize / 2;
  const centerY = y * gridSize + gridSize / 2;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  for (let i = 0; i < colors.length; i++) {
    ctx.fillStyle = getColorHex(colors[i]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(Math.PI / 2 * i) * centerSize, Math.sin(Math.PI / 2 * i) * centerSize);
    ctx.lineTo(Math.cos(Math.PI / 2 * (i + 1)) * centerSize, Math.sin(Math.PI / 2 * (i + 1)) * centerSize);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTokens(ctx) {
  if (!gameState?.tokens) return;
  
  gameState.tokens.forEach(token => {
    // Convert grid coordinates to canvas pixels
    const canvasX = token.x * gridSize + gridSize / 2;
    const canvasY = token.y * gridSize + gridSize / 2;

    // Draw the token (circle)
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, gridSize * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = getColorHex(token.color);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw token ID for identification
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + (gridSize * 0.2) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(token.id.split('-')[1] || token.index, canvasX, canvasY);

    // Highlight selected token
    if (selectedToken === token.id) {
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, gridSize * 0.4, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Highlight clickable tokens
    if (token.isClickable) {
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, gridSize * 0.35, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

// Utility functions
function getColorHex(colorName) {
  const colors = {
    'red': '#FF0000',
    'green': '#008000',
    'yellow': '#FFFF00',
    'blue': '#0000FF',
    'RED': '#FF0000',
    'GREEN': '#008000',
    'YELLOW': '#FFFF00',
    'BLUE': '#0000FF'
  };
  return colors[colorName] || '#CCCCCC';
}

function getLightColorHex(colorName) {
  const lightColors = {
    'red': '#FFCCCC',
    'green': '#CCFFCC',
    'yellow': '#FFFFCC',
    'blue': '#CCCCFF',
    'RED': '#FFCCCC',
    'GREEN': '#CCFFCC',
    'YELLOW': '#FFFFCC',
    'BLUE': '#CCCCFF'
  };
  return lightColors[colorName] || '#EEEEEE';
}

function showToast(message, type = 'info') {
  if (!toastContainer) {
    console.warn('Toast container not found');
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, 3000);
}

function showReconnectForm() {
  rejoinGameBtn.style.display = 'block';
}

function handleManualReconnect() {
  rejoinGame(); // Use the updated rejoin function
}

// Event listeners
window.addEventListener('resize', resizeGameBoard);
createGameBtn.addEventListener('click', () => createGame(false));
createAIGameBtn.addEventListener('click', () => createGame(true));
joinGameBtn.addEventListener('click', () => joinGame(gameIdInput.value.trim()));
rejoinGameBtn.addEventListener('click', handleManualReconnect);
rollDiceBtn.addEventListener('click', rollDice);
skipTurnBtn.addEventListener('click', skipTurn);

copyLinkBtn.addEventListener('click', () => {
  if (gameId) {
    const inviteLink = `${window.location.origin}?join=${gameId}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      showToast('Invite link copied!', 'success');
    }).catch(err => {
      console.error('Failed to copy link: ', err);
      showToast('Failed to copy link.', 'error');
    });
  }
});

// Handle token click
gameBoard.addEventListener('click', (event) => {
  if (!gameState?.tokens || !isMyTurn) return;

  const rect = gameBoard.getBoundingClientRect();
  const scaleX = gameBoard.width / rect.width;
  const scaleY = gameBoard.height / rect.height;

  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;

  let closestToken = null;
  let minDistance = Infinity;

  gameState.tokens.forEach(token => {
    if (!token.isClickable) return;

    const dx = (token.x * gridSize + gridSize / 2) - clickX;
    const dy = (token.y * gridSize + gridSize / 2) - clickY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance && distance < gridSize) {
      minDistance = distance;
      closestToken = token;
    }
  });

  if (closestToken) {
    selectedToken = closestToken.id;
    drawBoard();
    showToast(`Selected token ${closestToken.id}`, 'info');
  }
});

// Handle dice click for selecting roll when token is selected
dice1.addEventListener('click', () => {
  if (!selectedToken) {
    showToast('First select a token to move.', 'warning');
    return;
  }
  if (selectedToken && currentRolls.length > 0) {
    playToken(selectedToken, currentRolls[0]);
  }
});

dice2.addEventListener('click', () => {
  if (!selectedToken) {
    showToast('First select a token to move.', 'warning');
    return;
  }
  if (selectedToken && currentRolls.length > 1) {
    playToken(selectedToken, currentRolls[1]);
  }
});

// Add cleanup when leaving page
window.addEventListener('beforeunload', () => {
  if (socket && gameId && playerId) {
    socket.emit('leaveGame', { gameId, playerId });
  }
});

// Initialize connection
connectToServer();