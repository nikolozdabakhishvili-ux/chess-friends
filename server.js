const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// static ფაილების მიწოდება public საქაღალდიდან
app.use(express.static(path.join(__dirname, "public")));

const games = {};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on("connection", (socket) => {
    // ოთახის შექმნა
    socket.on("createGame", () => {
        const code = generateRoomCode();
        games[code] = {
            chess: new Chess(),
            players: { white: socket.id, black: null }
        };

        socket.join(code);

        socket.emit("gameCreated", {
            code,
            color: "w",
            fen: games[code].chess.fen()
        });
    });

    // ოთახში შეერთება
    socket.on("joinGame", (code) => {
        const game = games[code];

        if (!game) {
            return socket.emit("errorMessage", "Room not found.");
        }

        if (game.players.black) {
            return socket.emit("errorMessage", "Room is full.");
        }

        game.players.black = socket.id;
        socket.join(code);

        socket.emit("gameJoined", {
            code,
            color: "b",
            fen: game.chess.fen()
        });

        io.to(code).emit("gameReady", {
            fen: game.chess.fen()
        });
    });

    // სვლის გაკეთება
    socket.on("makeMove", (data) => {
        const { code, from, to, promotion } = data;
        const game = games[code];

        if (!game) return;

        // შემოწმება, ნამდვილად ამ მოთამაშის სვლაა თუ არა
        const playerColor = game.players.white === socket.id ? "w" :
                           game.players.black === socket.id ? "b" : null;

        if (!playerColor || game.chess.turn() !== playerColor) {
            return socket.emit("invalidMove");
        }

        // სვლა chess.js-ში
        const move = game.chess.move({ from, to, promotion: promotion || "q" });

        if (!move) {
            return socket.emit("invalidMove");
        }

        // ახალი დაფის გაგზავნა ორივე მოთამაშესთან
        io.to(code).emit("moveMade", {
            fen: game.chess.fen()
        });

        // თამაშის დასრულების შემოწმება (0.10.3 ვერსიის მეთოდებით)
        if (game.chess.in_checkmate()) {
            const winner = game.chess.turn() === "w" ? "b" : "w";
            io.to(code).emit("gameOver", { result: "checkmate", winner });
        } else if (game.chess.in_draw()) {
            io.to(code).emit("gameOver", { result: "draw" });
        }
    });

    // კავშირის გაწყვეტა
    socket.on("disconnect", () => {
        for (const code in games) {
            const game = games[code];
            if (game.players.white === socket.id || game.players.black === socket.id) {
                io.to(code).emit("playerDisconnected");
                delete games[code];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
const path = require('path');

// ეს ხაზი ზუსტად მიუთითებს სერვერს, რომ public ფოლდერი არის მთავარი სტატიკური ზონა
app.use(express.static(path.join(__dirname, 'public')));