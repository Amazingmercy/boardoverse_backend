// Global variables
let socket;
let gameId = null;
let playerId = null;
let playerColors = [];
let boardPaths = null;
let selectedToken = null;
let currentRolls = [];
let tokenData = [];
let isMyTurn = false;
let gridSize = 40; // Size of each board grid cell in pixels



// DOM Elements
const gameLobby = document.getElementById('game-lobby');
const gameContainer = document.getElementById('game-container');
const createGameBtn = document.getElementById('create-game-btn');
const createAIGameBtn = document.getElementById('create-ai-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
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

// Connect to the server
function connectToServer() {
  // Determine the hostname dynamically
  const host = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
  socket = io(host);

  // Setup socket event listeners
  socket.on('connect', onConnect);
  socket.on('gameStateUpdated', onGameStateUpdated);
  socket.on('diceRolled', onDiceRolled);
  socket.on('playerDisconnected', onPlayerDisconnected);
}

// Socket event handlers
function onConnect() {
  console.log('Connected to server');

  // Request board paths once connected
  socket.emit('getBoardPaths', (paths) => {
    boardPaths = paths
    console.log('Board paths received:', boardPaths);

    // Check for URL game ID
    const urlParams = new URLSearchParams(window.location.search);
    const joinGameId = urlParams.get('join');
    if (joinGameId) {
      gameIdInput.value = joinGameId;
      joinGame(joinGameId);
    }

  });
}

function onGameStateUpdated(data) {
  console.log("Game state updated:", data);
  tokenData = data.tokens || [];
  currentRolls = data.dice || [];
  isMyTurn = data.myTurn || false;

  // Update turn status
  updateTurnStatus();

  // Handle game over state
  if (data.gameOver) {
    gameOverBanner.style.display = 'block';
    if (data.winner !== null) {
      winnerMessage.textContent = data.winner === playerId
        ? 'You won! 🎉'
        : 'You lost. Better luck next time!';
    }

    rollDiceBtn.disabled = true;
    skipTurnBtn.disabled = true;
  }

  // Update dice display
  updateDiceDisplay();

  // Update board
  drawBoard();
}

function onDiceRolled(data) {
  // Show dice values
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
  socket.emit('createGame', { vsComputer }, (response) => {
    if (response.error) {
      showToast(response.error, 'error');
      return;
    }

    // Save game info
    gameId = response.gameId;
    playerId = response.playerId;
    playerColors = response.colors || [];

    // Show game board
    showGameBoard();


    showToast(`Game created! ID: ${response.gameId}`, 'success');
  });
}

function joinGame(id) {
  socket.emit('joinGame', id, (response) => {
    if (response.error) {
      showToast(response.error, 'error');
      return;
    }

    // Save game info
    gameId = response.gameId;
    playerId = response.playerId;
    playerColors = response.colors || [];

    // Show game board
    showGameBoard();

    // Save game info in local storage for reconnection
    localStorage.setItem('ludoGame', JSON.stringify({
      gameId: response.gameId,
      playerId: response.playerId,
      colors: response.colors || [],
      timestamp: Date.now()
    }));

    showToast(`Joined game ${response.gameId}`, 'success');
  });
}

function rollDice() {
  if (!isMyTurn) return;

  socket.emit('rollDice');
  rollDiceBtn.disabled = false;
}

function playToken(tokenId, rolledValue) {
  if (!isMyTurn || currentRolls.length === 0) return;

  socket.emit("playRoll", {
    tokenId: tokenId,
    rolledValue: rolledValue,
  });

  selectedToken = null;
}

function skipTurn() {
  if (!isMyTurn) return;

  socket.emit('skipTurn');
  rollDiceBtn.disabled = true;
  skipTurnBtn.disabled = true;
}


// UI Functions
function showGameBoard() {
  gameLobby.style.display = 'none';
  gameContainer.style.display = 'block';

  // Update game info
  gameIdDisplay.textContent = gameId;
  playerNumberDisplay.textContent = playerId !== null ? (playerId + 1).toString() : '';

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
  if (boardPaths && tokenData.length > 0) {
    drawBoard();
  }
}

function updateTurnStatus() {
  turnStatusDisplay.textContent = isMyTurn ?
    "It's your turn!" :
    "Waiting for other player...";

  turnStatusDisplay.className = isMyTurn ? 'your-turn' : 'waiting';

  // Update buttons
  rollDiceBtn.disabled = !isMyTurn;
  skipTurnBtn.disabled = !isMyTurn || currentRolls.length === 0;
}

function updateDiceDisplay() {
  if (currentRolls.length === 0) {
    dice1.textContent = '';
    dice2.textContent = '';
    dice2.style.pointerEvents = 'none';
    dice2.classList.add('disabled');
  } else if (currentRolls.length === 1) {
    dice1.textContent = currentRolls[0];
    dice2.textContent = '';
    dice2.style.pointerEvents = 'none';
    dice2.classList.add('disabled');
  } else {
    dice1.textContent = currentRolls[0];
    dice2.textContent = currentRolls[1];
    dice2.style.pointerEvents = '';
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
  if (!boardPaths || !gameBoard) return;

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

  // Removed drawing of startAreas from here as it's handled by drawSafeZones
}

function drawCommonPath(ctx) {
  if (!boardPaths || !boardPaths.commonPath) return;
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
  if (!boardPaths || !boardPaths.homePaths) return;
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
  if (!boardPaths || !boardPaths.safeZones) return;
  boardPaths.safeZones.forEach(zone => {
    if (!zone.coords) return;
    const [x, y] = zone.coords[0]; // 1) fill the background square in the player color:
    ctx.fillStyle = getLightColorHex(zone.color); // e.g. '#FF0000' for 'red'
    ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
    ctx.fill();
  });
}

function drawCenter(ctx) {
  if (!boardPaths || !boardPaths.center) return;
  const centerCoords = boardPaths.center.coords;
  if (!centerCoords || centerCoords.length < 1) return;
  const [x, y] = centerCoords[0];
  const centerSize = gridSize * 2; // Draw colored triangles for center
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
  tokenData.forEach(token => {
    let tokenX, tokenY;
    if (token.position === -1) {
      // Token is in home base
      tokenX = token.x;
      tokenY = token.y;
    } else if (token.position >= 57) { // Token is in center (completed)
      const centerCoords = boardPaths.center.coords[0];
      tokenX = centerCoords[0];
      tokenY = centerCoords[1];
    } else { // Token is on common path or home path
      let coords;
      if (token.position >= 100) { // Home path
        const playerIndex = token.playerIndex;
        const homePathStart = 100 + playerIndex * 10;
        const homePathOffset = token.position - homePathStart;
        coords = Object.values(boardPaths.homePaths)[playerIndex].coords[homePathOffset];
      } else { // Common path
        coords = boardPaths.commonPath.coords[token.position];
      }
      tokenX = coords[0];
      tokenY = coords[1];
    }

    // Convert grid coordinates to canvas pixels
    const canvasX = tokenX * gridSize + gridSize / 2;
    const canvasY = tokenY * gridSize + gridSize / 2;

    // Draw the token (circle)
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, gridSize * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = getColorHex(token.color);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw token ID for debugging (optional)
    ctx.fillStyle = '#000';
    ctx.font = 'bold ' + (gridSize * 0.3) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(token.id.split('-')[1], canvasX, canvasY);

    // Highlight selected token
    if (selectedToken === token.id) {
      ctx.strokeStyle = 'cyan';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Highlight clickable tokens
    if (token.isClickable) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

// Utility functions (getColorHex, getLightColorHex, showToast) - assuming these are defined elsewhere or correctly
function getColorHex(colorName) {
  const colors = {
    'RED': '#FF0000',
    'GREEN': '#008000',
    'YELLOW': '#FFFF00',
    'BLUE': '#0000FF'
  };
  return colors[colorName.toUpperCase()] || '#CCCCCC';
}

function getLightColorHex(colorName) {
  const lightColors = {
    'RED': '#FFCCCC',
    'GREEN': '#CCFFCC',
    'YELLOW': '#FFFFCC',
    'BLUE': '#CCCCFF'
  };
  return lightColors[colorName.toUpperCase()] || '#EEEEEE';
}

function showToast(message, type = 'default') {
  const toastContainer = document.getElementById('toast-container');
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


// Event listeners
createGameBtn.addEventListener('click', () => createGame(false));
createAIGameBtn.addEventListener('click', () => createGame(true));
joinGameBtn.addEventListener('click', () => joinGame(gameIdInput.value));
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
  const rect = gameBoard.getBoundingClientRect();
  const scaleX = gameBoard.width / rect.width;
  const scaleY = gameBoard.height / rect.height;

  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;

  let closestToken = null;
  let minDistance = Infinity;

  tokenData.forEach(token => {
    if (!token.isClickable) return;

    // MODIFICATION START
    // Destructure the array returned by getTokenGridPosition into tokenGridX and tokenGridY
    const [tokenGridX, tokenGridY] = getTokenGridPosition(token); 
    // MODIFICATION END

    const dx = (tokenGridX * gridSize + gridSize / 2) - clickX;
    const dy = (tokenGridY * gridSize + gridSize / 2) - clickY;
    const distance = Math.sqrt(dx * dx + dy * dy);



    if (distance < minDistance) {
      minDistance = distance;
      closestToken = token;
    }
  });

  if (closestToken) {
    selectedToken = closestToken.id;
    drawBoard();
  }
});

function getTokenGridPosition(token) {
  if (token.position === -1) {
    return [token.x, token.y];
  } else if (token.position >= 57) { // Token is in center
    return boardPaths.center.coords[0];
  } else {
    // Determine if it's on common path or home path
    if (token.position >= 100) { // Home path
      const playerIndex = token.playerIndex;
      const homePathStart = 100 + playerIndex * 10;
      const homePathOffset = token.position - homePathStart;
      return Object.values(boardPaths.homePaths)[playerIndex].coords[homePathOffset];
    } else { // Common path
      return boardPaths.commonPath.coords[token.position];
    }
  }
}

// Handle dice click for selecting roll when token is selected
dice1.addEventListener('click', () => {
  if (!selectedToken) {
    showToast('First select a token to move.', 'warning');
    return;
  }
  console.log("Dice clicked", selectedToken, currentRolls)
  if (selectedToken && currentRolls.length > 0) {
    const face = currentRolls[0];
    playToken(selectedToken, face);
  }
});

dice2.addEventListener('click', () => {
  if (!selectedToken) {
    showToast('First select a token to move.', 'warning');
    return;
  }
  if (selectedToken && currentRolls.length > 1) {
    const face = currentRolls[1];
    playToken(selectedToken, face);
  }
});


// Initialize connection
connectToServer();