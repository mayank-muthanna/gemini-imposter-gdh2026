Here is a clean, professional `README.md` file for your project. I have structured it to include your specific installation instructions while also documenting the game rules and configuration.

***

# 🕵️‍♂️ AI Impostor: Social Deduction Game

A realtime multiplayer social deduction game where humans must identify the AI agent hiding among them. 

**The Twist:** Every round, players are shown an abstract image to discuss. The AI **cannot** see the image but must blend in by hallucinating details based on context clues from the chat.

## 🎮 Game Rules

1.  **Lobby:** Minimum 3 Humans + 1 AI (The AI joins automatically).
2.  **Identities:** Player names are masked behind shapes (Circle, Triangle, Square, etc.).
3.  **The Hook:** Humans see an abstract art piece. The AI sees nothing.
4.  **Discussion:** Players have **30-50 seconds** to discuss the image. The AI tries to bluff.
5.  **Voting:** Players vote to eliminate the impostor.
    *   If the AI is removed: **Humans Win**.
    *   If the AI survives to the final 2: **AI Wins**.
6.  **Chaos Mode:** There is a 50% chance shapes will swap randomly during the round to confuse players.

## 🛠️ Tech Stack

*   **Frontend:** Nuxt (Vue.js)
*   **Backend & DB:** Convex (Realtime database)
*   **AI Logic:** Google Gemini
*   **Styling:** Tailwind CSS

---

## 🚀 Installation & Setup

Follow these steps to get the game running locally.

### 1. Clone the repository
```bash
git clone <repository_url>
cd <project_folder>
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Convex Backend
Initialize the realtime backend. This will prompt you to log in and create a new project.
```bash
npx convex dev
```

### 4. Configure Environment Variables
The AI needs an API key to generate responses.
1.  Go to your **Convex Dashboard** (the browser window that opened).
2.  Navigate to **Settings** > **Environment Variables**.
3.  Add the following variable:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `GOOGLE_API_KEY` | `your_api_key_here` | Your Google Gemini or Groq API Key |

> **⚠️ Note on API Keys:** The code in `actions.ts` currently looks for `GROQ_API_KEY` or `GOOGLE_API_KEY`. Ensure the variable name in your Convex dashboard matches exactly what is inside your `actions.ts` file (e.g., `process.env.GOOGLE_API_KEY`).

### 5. Run the App
Open a new terminal window (keep `npx convex dev` running in the other one) and start the frontend:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play!

---

## ⚙️ Configuration (Developer Tips)

### Adjusting Round Duration
To observe the AI behavior for longer periods (e.g., for debugging), modify `game.ts`:

```typescript
// in game.ts -> startRound function
// ...
// 6+ players = 30s, 5 = 25s, etc.
let duration = 15; 
// Change logic here, e.g.:
// let duration = 50; // Force 50s rounds for testing
```

---

## 📂 Project Structure

*   `convex/`
    *   `game.ts`: Core game loop (Lobby, Timer, Voting).
    *   `actions.ts`: AI intelligence (Prompt engineering, Decision making).
    *   `schema.ts`: Database structure.
*   `app/`: Nuxt frontend pages.

## 🤝 Contributing
Feel free to open a PR to improve the AI's bluffing prompt!
