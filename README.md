# 🏏 Great Karikalan Cricket

A fast-paced, browser-based hand-cricket game with animated stadium visuals, real-time multiplayer, and a CPU opponent mode. Built with vanilla HTML/CSS/JS on the frontend and Node.js + Socket.io for live multiplayer matches.

**Nambi vanga, santhosama ponga!** 🎉

---

## ✨ Features

- **vs Computer mode** — play solo against an AI bowler/batter with three difficulty levels (Easy, Medium, Hard)
- **Multiplayer mode** — create or join a room with a friend and play live, ball by ball, over Socket.io
- **Animated stadium** — day-lit sky, floodlights, crowd, cheerleaders, swinging bat/bowler sprites, and ball physics for sixes, fours, and wickets
- **Full match flow** — coin toss with heads/tails call, bat/bowl choice, two-innings structure with an innings break screen, live scoreboard, ball-by-ball commentary, and a countdown timer per ball
- **Super 3 (Super Over)** — if the match ends in a tie, both sides play a 3-ball Super Over with a dramatic countdown, red/orange stadium lighting, and special sound effects. If that ties too, it drops into a sudden-death **Super 1** (1 ball each)
- **Share results** — share the innings break or final scorecard via the Web Share API or clipboard
- **Sound effects** — all synthesized in-browser via the Web Audio API, no audio files needed

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (custom animations, no frameworks), vanilla JavaScript
- **Backend:** Node.js, Express, Socket.io (for real-time multiplayer state sync)
- **Audio:** Web Audio API (procedurally generated tones, no external sound files)

## 📁 Project Structure

```
great-karikalan-cricket/
├── server.js          # Express + Socket.io server (multiplayer logic, room handling)
├── package.json        # Dependencies and start script
└── public/
    └── index.html       # The full game (HTML + CSS + JS in one file)
```

## 🚀 Running Locally

```bash
git clone https://github.com/<your-username>/great-karikalan-cricket.git
cd great-karikalan-cricket
npm install
npm start
```

Then open `http://localhost:3000` in your browser. Open it in a second tab (or share the room code with a friend) to test multiplayer.

## 🌐 Deployment

This app needs a host that keeps a Node.js process running continuously (for Socket.io), such as Render, Railway, or Fly.io. Static-only hosts (GitHub Pages, Netlify) won't support the multiplayer server.

Make sure `server.js` binds to the platform's provided port:

```js
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));
```

## 🎮 How to Play

1. Choose **vs Computer** or **Multiplayer** from the home screen
2. Win the toss (or let it be called) and choose to bat or bowl first
3. Each ball, both batter and bowler secretly pick a number 1–6
4. Same number = **wicket** (batter is out); different numbers = batter scores that many runs
5. After both innings, the side with more runs wins — a tie triggers a **Super 3** decider
6. First innings sets the target; chase it down in the second innings to win

## 📄 License

This project is open for personal and educational use. Feel free to fork and adapt it.
