/* global React, ReactDOM, TweaksPanel, TweakSection, TweakRadio, useTweaks */
const { useState, useEffect, useMemo, useRef } = React;

/* ─── Constants ───────────────────────────────────────────────────────── */

const PLAYER_COLORS = [
  { id: 'blue',    name: 'Blue',    hex: 'var(--p-blue)',    edge: 'var(--p-blue-edge)',    dark: false },
  { id: 'red',     name: 'Red',     hex: 'var(--p-red)',     edge: 'var(--p-red-edge)',     dark: false },
  { id: 'mustard', name: 'Mustard', hex: 'var(--p-mustard)', edge: 'var(--p-mustard-edge)', dark: true  },
  { id: 'beige',   name: 'Beige',   hex: 'var(--p-beige)',   edge: 'var(--p-beige-edge)',   dark: true  },
];
const colorById = (id) => PLAYER_COLORS.find((c) => c.id === id) || PLAYER_COLORS[0];

// Catan number-token probability dots
const PROB_DOTS = { 2:1, 3:2, 4:3, 5:4, 6:5, 8:5, 9:4, 10:3, 11:2, 12:1 };

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "defaultVpTarget": 10
}/*EDITMODE-END*/;

/* ─── SVG ornaments ───────────────────────────────────────────────────── */

const Hex = ({ size = 16, color = 'currentColor', filled = false }) => (
  <svg width={size} height={size * 0.866 * 1.05} viewBox="0 0 100 92" aria-hidden="true">
    <polygon
      points="50,4 92,27 92,65 50,88 8,65 8,27"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth="6"
      strokeLinejoin="round"
    />
  </svg>
);

const Crown = () => (
  <svg width="20" height="16" viewBox="0 0 24 18" aria-hidden="true">
    <path
      d="M2 16 L4 4 L9 9 L12 2 L15 9 L20 4 L22 16 Z"
      fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round"
    />
    <circle cx="4" cy="3" r="1.2" fill="currentColor" />
    <circle cx="12" cy="1.2" r="1.4" fill="currentColor" />
    <circle cx="20" cy="3" r="1.2" fill="currentColor" />
  </svg>
);

function DiceIcon() {
  return (
    <svg width="22" height="16" viewBox="0 0 36 24" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round">
        <rect x="1.5" y="5" width="14" height="14" rx="3" transform="rotate(-8 8.5 12)" />
        <rect x="20.5" y="5" width="14" height="14" rx="3" transform="rotate(6 27.5 12)" />
      </g>
      <g fill="currentColor">
        <circle cx="6" cy="10" r="1.3" /><circle cx="11" cy="15" r="1.3" />
        <circle cx="24" cy="9" r="1.3" /><circle cx="29" cy="9" r="1.3" />
        <circle cx="24" cy="15" r="1.3" /><circle cx="29" cy="15" r="1.3" />
      </g>
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg width="36" height="16" viewBox="0 0 36 24" aria-hidden="true">
      <g strokeWidth="1.5">
        <circle cx="6"  cy="12" r="5" style={{ fill: 'var(--p-blue)',    stroke: 'var(--p-blue-edge)' }} />
        <circle cx="15" cy="12" r="5" style={{ fill: 'var(--p-red)',     stroke: 'var(--p-red-edge)' }} />
        <circle cx="24" cy="12" r="5" style={{ fill: 'var(--p-mustard)', stroke: 'var(--p-mustard-edge)' }} />
        <circle cx="33" cy="12" r="5" style={{ fill: 'var(--p-beige)',   stroke: 'var(--p-beige-edge)' }} />
      </g>
    </svg>
  );
}

/* ─── HexCluster (welcome decoration) ─────────────────────────────────── */

