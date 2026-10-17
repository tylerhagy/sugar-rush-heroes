// Sugar Rush Heroes — levels designed by the Sugar Rush Kids
//
// Each level is made of "segments" stuck together from left to right.
// Every segment is 15 rows tall. Rows you don't list are empty sky,
// except rows 12-14, which are ground.
//
// MAP KEY
//   #  ground               =  candy block          I  slippery ice
//   -  thin platform        ~  chocolate / milk / slime (don't fall in!)
//   ^  candy corn spikes    J  bouncy jelly         D  secret door (needs a key)
//   c  candy                K  golden lollipop key  R  rainbow star
//   H  heart                L  sour lemon drop      O  hopping lemon drop
//   M  raft (starts going right)   N  raft (starts going left)
//   V  waffle elevator (goes up)
//   F  checkpoint flag      E  goal lollipop        B  Sir Pumpkin Pants (boss)
//   P  player start         1-9  signs (text is in "signs")

function seg(w, rows) {
  const out = [];
  for (let r = 0; r < 15; r++) {
    let row = rows[r];
    if (row === undefined) {
      if (r >= 13 && rows[12] !== undefined) {
        row = rows[12].replace(/[^~#I]/g, '~').replace(/I/g, '#');
      } else {
        row = r >= 12 ? '#'.repeat(w) : '.'.repeat(w);
      }
    }
    if (row.length !== w) {
      throw new Error(`Segment row ${r} is ${row.length} wide, expected ${w}: "${row}"`);
    }
    out.push(row);
  }
  return out;
}

const LEVELS = [
  {
    name: 'Chocolate River',
    icon: '🍫',
    theme: 'choco',
    song: 'choco',
    signs: {
      1: { touch: 'Tap ◀ ▶ to run and JUMP to jump!', keys: 'Use ← → to run and SPACE to jump!' },
      2: "Don't fall in the chocolate! 🍫 Jump on sour lemons to squish them! 🍋",
      3: {
        touch: '🦇 Vampire: tap POWER to be a bat! Hold JUMP to fly up! Tap 🔄 to swap heroes!',
        keys: '🦇 Vampire: press X to be a bat! Hold SPACE to fly up! Press C to swap heroes!',
      },
      4: {
        touch: '✨ Axolotl: tap POWER to shrink tiny and sneak through tunnels!',
        keys: '✨ Axolotl: press X to shrink tiny and sneak through tunnels!',
      },
      5: '🔑 Got a golden lollipop key? Walk into the secret door!',
    },
    segments: [
      seg(16, {
        8: '...........ccc..',
        10: '..........-----.',
        11: '..P.1..c.c......',
      }),
      seg(14, {
        8: '.....ccc......',
        11: '.2..........L.',
        12: '#####~~~######',
      }),
      seg(18, {
        6: '..........ccc.....',
        7: '.........=====....',
        9: '......===.........',
        11: '...===......O.....',
      }),
      seg(18, {
        2: '...........ccHc...',
        3: '..........------..',
        11: '.3...F.......L....',
      }),
      seg(16, {
        7: '.....ccccccc....',
        8: '....=========...',
        9: '....=========...',
        10: '.--.=========...',
        11: '.4..cccKccccc...',
      }),
      seg(16, {
        4: '....ccccc.......',
        5: '....-----.......',
        11: '..J.......O.....',
      }),
      seg(20, {
        8: '......ccc..ccc......',
        11: '.F..................',
        12: '##M~~~~~~~~~~~~N~~##',
      }),
      seg(22, {
        9: '........=======.......',
        10: '.....--.D.ccc.=.......',
        11: '5.L.....D..R..=...L...',
      }),
      seg(12, {
        11: '...H...E....',
      }),
    ],
  },
  {
    name: 'Ice Cream Mountain',
    icon: '🍦',
    theme: 'ice',
    song: 'ice',
    signs: {
      1: 'Brrr! Blue ice is SLIPPERY! 🧊',
      2: 'Ride the waffle elevator! ⬆️ Who can FLY up to the 🌈⭐?',
      3: 'Tiny tunnel! Who can fit in there? ✨',
    },
    segments: [
      seg(16, {
        9: '........ccc.....',
        11: '..P..1.....L....',
      }),
      seg(18, {
        8: '.......ccc........',
        11: '.............L....',
        12: 'IIIIIII~~~IIIIIIII',
      }),
      seg(20, {
        4: '..............ccc...',
        5: '.............=====..',
        7: '..........===.......',
        9: '......====..........',
        11: '..===.......O.......',
      }),
      seg(18, {
        1: '...........R......',
        2: '..........===.....',
        6: '........==........',
        7: '........==........',
        8: '........==........',
        9: '........==........',
        10: '........==........',
        11: '.2.V....==....L...',
      }),
      seg(16, {
        10: '....ccc...ccc...',
        11: '.F.....L....L...',
        12: '####IIIIIIII####',
      }),
      seg(18, {
        7: '....ccccccccc.....',
        8: '...===========....',
        9: '...===========....',
        10: '--.===========....',
        11: '..3.cccKccc....H..',
      }),
      seg(20, {
        9: '......=========.....',
        10: '....--D.ccccc.=.....',
        11: '....L.D.cHccc.=..L..',
      }),
      seg(20, {
        8: '......ccc..ccc......',
        11: '.F..................',
        12: '##M~~~~~~~~~~~~N~~##',
      }),
      seg(12, {
        11: '...H...E....',
      }),
    ],
  },
  {
    name: 'Pumpkin Patch',
    icon: '🎃',
    theme: 'pumpkin',
    song: 'pumpkin',
    signs: {
      1: 'Shhh... the Pumpkin Patch! 🎃 Watch out for pointy candy corn!',
      2: '🦇 Something shiny is WAY up high...',
    },
    segments: [
      seg(16, {
        11: '..P..1....O.....',
      }),
      seg(18, {
        8: '........ccc.......',
        9: '.......---........',
        11: '....^^^....^^^....',
      }),
      seg(20, {
        8: '.....ccc.ccc........',
        11: '.F....JJJ...........',
        12: '#####~~~~~~~########',
      }),
      seg(18, {
        1: '..........cKc.....',
        2: '.........-----....',
        11: '.2.........L......',
      }),
      seg(20, {
        9: '.......=========....',
        10: '.....--D.......=....',
        11: '..^^...D.ccRcc.=....',
      }),
      seg(20, {
        8: '......ccc..ccc......',
        11: '.F..................',
        12: '##M~~~~~~~~~~~~N~~##',
      }),
      // The boss arena
      seg(28, (() => {
        const rows = {};
        for (let r = 0; r <= 10; r++) rows[r] = '...........................#';
        rows[8] = '......----........----.....#';
        rows[11] = '..F..................B.....#';
        return rows;
      })()),
    ],
  },
];

if (typeof module !== 'undefined') module.exports = LEVELS;
