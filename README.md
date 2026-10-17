# 🍭 Sugar Rush Heroes

A candy platformer **designed by two kids, the Sugar Rush Kids**. Run, jump, squish sour lemons, find secret rainbow stars, and tickle a pumpkin until he turns nice!

**▶ Play:** open `index.html` in any browser, or play it online with GitHub Pages (see below). It works on computers, phones and tablets.

## The designers' choices

| Question | Answer |
|---|---|
| Who are the heroes? | 🧛 A **vampire** and 🦎 an **axolotl** |
| Where does it happen? | 🍭 **Candy World** |
| What do you do? | 🏃 **Run and jump** like Mario and 💥 **squash bad guys** |
| Who are the bad guys? | 🍋 **Sour lemon drops** that spit sour juice |
| Who is the big boss? | 🎃 A **talking jack-o-lantern** (Sir Pumpkin Pants!) |
| Vampire's power | 🦇 **Turns into a bat** and flies for a little bit |
| Axolotl's power | ✨ **Sparkle shrink**: gets tiny to sneak through tunnels |
| What do you collect? | 🔑 **Golden lollipop keys** that open secret doors |
| Rarest treasure | 🌈⭐ A **beautiful rainbow star that glows** |
| The worlds | 🍫 Chocolate River → 🍦 Ice Cream Mountain → 🎃 Pumpkin Patch |
| How do you beat the boss? | 😂 **Make him laugh** until he gives up and turns nice |
| What happens when you win? | 🎆 **ALL OF THEM!** Fireworks, a dance party, crowns, a giant cake, and a pumpkin dance |
| Name of the game | **Sugar Rush Heroes** |

## How to play

| | Keyboard | Touch |
|---|---|---|
| Run | ← → (or A D) | ◀ ▶ |
| Jump | Space / ↑ / W | JUMP |
| Power (bat or tiny) | X | 🦇 BAT / ✨ TINY |
| Swap heroes | C | 🔄 |
| Pause | Esc / P | ⏸ |
| Sound on/off | M | 🔊 |

- **Jump on lemons** to squish them. Bumping into them from the side costs a heart.
- **🦇 Bat (Vampire):** press POWER, then hold JUMP to fly up. Bat power runs out, then rests when you land.
- **✨ Tiny (Axolotl):** press POWER to shrink and fit through tiny tunnels. Press again to grow back.
- **🔄 Swap** heroes any time. Each world has spots only one hero can reach!
- **🔑 Keys** open the **secret doors**. Each world hides one **🌈⭐ rainbow star**.
- **🎃 The boss:** jump on Sir Pumpkin Pants' head to tickle him. Fill the Giggle Meter to win.
- No game over! If you run out of hearts, you go back to the last checkpoint flag with full hearts.
- Progress (unlocked worlds, stars) is saved in the browser.

## Put it online with GitHub Pages

1. Push this folder to a GitHub repository.
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
3. After a minute the game is live at `https://<your-username>.github.io/<repo-name>/`.
4. On a phone or iPad, open that link and use **Share → Add to Home Screen** so it feels like an app.

## Make your own levels

Levels live in [`levels.js`](levels.js) as little text maps. Each letter is something in the world (`c` = candy, `L` = lemon, `K` = key, `R` = rainbow star, `~` = chocolate, and so on). The full key is at the top of the file. Change a map, save, and refresh the browser to play it!

## Files

- `index.html`: the page and touch buttons
- `game.js`: the game (drawing, sounds, music, heroes, lemons, the pumpkin)
- `levels.js`: the three worlds

Everything is drawn and every sound is made with code, so there are no image or sound files and nothing to install.