function HexCluster() {
  const tiles = [
    { id: 'blue',    cx: 100, cy: 60  },
    { id: 'red',     cx: 50,  cy: 138 },
    { id: 'mustard', cx: 150, cy: 138 },
    { id: 'beige',   cx: 100, cy: 216 },
  ];
  return (
    <svg viewBox="0 0 200 276" width="200" height="276" aria-hidden="true">
      <defs>
        <filter id="hex-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#2a1a08" floodOpacity="0.35" />
        </filter>
      </defs>
      {tiles.map((t) => {
        const c = colorById(t.id);
        const pts = `50,4 92,30 92,78 50,104 8,78 8,30`;
        return (
          <g key={t.id} transform={`translate(${t.cx - 50}, ${t.cy - 50})`} filter="url(#hex-shadow)">
            <polygon points={pts} style={{ fill: c.hex, stroke: c.edge }} strokeWidth="3" strokeLinejoin="round" />
            <polygon points="50,10 86,32 86,60 50,82 14,60 14,32"
              fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeLinejoin="round" />
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Die ─────────────────────────────────────────────────────────────── */

const PIPS = {
  1: [[1,1]],
  2: [[0,0],[2,2]],
  3: [[0,0],[1,1],[2,2]],
  4: [[0,0],[2,0],[0,2],[2,2]],
  5: [[0,0],[2,0],[1,1],[0,2],[2,2]],
  6: [[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]],
};
function Die({ value, rolling }) {
  const pips = PIPS[value] || [];
  return (
    <div className={'die' + (rolling ? ' rolling' : '')}>
      <div className="die-grid">
        {Array.from({ length: 9 }).map((_, i) => {
          const r = Math.floor(i / 3), c = i % 3;
          const on = pips.some(([cc, rr]) => cc === c && rr === r);
          return <div key={i} className={'pip-cell' + (on ? ' on' : '')} />;
        })}
      </div>
    </div>
  );
}

/* ─── Catan-style number token (sum) ──────────────────────────────────── */

function NumberToken({ sum, rolling }) {
  const isRed = sum === 6 || sum === 8;
  const isRobber = sum === 7;
  const dots = PROB_DOTS[sum] || 0;
  return (
    <div className="token-wrap">
      <div className={'token' + (isRed ? ' token-red' : '') + (rolling ? ' token-spin' : '')}
           key={'tok-' + sum + '-' + rolling}>
        <div className="token-inner">
          <div className={'token-num' + (isRobber ? ' robber' : '') + (isRed ? ' red' : '')}>
            {sum}
          </div>
          {dots > 0 && (
            <div className="token-dots">
              {Array.from({ length: dots }).map((_, i) => <span key={i} />)}
            </div>
          )}
          {isRobber && <div className="token-robber">Robber</div>}
        </div>
      </div>
    </div>
  );
}

/* ─── Step header ─────────────────────────────────────────────────────── */

function StepHeader({ step, total, onBack, eyebrow, title, subtitle }) {
  return (
    <header className="step-header">
      <div className="step-header-row">
        <button className="icon-btn" onClick={onBack} aria-label="Back">‹</button>
        <div className="step-dots">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={'step-dot' + (i === step ? ' active' : (i < step ? ' done' : ''))}
            />
          ))}
        </div>
        <div style={{ width: 36 }} />
      </div>
      {eyebrow && <div className="step-eyebrow">{eyebrow}</div>}
      <h1 className="step-title">{title}</h1>
      {subtitle && <div className="step-sub">{subtitle}</div>}
    </header>
  );
}

/* ─── 1. Welcome / player count ───────────────────────────────────────── */

function WelcomeScreen({ onChoose }) {
  return (
    <div className="welcome">
      <header className="setup-hero welcome-hero">
        <div className="hero-ornament">
          <div className="rule" />
          <Hex size={14} color="var(--wood)" />
          <Hex size={18} color="var(--wood)" />
          <Hex size={14} color="var(--wood)" />
          <div className="rule" />
        </div>
        <h1 className="title-xl">Catan</h1>
        <div className="title-sub">Helper</div>
        <div className="setup-tag">Dice &amp; scorekeeping for your settlers</div>
      </header>

      <div className="welcome-tableau">
        <HexCluster />
      </div>

      <div className="count-question">
        <div className="section-label">
          <div className="rule" />
          <span className="text">How many settlers?</span>
          <div className="rule" />
        </div>
        <div className="count-choices">
          {[3, 4].map((n) => (
            <button key={n} className="count-card" onClick={() => onChoose(n)}>
              <div className="mini-token">
                <div className="mini-token-num">{n}</div>
              </div>
              <div className="count-card-label">{n === 3 ? 'Three' : 'Four'} Players</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── 2. Names ────────────────────────────────────────────────────────── */

function NamesScreen({ playerCount, initialNames, onContinue, onBack }) {
  const [names, setNames] = useState(() => {
    const out = Array(playerCount).fill('');
    (initialNames || []).slice(0, playerCount).forEach((n, i) => { out[i] = n; });
    return out;
  });

  useEffect(() => {
    setNames((prev) => {
      const out = Array(playerCount).fill('');
      prev.slice(0, playerCount).forEach((n, i) => { out[i] = n; });
      return out;
    });
  }, [playerCount]);

  const canContinue = names.every((n) => n.trim().length > 0);

  return (
    <div className="setup">
      <StepHeader
        step={1}
        total={4}
        onBack={onBack}
        eyebrow={`Step 2 of 4 · ${playerCount} settlers`}
        title="Name your settlers"
        subtitle="Each player needs a name on the board."
      />

      <div className="names-list">
        {names.map((name, i) => (
          <div key={i} className="name-card">
            <div className="name-num">{i + 1}</div>
            <input
              className="player-name-input"
              placeholder={'Player ' + (i + 1)}
              value={name}
              onChange={(e) => {
                const v = e.target.value.slice(0, 14);
                setNames((arr) => arr.map((nn, j) => (j === i ? v : nn)));
              }}
              autoFocus={i === 0 && !name}
            />
            {name.trim() && <span className="name-check">✓</span>}
          </div>
        ))}
      </div>

      <button
        className="wood-btn primary"
        disabled={!canContinue}
        onClick={() => onContinue(names.map((n) => n.trim()))}
      >
        Continue
      </button>
    </div>
  );
}

/* ─── 3. Colors ───────────────────────────────────────────────────────── */

function ColorsScreen({ playerCount, names, initialColors, initialMode, onContinue, onBack }) {
  const [mode, setMode] = useState(initialMode || 'manual');
  const [colors, setColors] = useState(() => {
    if (initialColors && initialColors.length === playerCount) return initialColors;
    return PLAYER_COLORS.slice(0, playerCount).map((c) => c.id);
  });

  const shuffle = () => {
    const ids = PLAYER_COLORS.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setColors(ids.slice(0, playerCount));
  };

  // Shuffle on first switch into random mode (not on every re-render).
  const lastMode = useRef(mode);
  useEffect(() => {
    if (mode === 'random' && lastMode.current !== 'random') shuffle();
    lastMode.current = mode;
  }, [mode]); // eslint-disable-line

  const updateColor = (i, colorId) => {
    setColors((arr) => {
      const next = [...arr];
      const other = next.indexOf(colorId);
      if (other !== -1 && other !== i) next[other] = next[i]; // swap
      next[i] = colorId;
      return next;
    });
  };

  const allUnique = new Set(colors).size === playerCount;

  return (
    <div className="setup">
      <StepHeader
        step={2}
        total={4}
        onBack={onBack}
        eyebrow="Step 3 of 4"
        title="Assign colors"
        subtitle={mode === 'manual'
          ? 'Tap a swatch to pick — taps will swap with whoever holds it.'
          : 'Fate has dealt. Shuffle again, or switch to manual.'}
      />

      <div className="mode-toggle" role="tablist">
        <button
          className={'mode-tab' + (mode === 'manual' ? ' active' : '')}
          onClick={() => setMode('manual')}
          role="tab"
          aria-selected={mode === 'manual'}
        >
          <PaletteIcon /> <span>Manual</span>
        </button>
        <button
          className={'mode-tab' + (mode === 'random' ? ' active' : '')}
          onClick={() => setMode('random')}
          role="tab"
          aria-selected={mode === 'random'}
        >
          <DiceIcon /> <span>Random</span>
        </button>
      </div>

      {mode === 'random' && (
        <button className="shuffle-pill" onClick={shuffle}>
          <DiceIcon /> <span>Shuffle again</span>
        </button>
      )}

      <div className="player-list">
        {names.map((name, i) => {
          const chosen = colorById(colors[i]);
          return (
            <div key={i} className="player-card">
              <div className="player-card-row">
                <div
                  className={'player-avatar' + (chosen.dark ? ' ink-dark' : '')}
                  style={{ backgroundColor: chosen.hex, borderColor: chosen.edge }}
                >
                  {name[0]?.toUpperCase() || (i + 1)}
                </div>
                <div className="player-name-readonly">{name}</div>
              </div>
              <div className="swatch-row">
                {PLAYER_COLORS.map((c) => {
                  const mine = colors[i] === c.id;
                  return (
                    <button
                      key={c.id}
                      className={
                        'swatch' +
                        (mine ? ' mine' : '') +
                        (mine && c.dark ? ' ink-dark' : '') +
                        (mode === 'random' ? ' locked' : '')
                      }
                      style={{ backgroundColor: c.hex, borderColor: c.edge }}
                      onClick={() => mode === 'manual' && updateColor(i, c.id)}
                      disabled={mode === 'random'}
                      aria-label={c.name}
                    >
                      {mine && <span className="check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="wood-btn primary"
        disabled={!allUnique}
        onClick={() => onContinue(names.map((name, i) => ({ name, color: colors[i] })))}
      >
        Continue
      </button>
    </div>
  );
}

/* ─── 4. VP target ─────────────────────────────────────────────── */

const VP_OPTIONS = [
  { value: 8,  label: 'Short',    desc: 'A quick round' },
  { value: 10, label: 'Standard', desc: 'The classic game' },
  { value: 12, label: 'Epic',     desc: 'A long campaign' },
];

function VPScreen({ players, initialTarget, onStart, onBack }) {
  const [target, setTarget] = useState(initialTarget || 10);
  return (
    <div className="setup">
      <StepHeader
        step={3}
        total={4}
        onBack={onBack}
        eyebrow="Step 4 of 4"
        title="Set the victory mark"
        subtitle="First settler to reach this many Victory Points wins the game."
      />

      <div className="vp-choices">
        {VP_OPTIONS.map((opt) => {
          const active = target === opt.value;
          return (
            <button
              key={opt.value}
              className={'vp-card' + (active ? ' active' : '')}
              onClick={() => setTarget(opt.value)}
              aria-pressed={active}
            >
              <div className="vp-token">
                <div className="vp-token-num">{opt.value}</div>
                <div className="vp-token-cap">VP</div>
              </div>
              <div className="vp-card-text">
                <div className="vp-card-label">{opt.label}</div>
                <div className="vp-card-desc">{opt.desc}</div>
              </div>
              <div className={'vp-card-radio' + (active ? ' on' : '')}>
                {active && <span className="check">✓</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="vp-roster">
        <div className="section-label" style={{ marginBottom: 8 }}>
          <div className="rule" />
          <span className="text">Settlers ready</span>
          <div className="rule" />
        </div>
        <div className="vp-roster-row">
          {players.map((p) => {
            const c = colorById(p.color);
            return (
              <div key={p.color} className="vp-roster-item" title={p.name}>
                <div
                  className={'player-avatar small' + (c.dark ? ' ink-dark' : '')}
                  style={{ backgroundColor: c.hex, borderColor: c.edge }}
                >
                  {p.name[0]?.toUpperCase()}
                </div>
                <div className="vp-roster-name">{p.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      <button className="wood-btn primary" onClick={() => onStart(target)}>
        Begin Game
      </button>
    </div>
  );
}

/* ─── 5. Game ─────────────────────────────────────────────────────────── */

function GameScreen({ players, vpTarget, onExit }) {
  const [scores, setScores] = useState(() =>
    Object.fromEntries(players.map((p) => [p.color, 0]))
  );
  const [dice, setDice] = useState([3, 4]);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState([]);
  const [winner, setWinner] = useState(null);

  const sum = dice[0] + dice[1];
  const rollTimer = useRef(null);

  useEffect(() => () => clearInterval(rollTimer.current), []);

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    let count = 0;
    rollTimer.current = setInterval(() => {
      setDice([1 + Math.floor(Math.random()*6), 1 + Math.floor(Math.random()*6)]);
      count++;
      if (count >= 8) {
        clearInterval(rollTimer.current);
        const f1 = 1 + Math.floor(Math.random()*6);
        const f2 = 1 + Math.floor(Math.random()*6);
        setDice([f1, f2]);
        setHistory((h) => [f1 + f2, ...h].slice(0, 6));
        setRolling(false);
      }
    }, 75);
  };

  const adjust = (color, delta) => {
    setScores((s) => {
      const next = { ...s, [color]: Math.max(0, (s[color] || 0) + delta) };
      if (next[color] >= vpTarget && !winner) {
        const w = players.find((p) => p.color === color);
        setTimeout(() => setWinner(w), 250);
      }
      return next;
    });
  };

  const leader = useMemo(() => {
    let max = -1, lead = null;
    players.forEach((p) => {
      const s = scores[p.color] || 0;
      if (s > max) { max = s; lead = p.color; }
    });
    return max > 0 ? lead : null;
  }, [scores, players]);

  return (
    <div className="game">
      <header className="app-header">
        <button className="icon-btn" onClick={onExit} aria-label="Back to setup">‹</button>
        <div className="brand">
          <div className="brand-mark"><Hex size={20} color="var(--wood)" /></div>
          <div className="brand-name">Catan Helper</div>
        </div>
        <div className="vp-pill">{vpTarget} VP</div>
      </header>

      <div className="game-grid">
        <section className="dice-area">
        <div className="dice-row">
          <Die value={dice[0]} rolling={rolling} />
          <Die value={dice[1]} rolling={rolling} />
        </div>
        <NumberToken sum={sum} rolling={rolling} />
        <button className="wood-btn roll-btn" onClick={roll} disabled={rolling}>
          {rolling ? 'Rolling…' : 'Roll Dice'}
        </button>
        <div className="roll-history">
          <span className="roll-history-label">Last</span>
          {history.length === 0 && (
            <span style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-faint)' }}>
              no rolls yet
            </span>
          )}
          {history.map((n, i) => (
            <span key={i} className={'history-chip' + (n === 6 || n === 8 ? ' red' : '')}>
              {n}
            </span>
          ))}
        </div>
      </section>

      <section className="scoreboard">
        <div className="section-label">
          <span className="text">Victory Points</span>
          <div className="rule" />
        </div>
        <div className="score-list">
          {players.map((p) => {
            const c = colorById(p.color);
            const s = scores[p.color] || 0;
            const pct = Math.min(100, (s / vpTarget) * 100);
            const isLeader = leader === p.color && s > 0;
            return (
              <div key={p.color} className={'score-row' + (isLeader ? ' leader' : '')}>
                <div
                  className="score-progress"
                  style={{
                    width: pct + '%',
                    background:
                      'linear-gradient(90deg, ' + c.hex + '00 0%, ' + c.hex + '40 100%)',
                    borderRight: pct > 0 && pct < 100 ? '2px solid ' + c.hex : 'none',
                  }}
                />
                <div className="score-content">
                  <div
                    className={'score-avatar' + (c.dark ? ' ink-dark' : '')}
                    style={{ backgroundColor: c.hex, borderColor: c.edge }}
                  >
                    {isLeader ? <span className="crown"><Crown /></span> : p.name[0]?.toUpperCase()}
                  </div>
                  <div className="score-name-area">
                    <div className="score-name">{p.name}</div>
                    <div className="score-meta">
                      {s >= vpTarget ? 'Victory!' : `${vpTarget - s} to win`}
                    </div>
                  </div>
                  <div className={'score-vp' + (s >= vpTarget ? ' win' : '')}>{s}</div>
                  <div className="score-btns">
                    <button className="score-btn" onClick={() => adjust(p.color, -1)} aria-label="Subtract">−</button>
                    <button className="score-btn" onClick={() => adjust(p.color, +1)} aria-label="Add">+</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      </div>

      {winner && (
        <WinnerOverlay
          winner={winner}
          onClose={() => setWinner(null)}
          onNewGame={onExit}
        />
      )}
    </div>
  );
}

/* ─── Winner overlay ──────────────────────────────────────────────────── */

function WinnerOverlay({ winner, onClose, onNewGame }) {
  const c = colorById(winner.color);
  return (
    <div className="winner-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="winner-card">
        <div className="winner-eyebrow">Victory</div>
        <div
          className={'winner-avatar' + (c.dark ? ' ink-dark' : '')}
          style={{ backgroundColor: c.hex, borderColor: c.edge }}
        >
          <Crown />
        </div>
        <div className="winner-name">{winner.name}</div>
        <div className="winner-sub">has built an empire</div>
        <button className="wood-btn" onClick={onNewGame}>New Game</button>
        <button className="winner-continue" onClick={onClose}>Keep Playing</button>
      </div>
    </div>
  );
}

/* ─── App root ────────────────────────────────────────────────────────── */

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState('welcome'); // welcome | names | colors | vp | game
  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState([]);
  const [colors, setColors] = useState([]);
  const [mode, setMode] = useState('manual');
  const [players, setPlayers] = useState([]);
  const [vpTarget, setVpTarget] = useState(t.defaultVpTarget);

  const screenLabel =
    screen === 'welcome' ? '01 Welcome'
    : screen === 'names' ? '02 Names'
    : screen === 'colors' ? '03 Colors'
    : screen === 'vp' ? '04 VP Target'
    : '05 Game';

  return (
    <React.Fragment>
      <div className="app parchment" data-screen-label={screenLabel}>
        <div className="app-frame">
          {screen === 'welcome' && (
            <WelcomeScreen
              onChoose={(n) => { setPlayerCount(n); setScreen('names'); }}
            />
          )}
          {screen === 'names' && (
            <NamesScreen
              playerCount={playerCount}
              initialNames={names}
              onBack={() => setScreen('welcome')}
              onContinue={(ns) => { setNames(ns); setScreen('colors'); }}
            />
          )}
          {screen === 'colors' && (
            <ColorsScreen
              playerCount={playerCount}
              names={names}
              initialColors={colors.length === playerCount ? colors : null}
              initialMode={mode}
              onBack={() => setScreen('names')}
              onContinue={(ps) => {
                setPlayers(ps);
                setColors(ps.map((p) => p.color));
                setScreen('vp');
              }}
            />
          )}
          {screen === 'vp' && (
            <VPScreen
              players={players}
              initialTarget={vpTarget}
              onBack={() => setScreen('colors')}
              onStart={(target) => {
                setVpTarget(target);
                setScreen('game');
              }}
            />
          )}
          {screen === 'game' && (
            <GameScreen
              players={players}
              vpTarget={vpTarget}
              onExit={() => setScreen('welcome')}
            />
          )}
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Defaults" />
        <TweakRadio
          label="Default VP target"
          value={t.defaultVpTarget}
          options={[8, 10, 12]}
          onChange={(v) => { setTweak('defaultVpTarget', v); setVpTarget(v); }}
        />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
