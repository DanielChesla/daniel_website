// tictactoe.js (vanilla JS, no jQuery)
// Works with TicTacToe.html provided (board/status/scoreboard + reset buttons)

(() => {
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const xWinsEl = document.getElementById("x-wins");
  const oWinsEl = document.getElementById("o-wins");
  const tiesEl  = document.getElementById("ties");

  // Persist scores across reloads (optional)
  const getNum = (k, def=0) => Number(localStorage.getItem(k) ?? def);
  let xWins = getNum("ttt_xWins");
  let oWins = getNum("ttt_oWins");
  let ties  = getNum("ttt_ties");

  // Game state
  let board = Array(9).fill(""); // "", "X", or "O"
  let current = "X";
  let moves = 0;
  let gameOver = false;

  const wins = [
    [0,1,2],[3,4,5],[6,7,8], // rows
    [0,3,6],[1,4,7],[2,5,8], // cols
    [0,4,8],[2,4,6]          // diags
  ];

  // ------- UI helpers -------
  function updateScoreboard() {
    xWinsEl.textContent = xWins;
    oWinsEl.textContent = oWins;
    tiesEl.textContent  = ties;
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function renderBoard() {
    // Build cells only once
    if (!boardEl.dataset.built) {
      boardEl.dataset.built = "1";
      // Create 9 buttons/divs
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "btn btn-outline-secondary fs-3 fw-semibold";
        cell.style.width = "100%";
        cell.style.aspectRatio = "1/1"; // perfect square
        cell.dataset.index = String(i);
        cell.addEventListener("click", onCellClick);
        boardEl.appendChild(cell);
      }
    }
    // Write values
    const cells = boardEl.querySelectorAll("[data-index]");
    cells.forEach((c, i) => { c.textContent = board[i]; });
  }

  function checkWin(player) {
    return wins.some(combo => combo.every(i => board[i] === player));
  }

  function endGame(message, outcome) {
    gameOver = true;
    setStatus(message);
    if (outcome === "X") { xWins++; localStorage.setItem("ttt_xWins", xWins); }
    else if (outcome === "O") { oWins++; localStorage.setItem("ttt_oWins", oWins); }
    else if (outcome === "TIE") { ties++; localStorage.setItem("ttt_ties", ties); }
    updateScoreboard();
  }

  // ------- Events -------
  function onCellClick(e) {
    if (gameOver) return;
    const idx = Number(e.currentTarget.dataset.index);
    if (board[idx]) return; // already played

    board[idx] = current;
    moves++;
    renderBoard();

    if (checkWin(current)) {
      endGame(`Player ${current} wins!`, current);
      return;
    }
    if (moves === 9) {
      endGame("It's a tie!", "TIE");
      return;
    }

    current = current === "X" ? "O" : "X";
    setStatus(`Player ${current}'s turn`);
  }

  // ------- Public (used by buttons in HTML) -------
  window.resetBoard = function resetBoard() {
    board.fill("");
    moves = 0;
    current = "X";
    gameOver = false;
    setStatus(`Player ${current}'s turn`);
    renderBoard();
  };

  window.resetScores = function resetScores() {
    xWins = 0; oWins = 0; ties = 0;
    localStorage.setItem("ttt_xWins", xWins);
    localStorage.setItem("ttt_oWins", oWins);
    localStorage.setItem("ttt_ties", ties);
    updateScoreboard();
    resetBoard();
  };

  // ------- Init -------
  // Make a 3x3 grid layout if not styled elsewhere
  if (!boardEl.classList.contains("grid-3x3")) {
    boardEl.style.display = "grid";
    boardEl.style.gridTemplateColumns = "repeat(3, 1fr)";
    boardEl.style.gap = "10px";
    boardEl.style.maxWidth = "360px";
  }

  updateScoreboard();
  setStatus(`Player ${current}'s turn`);
  renderBoard();
})();
