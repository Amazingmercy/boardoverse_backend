// Main application logic
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const createGameBtn = document.getElementById('create-game');
    const joinGameBtn = document.getElementById('join-game');
    const gameIdInput = document.getElementById('game-id-input');
    const gameIdDisplay = document.getElementById('game-id');
    const vsComputerCheckbox = document.getElementById('vs-computer');
    const rollDiceBtn = document.getElementById('roll-dice');
    const skipTurnBtn = document.getElementById('skip-turn');
    const statusMessage = document.getElementById('status-message');
    const dice1 = document.getElementById('dice-1');
    const dice2 = document.getElementById('dice-2');
  
    // Game state
    let gameState = {
      myTurn: false,
      dice: []
    };
  
    // Initialize socket connection
    socketManager.init();
  
    // Initialize the board
    boardManager.initBoard();
  
    // Set up event handlers
    createGameBtn.addEventListener('click', () => {
      const vsComputer = vsComputerCheckbox.checked;
      socketManager.createGame(vsComputer);
    });
  
    joinGameBtn.addEventListener('click', () => {
      const gameId = gameIdInput.value.trim();
      if (gameId) {
        socketManager.joinGame(gameId);
      } else {
        showError('Please enter a game ID');
      }
    });
  
    rollDiceBtn.addEventListener('click', () => {
      if (gameState.myTurn) {
        animateDiceRolling();
        socketManager.rollDice();
      }
    });
  
    skipTurnBtn.addEventListener('click', () => {
      if (gameState.myTurn && gameState.dice.length > 0) {
        socketManager.skipTurn();
      }
    });
  
    // Set up socket event handlers
    socketManager.on('onGameCreated', (data) => {
      showGameScreen(data.gameId);
      updateStatus('Waiting for opponent...');
      if (vsComputerCheckbox.checked) {
        updateStatus('Game started! Your turn.');
      }
    });
  
    socketManager.on('onGameJoined', (data) => {
      showGameScreen(data.gameId);
      updateStatus('Game joined! Waiting for your turn...');
    });
  
    socketManager.on('onGameStateUpdated', (data) => {
      console.log('Game state updated:', data);
      gameState = data;
      
      // Update the board with new token positions
      boardManager.renderTokens(data.tokens);
      
      // Update dice display
      renderDice(data.dice);
      
      // Update game status
      updateGameStatus();
      
      // Enable/disable controls
      updateControls();
    });
  
    socketManager.on('onDiceRolled', (data) => {
      console.log('Dice rolled:', data);
      
      // Show the rolled dice values
      renderDice(data.rolls);
      
      if (data.playerId === socketManager.playerId) {
        gameState.myTurn = true;
        gameState.dice = data.rolls;
        updateStatus('Your roll! Select a token to move.');
      } else {
        updateStatus('Opponent rolled the dice.');
      }
      
      // Stop dice rolling animation
      stopDiceAnimation();
      
      // Update controls
      updateControls();
    });
  
    socketManager.on('onPlayerDisconnected', () => {
      updateStatus('Opponent disconnected!', true);
    });
  
    socketManager.on('onError', (errorMsg) => {
      showError(errorMsg);
    });
  
    // Set up token click handler
    boardManager.onTokenClick = (tokenId, rollIdx) => {
      if (gameState.myTurn && gameState.dice.length > 0) {
        socketManager.playRoll(tokenId, rollIdx);
      }
    };
  
    // Helper functions
    function showGameScreen(gameId) {
      startScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
      gameIdDisplay.textContent = gameId;
      
      // Resize the board on screen change
      setTimeout(() => {
        boardManager.initBoard();
      }, 100);
    }
  
    function updateStatus(message, isError = false) {
      statusMessage.textContent = message;
      statusMessage.className = isError ? 'error' : '';
    }
  
    function showError(message) {
      console.error('Error:', message);
      alert('Error: ' + message);
    }
  
    function renderDice(diceValues) {
      dice1.textContent = '';
      dice2.textContent = '';
      
      if (diceValues && diceValues.length > 0) {
        dice1.textContent = diceValues[0] || '';
        if (diceValues.length > 1) {
          dice2.textContent = diceValues[1] || '';
        }
      }
      
      // Highlight dice that can be used
      if (gameState.myTurn) {
        dice1.classList.toggle('clickable', diceValues && diceValues.length > 0);
        dice2.classList.toggle('clickable', diceValues && diceValues.length > 1);
        
        // Add click event listeners to dice
        dice1.onclick = () => {
          if (diceValues && diceValues.length > 0) {
            selectDice(0);
          }
        };
        
        dice2.onclick = () => {
          if (diceValues && diceValues.length > 1) {
            selectDice(1);
          }
        };
      } else {
        dice1.classList.remove('clickable');
        dice2.classList.remove('clickable');
        dice1.onclick = null;
        dice2.onclick = null;
      }
    }
  
    function selectDice(index) {
      // Remove selected class from all dice
      dice1.classList.remove('selected');
      dice2.classList.remove('selected');
      
      // Add selected class to the clicked dice
      if (index === 0) {
        dice1.classList.add('selected');
      } else {
        dice2.classList.add('selected');
      }
      
      // Update the selected roll index
      boardManager.setSelectedRollIndex(index);
      
      // Highlight valid moves
      boardManager.highlightValidMoves();
    }
  
    function animateDiceRolling() {
      dice1.className = 'dice rolling';
      dice2.className = 'dice rolling';
      dice1.textContent = '?';
      dice2.textContent = '?';
    }
  
    function stopDiceAnimation() {
      dice1.classList.remove('rolling');
      dice2.classList.remove('rolling');
    }
  
    function updateGameStatus() {
      if (gameState.gameOver) {
        if (gameState.winner === socketManager.playerId) {
          updateStatus('You won! 🎉');
        } else {
          updateStatus('You lost! Better luck next time.');
        }
      } else if (gameState.myTurn) {
        if (gameState.dice.length > 0) {
          updateStatus('Your turn! Select a dice and then a token.');
        } else {
          updateStatus('Your turn! Roll the dice.');
        }
      } else {
        updateStatus('Waiting for opponent...');
      }
    }
  
    function updateControls() {
      rollDiceBtn.disabled = !gameState.myTurn || gameState.dice.length > 0;
      skipTurnBtn.disabled = !gameState.myTurn || gameState.dice.length === 0;
    }
  
    // Handle window resize
    window.addEventListener('resize', () => {
      boardManager.initBoard();
      if (gameState.tokens) {
        boardManager.renderTokens(gameState.tokens);
      }
    });
  });
  