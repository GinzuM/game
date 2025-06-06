    (function() {
      let GG_ALL_GAME_CONFIG = {
        playerSpeed: 0.0525, // Velocidade de movimento do jogador
        rotationSpeed: 2.1, // Velocidade de rotação do jogador
        fov: 60, // Campo de visão do jogador em graus
        raycastResolution: 320, // Resolução do raycasting
        friction: 0.8, // Fator de atrito para suavizar o movimento
        acceleration: 0.015, // Fator de aceleração para suavizar o movimento
        mapScale: 20, // Escala do mini-mapa
        startColor: '#00ff00', // Cor do início do labirinto
        endColor: '#ffa500', // Cor do fim do labirinto (laranja)
        endBorderColor: '#ff4500', // Cor da borda da saída (vermelho-laranja)
        mapChangeThreshold: 0.1, // Limiar para mudança aleatória no mapa
        colorPalettes: [ // Paletas de cores para os mapas
          {
            wall: '#0000FF',
            sky: '#87CEEB',
            ground: '#228B22'
          },
          {
            wall: '#8B4513',
            sky: '#FFA500',
            ground: '#F4A460'
          },
          {
            wall: '#4B0082',
            sky: '#9370DB',
            ground: '#BA55D3'
          },
          {
            wall: '#2F4F4F',
            sky: '#B0E0E6',
            ground: '#20B2AA'
          },
          {
            wall: '#8B0000',
            sky: '#FFB6C1',
            ground: '#CD5C5C'
          }
        ],
        currentPalette: 0, // Índice da paleta de cores atual
        testMode: false, // Indica se o jogo está no modo de teste
        testModeSize: 7, // Tamanho do mapa para o modo de teste (25% menor que o tamanho anterior)
        runningSpeedMultiplier: 1.15, // Multiplicador de velocidade ao correr (15% mais rápido)
        isRunning: false, // Indica se o jogador está correndo
        isMobileMode: false, // Indica se o modo mobile está ativado
        mobileButtonSize: 'small' // Tamanho dos botões no modo mobile
      };
      const gameContainer = document.getElementById('game-container');
      const player = document.getElementById('player');
      const scoreDisplay = document.getElementById('score');
      const startBtn = document.getElementById('start-btn');
      const testModeBtn = document.getElementById('test-mode-btn');
      const pauseBtn = document.getElementById('pause-btn');
      const resumeBtn = document.getElementById('resume-btn');
      const restartBtn = document.getElementById('restart-btn');
      const canvas = document.getElementById('raycaster');
      const ctx = canvas.getContext('2d');
      canvas.width = 800;
      canvas.height = 600;
      const mobileControls = document.getElementById('mobile-controls');
      const mobileCheckbox = document.getElementById('mobile-checkbox');
      let gameLoop;
      let playerX = 1.5;
      let playerY = 1.5;
      let playerAngle = 0;
      let playerDX = 0;
      let playerDY = 0;
      let score = 0;
      let gameActive = false;
      let keys = {};
      let map = [];
      const MAP_WIDTH = 30;
      const MAP_HEIGHT = 30;
      let startX, startY, endX, endY;

      function generateMaze() {
        const currentMapWidth = GG_ALL_GAME_CONFIG.testMode ? GG_ALL_GAME_CONFIG.testModeSize : MAP_WIDTH;
        const currentMapHeight = GG_ALL_GAME_CONFIG.testMode ? GG_ALL_GAME_CONFIG.testModeSize : MAP_HEIGHT;
        // Inicializa o mapa com paredes
        map = Array(currentMapHeight).fill().map(() => Array(currentMapWidth).fill(1));
        // Função para verificar se uma célula está dentro dos limites do mapa
        const isValid = (x, y) => x > 0 && x < currentMapWidth - 1 && y > 0 && y < currentMapHeight - 1;
        // Função para obter vizinhos não visitados
        const getUnvisitedNeighbors = (x, y) => {
          const neighbors = [
            [x, y - 2],
            [x + 2, y],
            [x, y + 2],
            [x - 2, y]
          ];
          return neighbors.filter(([nx, ny]) => isValid(nx, ny) && map[ny][nx] === 1);
        };
        // Algoritmo de geração do labirinto (Recursive Backtracking)
        function carvePassages(x, y) {
          map[y][x] = 0;
          const neighbors = getUnvisitedNeighbors(x, y);
          while (neighbors.length > 0) {
            const [nx, ny] = neighbors.splice(Math.floor(Math.random() * neighbors.length), 1)[0];
            if (map[ny][nx] === 1) {
              map[(y + ny) / 2][(x + nx) / 2] = 0;
              carvePassages(nx, ny);
            }
          }
        }
        // Inicia a geração do labirinto
        carvePassages(1, 1);
        // Adiciona algumas células vazias aleatórias para criar mais caminhos
        for (let i = 0; i < currentMapHeight * currentMapWidth / 5; i++) {
          const x = Math.floor(Math.random() * (currentMapWidth - 2)) + 1;
          const y = Math.floor(Math.random() * (currentMapHeight - 2)) + 1;
          map[y][x] = 0;
        }
        // Define o início e o fim do labirinto
        startX = 1;
        startY = 1;
        // Encontra uma posição válida para a porta de saída
        do {
          endX = Math.floor(Math.random() * (currentMapWidth - 2)) + 1;
          endY = Math.floor(Math.random() * (currentMapHeight - 2)) + 1;
        } while (map[endY][endX] !== 0 || (endX === startX && endY === startY));
        map[startY][startX] = 2; // Início
        map[endY][endX] = 3; // Porta de saída
        // Garante que a posição inicial do jogador está vazia
        playerX = startX + 0.5;
        playerY = startY + 0.5;
      }

      function modifyMaze() {
        const currentMapWidth = GG_ALL_GAME_CONFIG.testMode ? GG_ALL_GAME_CONFIG.testModeSize : MAP_WIDTH;
        const currentMapHeight = GG_ALL_GAME_CONFIG.testMode ? GG_ALL_GAME_CONFIG.testModeSize : MAP_HEIGHT;
        for (let y = 1; y < currentMapHeight - 1; y++) {
          for (let x = 1; x < currentMapWidth - 1; x++) {
            if (Math.random() < GG_ALL_GAME_CONFIG.mapChangeThreshold) {
              map[y][x] = map[y][x] === 0 ? 1 : 0;
            }
          }
        }
        // Garante que o início e a porta de saída permanecem acessíveis
        map[startY][startX] = 2;
        map[endY][endX] = 3;
        // Garante que há um caminho entre o início e a porta de saída
        let currentX = startX;
        let currentY = startY;
        while (currentX !== endX || currentY !== endY) {
          if (currentX < endX && currentX + 1 < currentMapWidth) {
            currentX++;
            map[currentY][currentX] = 0;
          } else if (currentX > endX && currentX - 1 >= 0) {
            currentX--;
            map[currentY][currentX] = 0;
          }
          if (currentY < endY && currentY + 1 < currentMapHeight) {
            currentY++;
            map[currentY][currentX] = 0;
          } else if (currentY > endY && currentY - 1 >= 0) {
            currentY--;
            map[currentY][currentX] = 0;
          }
        }
      }
      generateMaze();
      // Definir cores para paredes e inimigos
      function getCurrentPalette() {
        return GG_ALL_GAME_CONFIG.colorPalettes[GG_ALL_GAME_CONFIG.currentPalette];
      }

      function degToRad(deg) {
        return deg * Math.PI / 180;
      }

      function distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
      }

      function castRays() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Desenhar o céu
        ctx.fillStyle = getCurrentPalette().sky;
        ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
        // Desenhar o chão
        ctx.fillStyle = getCurrentPalette().ground;
        ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
        // Array para armazenar as distâncias das paredes
        let zBuffer = new Array(canvas.width).fill(Infinity);
        for (let i = 0; i < canvas.width; i++) {
          const rayAngle = playerAngle - GG_ALL_GAME_CONFIG.fov / 2 + (GG_ALL_GAME_CONFIG.fov * i / canvas.width);
          const rayDirX = Math.cos(degToRad(rayAngle));
          const rayDirY = Math.sin(degToRad(rayAngle));
          let mapX = Math.floor(playerX);
          let mapY = Math.floor(playerY);
          const deltaDistX = Math.abs(1 / rayDirX);
          const deltaDistY = Math.abs(1 / rayDirY);
          let sideDistX;
          let sideDistY;
          let stepX;
          let stepY;
          if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (playerX - mapX) * deltaDistX;
          } else {
            stepX = 1;
            sideDistX = (mapX + 1.0 - playerX) * deltaDistX;
          }
          if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (playerY - mapY) * deltaDistY;
          } else {
            stepY = 1;
            sideDistY = (mapY + 1.0 - playerY) * deltaDistY;
          }
          let hit = 0;
          let side;
          while (hit === 0) {
            if (sideDistX < sideDistY) {
              sideDistX += deltaDistX;
              mapX += stepX;
              side = 0;
            } else {
              sideDistY += deltaDistY;
              mapY += stepY;
              side = 1;
            }
            if (map[mapY][mapX] > 0) hit = 1;
          }
          let perpWallDist;
          if (side === 0) perpWallDist = (mapX - playerX + (1 - stepX) / 2) / rayDirX;
          else perpWallDist = (mapY - playerY + (1 - stepY) / 2) / rayDirY;
          const lineHeight = (canvas.height / perpWallDist);
          const drawStart = -lineHeight / 2 + canvas.height / 2;
          const drawEnd = lineHeight / 2 + canvas.height / 2;
          // Escolher a cor da parede
          let wallColor;
          if (map[mapY][mapX] === 1) {
            wallColor = side === 1 ? 'rgba(0,0,200,0.8)' : getCurrentPalette().wall;
          } else if (map[mapY][mapX] === 2) {
            wallColor = GG_ALL_GAME_CONFIG.startColor;
          } else if (map[mapY][mapX] === 3) {
            wallColor = GG_ALL_GAME_CONFIG.endColor;
          }
          // Desenhar a parede com contorno
          ctx.beginPath();
          ctx.moveTo(i, drawStart);
          ctx.lineTo(i, drawEnd);
          ctx.strokeStyle = wallColor;
          ctx.lineWidth = 1;
          ctx.stroke();
          // Desenhar o contorno mais escuro
          ctx.beginPath();
          ctx.moveTo(i, drawStart);
          ctx.lineTo(i, drawEnd);
          ctx.strokeStyle = 'rgba(0,0,100,0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();
          // Armazenar a distância da parede no zBuffer
          zBuffer[i] = perpWallDist;
        }
        // Desenhar a porta de saída
        const exitX = endX + 0.5;
        const exitY = endY + 0.5;
        const exitAngle = Math.atan2(exitY - playerY, exitX - playerX);
        const exitScreenX = canvas.width / 2 + Math.tan(exitAngle - degToRad(playerAngle)) * canvas.width / (2 * Math.tan(degToRad(GG_ALL_GAME_CONFIG.fov / 2)));
        const exitDist = distance(playerX, playerY, exitX, exitY);
        const exitHeight = canvas.height / exitDist;
        if (exitScreenX > 0 && exitScreenX < canvas.width && exitDist < zBuffer[Math.floor(exitScreenX)]) {
          // Desenhar a borda da porta de saída
          ctx.fillStyle = GG_ALL_GAME_CONFIG.endBorderColor;
          ctx.fillRect(exitScreenX - exitHeight / 4 - 2, canvas.height / 2 - exitHeight / 2 - 2, exitHeight / 2 + 4, exitHeight + 4);
          // Desenhar o interior da porta de saída
          ctx.fillStyle = GG_ALL_GAME_CONFIG.endColor;
          ctx.fillRect(exitScreenX - exitHeight / 4, canvas.height / 2 - exitHeight / 2, exitHeight / 2, exitHeight);
        }
      }

      function updatePlayerPosition() {
        player.style.left = `${playerX * 100  / map[0].length}%`;
        player.style.top = `${playerY * 100 / map.length}%`;
      }

      function handleKeyDown(event) {
        keys[event.key.toLowerCase()] = true;
      }

      function handleKeyUp(event) {
        keys[event.key.toLowerCase()] = false;
      }

      function updatePlayerMovement() {
        if (!gameActive) return;
        const moveSpeed = GG_ALL_GAME_CONFIG.playerSpeed * 0.016;
        const acceleration = GG_ALL_GAME_CONFIG.acceleration;
        const sideAcceleration = acceleration * 0.75; // Reduced acceleration for side movement
        const rotSpeed = GG_ALL_GAME_CONFIG.rotationSpeed;
        GG_ALL_GAME_CONFIG.isRunning = keys['shift'];
        const speedMultiplier = GG_ALL_GAME_CONFIG.isRunning ? GG_ALL_GAME_CONFIG.runningSpeedMultiplier : 1;
        // Movimento com WASD
        if (keys['w']) {
          playerDX += Math.cos(degToRad(playerAngle)) * acceleration * speedMultiplier;
          playerDY += Math.sin(degToRad(playerAngle)) * acceleration * speedMultiplier;
        }
        if (keys['s']) {
          playerDX -= Math.cos(degToRad(playerAngle)) * acceleration * speedMultiplier;
          playerDY -= Math.sin(degToRad(playerAngle)) * acceleration * speedMultiplier;
        }
        if (keys['a']) {
          playerDX += Math.cos(degToRad(playerAngle - 90)) * sideAcceleration * speedMultiplier;
          playerDY += Math.sin(degToRad(playerAngle - 90)) * sideAcceleration * speedMultiplier;
        }
        if (keys['d']) {
          playerDX += Math.cos(degToRad(playerAngle + 90)) * sideAcceleration * speedMultiplier;
          playerDY += Math.sin(degToRad(playerAngle + 90)) * sideAcceleration * speedMultiplier;
        }
        // Rotação com setas
        if (keys['arrowleft']) {
          playerAngle -= rotSpeed;
          if (playerAngle < 0) playerAngle += 360;
        }
        if (keys['arrowright']) {
          playerAngle += rotSpeed;
          if (playerAngle >= 360) playerAngle -= 360;
        }
        // Atualiza o ícone de corrida
        const runningIcon = document.getElementById('running-icon');
        if (GG_ALL_GAME_CONFIG.isRunning) {
          runningIcon.classList.add('active');
        } else {
          runningIcon.classList.remove('active');
        }
        playerDX *= GG_ALL_GAME_CONFIG.friction;
        playerDY *= GG_ALL_GAME_CONFIG.friction;
        const newX = playerX + playerDX;
        const newY = playerY + playerDY;
        if (map[Math.floor(newY)][Math.floor(newX)] !== 1) {
          playerX = newX;
          playerY = newY;
        }
        updatePlayerPosition();
        // Verificar se o jogador chegou à porta de saída
        if (Math.floor(playerX) === endX && Math.floor(playerY) === endY) {
          score++;
          scoreDisplay.textContent = score;
          generateMaze();
          modifyMaze(); // Modifica o labirinto após cada conclusão
          playerX = startX + 0.5;
          playerY = startY + 0.5;
          // Mudar para a próxima paleta de cores
          GG_ALL_GAME_CONFIG.currentPalette = (GG_ALL_GAME_CONFIG.currentPalette + 1) % GG_ALL_GAME_CONFIG.colorPalettes.length;
        }
      }

      function startGame(isTestMode = false) {
        if (gameActive) return;
        gameActive = true;
        score = 0;
        scoreDisplay.textContent = score;
        GG_ALL_GAME_CONFIG.testMode = isTestMode;
        generateMaze(); // Gera um novo labirinto ao iniciar o jogo
        modifyMaze(); // Modifica o labirinto gerado
        playerX = startX + 0.5;
        playerY = startY + 0.5;
        document.getElementById('start-screen').style.display = 'none';
        pauseBtn.style.display = 'inline-block';
        if (isTestMode) {
          console.log("Modo de teste ativado");
        }
        if (GG_ALL_GAME_CONFIG.isMobileMode) {
          mobileControls.style.display = 'flex';
        }
        gameLoop = setInterval(() => {
          updatePlayerMovement();
          castRays();
        }, 16);
      }

      function startTestMode() {
        startGame(true);
      }

      function pauseGame() {
        if (!gameActive) return;
        gameActive = false;
        clearInterval(gameLoop);
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'none';
        const pauseOverlay = document.getElementById('pause-overlay');
        if (pauseOverlay) pauseOverlay.style.display = 'flex';
        // Show button size control if in mobile mode
        const buttonSizeControl = document.getElementById('button-size-control');
        if (buttonSizeControl) {
          buttonSizeControl.style.display = GG_ALL_GAME_CONFIG.isMobileMode ? 'block' : 'none';
        }
      }

      function resumeGame() {
        if (gameActive) return;
        gameActive = true;
        if (pauseBtn) pauseBtn.style.display = 'inline-block';
        if (resumeBtn) resumeBtn.style.display = 'none';
        const pauseOverlay = document.getElementById('pause-overlay');
        if (pauseOverlay) pauseOverlay.style.display = 'none';
        gameLoop = setInterval(() => {
          updatePlayerMovement();
          castRays();
        }, 16);
      }

      function returnToMenu() {
        const pauseOverlay = document.getElementById('pause-overlay');
        if (pauseOverlay) pauseOverlay.style.display = 'none';
        endGame();
      }

      function endGame() {
        gameActive = false;
        clearInterval(gameLoop);
        generateMaze();
        modifyMaze(); // Modifica o labirinto ao finalizar o jogo
        playerX = startX + 0.5;
        playerY = startY + 0.5;
        playerAngle = 0;
        playerDX = 0;
        playerDY = 0;
        score = 0;
        if (scoreDisplay) scoreDisplay.textContent = score;
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'flex';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'none';
        mobileControls.style.display = 'none';
        // Resetar as configurações do modo de teste
        GG_ALL_GAME_CONFIG.testMode = false;
      }

      function toggleMobileMode() {
        GG_ALL_GAME_CONFIG.isMobileMode = mobileCheckbox.checked;
        const buttonSizeControl = document.getElementById('button-size-control');
        if (buttonSizeControl) {
          buttonSizeControl.style.display = GG_ALL_GAME_CONFIG.isMobileMode ? 'block' : 'none';
        }
        if (!GG_ALL_GAME_CONFIG.isMobileMode) {
          mobileControls.style.display = 'none';
        } else {
          // Apply initial button size
          setMobileButtonSize(GG_ALL_GAME_CONFIG.mobileButtonSize);
        }
      }

      function setMobileButtonSize(size) {
        GG_ALL_GAME_CONFIG.mobileButtonSize = size;
        mobileControls.classList.remove('small', 'medium', 'large');
        mobileControls.classList.add(size);
      }

      function setupMobileControls() {
        const mobileUp = document.getElementById('mobile-up');
        const mobileDown = document.getElementById('mobile-down');
        const mobileLeft = document.getElementById('mobile-left');
        const mobileRight = document.getElementById('mobile-right');
        const mobileRotateLeft = document.getElementById('mobile-rotate-left');
        const mobileRotateRight = document.getElementById('mobile-rotate-right');
        const mobileRun = document.getElementById('mobile-run');

        mobileUp.addEventListener('touchstart', () => keys['w'] = true);
        mobileUp.addEventListener('touchend', () => keys['w'] = false);
        mobileDown.addEventListener('touchstart', () => keys['s'] = true);
        mobileDown.addEventListener('touchend', () => keys['s'] = false);
        mobileLeft.addEventListener('touchstart', () => keys['a'] = true);
        mobileLeft.addEventListener('touchend', () => keys['a'] = false);
        mobileRight.addEventListener('touchstart', () => keys['d'] = true);
        mobileRight.addEventListener('touchend', () => keys['d'] = false);
        mobileRotateLeft.addEventListener('touchstart', () => keys['arrowleft'] = true);
        mobileRotateLeft.addEventListener('touchend', () => keys['arrowleft'] = false);
        mobileRotateRight.addEventListener('touchstart', () => keys['arrowright'] = true);
        mobileRotateRight.addEventListener('touchend', () => keys['arrowright'] = false);
        mobileRun.addEventListener('touchstart', () => {
          keys['shift'] = true;
          mobileRun.classList.add('active');
        });
        mobileRun.addEventListener('touchend', () => {
          keys['shift'] = false;
          mobileRun.classList.remove('active');
        });

        // Button size controls
        document.getElementById('small-size-btn').addEventListener('click', () => setMobileButtonSize('small'));
        document.getElementById('medium-size-btn').addEventListener('click', () => setMobileButtonSize('medium'));
        document.getElementById('large-size-btn').addEventListener('click', () => setMobileButtonSize('large'));
      }

      // Event listeners
      if (startBtn) startBtn.addEventListener('click', () => startGame(false));
      if (testModeBtn) testModeBtn.addEventListener('click', startTestMode);
      if (pauseBtn) pauseBtn.addEventListener('click', pauseGame);
      if (resumeBtn) resumeBtn.addEventListener('click', resumeGame);
      if (document.getElementById('resume-btn-overlay')) {
        document.getElementById('resume-btn-overlay').addEventListener('click', resumeGame);
      }
      if (document.getElementById('return-to-menu-btn')) {
        document.getElementById('return-to-menu-btn').addEventListener('click', returnToMenu);
      }
      if (mobileCheckbox) mobileCheckbox.addEventListener('change', toggleMobileMode);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      setupMobileControls();
    })();
