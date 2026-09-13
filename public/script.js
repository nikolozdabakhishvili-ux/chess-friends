const socket = io();

const home = document.getElementById("home");
const game = document.getElementById("game");
const createGameButton = document.getElementById("createGame");
const joinGameButton = document.getElementById("joinGame");
const roomCodeInput = document.getElementById("roomCode");
const message = document.getElementById("message");
const board = document.getElementById("board");
const roomDisplay = document.getElementById("roomDisplay");
const turnDisplay = document.getElementById("turnDisplay");
const gameMessage = document.getElementById("gameMessage");
const copyRoomButton = document.getElementById("copyRoom");
const backHomeButton = document.getElementById("backHome");
const whiteStatus = document.getElementById("whiteStatus");
const blackStatus = document.getElementById("blackStatus");

let chess = new Chess();
let myColor = null;
let roomCode = null;
let selectedSquare = null;
let possibleMoves = [];

const pieces = {
    p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
    P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
};

createGameButton.addEventListener("click", () => {
    message.textContent = "";
    socket.emit("createGame");
});

joinGameButton.addEventListener("click", () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code) {
        message.textContent = "Enter a room code.";
        return;
    }
    socket.emit("joinGame", code);
});

copyRoomButton.addEventListener("click", async () => {
    if (!roomCode) return;
    await navigator.clipboard.writeText(roomCode);
    copyRoomButton.textContent = "COPIED!";
    setTimeout(() => {
        copyRoomButton.textContent = "COPY CODE";
    }, 1500);
});

backHomeButton.addEventListener("click", () => {
    location.reload();
});

socket.on("gameCreated", (data) => {
    myColor = data.color;
    roomCode = data.code;
    chess.load(data.fen);
    openGame();
    updateBoard();
    message.textContent = `Send room code ${roomCode} to your friend.`;
});

socket.on("gameJoined", (data) => {
    myColor = data.color;
    roomCode = data.code;
    chess.load(data.fen);
    openGame();
    updateBoard();
});

socket.on("gameReady", (data) => {
    chess.load(data.fen);
    updateBoard();
    if (whiteStatus) whiteStatus.textContent = "Connected";
    if (blackStatus) blackStatus.textContent = "Connected";
});

socket.on("moveMade", (data) => {
    chess.load(data.fen);
    selectedSquare = null;
    possibleMoves = [];
    updateBoard();
});

socket.on("invalidMove", () => {
    selectedSquare = null;
    possibleMoves = [];
    updateBoard();
});

socket.on("errorMessage", (text) => {
    message.textContent = text;
});

socket.on("gameOver", (data) => {
    if (data.result === "checkmate") {
        const winner = data.winner === "w" ? "WHITE" : "BLACK";
        gameMessage.textContent = `${winner} WINS — CHECKMATE!`;
    }
    if (data.result === "draw") {
        gameMessage.textContent = "DRAW!";
    }
});

socket.on("playerDisconnected", () => {
    gameMessage.textContent = "Your opponent disconnected.";
});

function openGame() {
    home.classList.add("hidden");
    game.classList.remove("hidden");
    roomDisplay.textContent = roomCode;
    updateTurn();
}

function updateBoard() {
    board.innerHTML = "";
    let files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    let ranks = [8, 7, 6, 5, 4, 3, 2, 1];

    if (myColor === "b") {
        files.reverse();
        ranks.reverse();
    }

    for (const rank of ranks) {
        for (const file of files) {
            const squareName = file + rank;
            const square = document.createElement("div");
            square.classList.add("square");

            const fileIndex = "abcdefgh".indexOf(file);
            const isLight = (fileIndex + rank) % 2 === 0;
            square.classList.add(isLight ? "light" : "dark");

            // არჩეული უჯრის მონიშვნა
            if (selectedSquare === squareName) {
                square.classList.add("selected");
            }

            // შესაძლო სვლის მონიშვნა
            if (possibleMoves.includes(squareName)) {
                square.classList.add("possible-move");
            }

            const piece = chess.get(squareName);
            if (piece) {
                const pieceKey = piece.color === "w" ? piece.type.toUpperCase() : piece.type.toLowerCase();
                square.textContent = pieces[pieceKey];
            }

            square.addEventListener("click", () => {
                handleSquareClick(squareName);
            });

            board.appendChild(square);
        }
    }
    updateTurn();
}

function handleSquareClick(squareName) {
    if (chess.game_over()) return;
    if (chess.turn() !== myColor) return;

    const clickedPiece = chess.get(squareName);

    // პირველი დაჭერა — ფიგურის არჩევა
    if (!selectedSquare) {
        if (!clickedPiece || clickedPiece.color !== myColor) return;

        selectedSquare = squareName;
        // შესაძლო სვლების გამოთვლა
        const moves = chess.moves({ square: squareName, verbose: true });
        possibleMoves = moves.map(m => m.to);
        
        updateBoard();
        return;
    }

    // იმავე უჯრაზე დაჭერით არჩევის გაუქმება
    if (squareName === selectedSquare) {
        selectedSquare = null;
        possibleMoves = [];
        updateBoard();
        return;
    }

    // თუ დააჭირა სხვა თავის ფიგურას — გადართვა ახალ ფიგურაზე
    if (clickedPiece && clickedPiece.color === myColor) {
        selectedSquare = squareName;
        const moves = chess.moves({ square: squareName, verbose: true });
        possibleMoves = moves.map(m => m.to);
        updateBoard();
        return;
    }

    // სვლის გაგზავნა
    socket.emit("makeMove", {
        code: roomCode,
        from: selectedSquare,
        to: squareName,
        promotion: "q"
    });

    selectedSquare = null;
    possibleMoves = [];
}

function updateTurn() {
    if (!roomCode) return;
    const turn = chess.turn();

    if (turn === myColor) {
        turnDisplay.textContent = "YOUR TURN";
    } else {
        turnDisplay.textContent = "OPPONENT'S TURN";
    }
}