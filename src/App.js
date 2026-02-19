import { useState, useEffect, useRef } from "react";

// --- DATA ---
const MOCK_LEADERBOARD = [
  { name: "dwr.eth", score: 125400, rare: 12, pfp: "🟣" },
  { name: "vgr", score: 98200, rare: 8, pfp: "🔘" },
  { name: "cassie", score: 85600, rare: 15, pfp: "🌸" },
  { name: "horsefacts", score: 72100, rare: 5, pfp: "🐴" },
  { name: "linda", score: 64000, rare: 9, pfp: "💎" },
];

const CROC_NAMES = ["Brutus","Snapper","Rex","Titan","Goliath","Fang","Duke","Hunter","Razor","Spike"];
const F_NAMES = ["Sheila","Bella","Duchess","Maya","Nova","Pearl","Queen","Ruby","Sage","Tara"];

const RARE_SPECIES = [
  { id: "saltwater", name: "Saltwater Croc", emoji: "🐊", color: "#1a6a2a", rarity: 0.2, sizeBonus: 1.5, valueBonus: 2.5, desc: "World's largest reptile" },
  { id: "albino", name: "Albino Croc", emoji: "🤍", color: "#8a7a00", rarity: 0.08, sizeBonus: 0, valueBonus: 5, desc: "Extremely rare white variant" },
  { id: "black_caiman", name: "Black Caiman", emoji: "⬛", color: "#1a1a4a", rarity: 0.1, sizeBonus: 1.0, valueBonus: 3, desc: "Apex predator of the Amazon" },
  { id: "gharial", name: "Gharial", emoji: "🎋", color: "#4a6a1a", rarity: 0.07, sizeBonus: 0.5, valueBonus: 4, desc: "Critically endangered" },
  { id: "dwarf_croc", name: "Dwarf Croc", emoji: "🌿", color: "#2a5a0a", rarity: 0.12, sizeBonus: -0.5, valueBonus: 3.5, desc: "Smallest crocodilian" },
  { id: "golden", name: "Golden Croc", emoji: "✨", color: "#7a5a00", rarity: 0.03, sizeBonus: 0, valueBonus: 10, desc: "Mythically rare variant" },
];

const ZONES = [
  { id: 0, name: "Billabong Creek", minSize: 1.2, maxSize: 2.5, catchDiff: 0.7, cost: 0, rareChance: 0.05, staminaCost: 10 },
  { id: 1, name: "Murky Swamp", minSize: 2.0, maxSize: 3.8, catchDiff: 0.85, cost: 500, rareChance: 0.15, staminaCost: 15 },
  { id: 2, name: "Deep River Delta", minSize: 3.0, maxSize: 5.5, catchDiff: 1.1, cost: 2000, rareChance: 0.28, staminaCost: 20 },
  { id: 3, name: "Ancient Lagoon", minSize: 3.5, maxSize: 6.5, catchDiff: 1.4, cost: 6000, rareChance: 0.45, staminaCost: 30 },
];

const getLevelXP = (lvl) => 100 * lvl;
const getGreenWidth = (lvl, hasNet) => {
  let base = Math.max(8, 40 - (lvl - 1) * 2.5);
  return hasNet ? base * 1.25 : base;
};

const sellValue = (c) => Math.floor(c.size * 120 + 50) * (c.species ? c.species.valueBonus : 1);

export default function App() {
  const [screen, setScreen] = useState("home");
  const [money, setMoney] = useState(300);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [stamina, setStamina] = useState(100);
  const [unlockedZones, setUnlockedZones] = useState([0]);
  const [zone, setZone] = useState(ZONES[0]);
  const [crocs, setCrocs] = useState([]);
  const [upgrades, setUpgrades] = useState([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("normal");
  const [stats, setStats] = useState({ caught: 0, rare: 0, totalEarned: 300 });

  const [hunting, setHunting] = useState(false);
  const [wildCroc, setWildCroc] = useState(null);
  const [catchBar, setCatchBar] = useState(0);
  const [catching, setCatching] = useState(false);
  const [catchResult, setCatchResult] = useState(null);
  
  const dirRef = useRef(1);
  const animRef = useRef(null);
  const catchBarRef = useRef(0);

  const hasUpgrade = (id) => upgrades.includes(id);
  const greenWidth = getGreenWidth(level, hasUpgrade("net"));
  const greenStart = (100 - greenWidth) / 2;

  useEffect(() => {
    const t = setInterval(() => setStamina(s => Math.min(100, s + 1)), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const xpNeeded = getLevelXP(level);
    if (xp >= xpNeeded) {
      setLevel(l => l + 1);
      setXp(x => x - xpNeeded);
      setMsg("⬆️ LEVEL UP!");
      setMsgType("levelup");
    }
  }, [xp, level]);

  const startHunt = () => {
    const cost = hasUpgrade("boots") ? zone.staminaCost * 0.7 : zone.staminaCost;
    if (stamina < cost) { setMsg("Out of Stamina!"); setMsgType("error"); return; }
    
    setStamina(s => s - Math.floor(cost));
    const male = Math.random() > 0.5;
    let species = null;
    const effectiveRareChance = hasUpgrade("bait") ? zone.rareChance * 1.5 : zone.rareChance;
    
    if (Math.random() < effectiveRareChance) {
      species = RARE_SPECIES[Math.floor(Math.random() * RARE_SPECIES.length)];
    }
    
    const size = +(zone.minSize + Math.random() * (zone.maxSize - zone.minSize) + (species?.sizeBonus || 0)).toFixed(1);
    
    setWildCroc({
      id: Date.now(),
      name: male ? CROC_NAMES[Math.floor(Math.random()*CROC_NAMES.length)] : F_NAMES[Math.floor(Math.random()*F_NAMES.length)],
      gender: male ? "M" : "F",
      size,
      health: 100,
      species,
      status: "caught"
    });
    setCatchBar(0);
    catchBarRef.current = 0;
    setCatchResult(null);
    setCatching(false);
    setHunting(true);
  };

  useEffect(() => {
    if (!catching) { cancelAnimationFrame(animRef.current); return; }
    const speed = zone.catchDiff * (1.6 + (level * 0.08));
    const tick = () => {
      catchBarRef.current += dirRef.current * speed;
      if (catchBarRef.current >= 100) { dirRef.current = -1; catchBarRef.current = 100; }
      if (catchBarRef.current <= 0) { dirRef.current = 1; catchBarRef.current = 0; }
      setCatchBar(catchBarRef.current);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [catching, zone, level]);

  const attemptCatch = () => {
    setCatching(false);
    const pos = catchBarRef.current;
    const isSuccess = pos >= greenStart && pos <= (greenStart + greenWidth);
    
    if (isSuccess) {
      setCrocs(p => [...p, wildCroc]);
      setStats(s => ({ ...s, caught: s.caught + 1, rare: wildCroc.species ? s.rare + 1 : s.rare }));
      setXp(x => x + (wildCroc.species ? 60 : 30));
      setCatchResult("success");
    } else {
      setCatchResult("fail");
    }
  };

  const s = {
    app: { fontFamily: 'system-ui, sans-serif', background: "#080c08", minHeight: "100vh", color: "#e0f0e0" },
    header: { background: "#121a12", padding: "12px", borderBottom: "2px solid #233323", display: "flex", justifyContent: "space-between", alignItems: "center" },
    nav: { display: "flex", gap: "5px", padding: "10px", background: "#0d140d", overflowX: "auto" },
    navBtn: (active) => ({ padding: "8px 14px", borderRadius: "15px", border: "none", background: active ? "#4caf50" : "#1a241a", color: active ? "#000" : "#8a8", fontWeight: "bold", fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap" }),
    card: { background: "#111811", borderRadius: "15px", padding: "15px", marginBottom: "12px", border: "1px solid #233323" },
    btn: (color = "#4caf50") => ({ background: color, border: "none", borderRadius: "10px", padding: "12px 20px", color: "#000", fontWeight: "bold", cursor: "pointer" }),
    leaderboardRow: { display: "flex", alignItems: "center", padding: "10px", borderBottom: "1px solid #233323", gap: "12px" },
    rankCircle: { width: "24px", height: "24px", borderRadius: "50%", background: "#4caf50", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold" }
  };

  return (
    <div style={s.app}>
      <div style={s.header}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: "bold", color: "#4caf50" }}>CROC HUNTER</div>
          <div style={{ fontSize: "10px" }}>LV.{level} EXPLORER</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#ffd700", fontWeight: "bold" }}>${money.toLocaleString()}</div>
          <div style={{ fontSize: "10px" }}>⚡ {Math.floor(stamina)}/100</div>
        </div>
      </div>

      <div style={s.nav}>
        {["home", "hunt", "manage", "shop", "rank"].map(tab => (
          <button key={tab} style={s.navBtn(screen === tab)} onClick={() => setScreen(tab)}>
            {tab === "rank" ? "🏆 RANK" : tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ padding: "15px", maxWidth: "500px", margin: "0 auto" }}>
        
        {screen === "home" && (
          <div>
            <div style={s.card}>
              <h3 style={{ margin: "0 0 10px" }}>Welcome, Hunter</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ background: "#080c08", padding: "12px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "20px" }}>🐊</div>
                  <div style={{ fontWeight: "bold" }}>{stats.caught}</div>
                  <div style={{ fontSize: "10px", color: "#8a8" }}>CAUGHT</div>
                </div>
                <div style={{ background: "#080c08", padding: "12px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "20px" }}>✨</div>
                  <div style={{ fontWeight: "bold" }}>{stats.rare}</div>
                  <div style={{ fontSize: "10px", color: "#8a8" }}>RARES</div>
                </div>
              </div>
            </div>

            <h4 style={{ color: "#4caf50", marginBottom: "10px" }}>EXPLORE ZONES</h4>
            {ZONES.map(z => (
              <div key={z.id} style={s.card} onClick={() => { if(unlockedZones.includes(z.id)) { setZone(z); setScreen("hunt"); } }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: "bold" }}>{z.name} {!unlockedZones.includes(z.id) && "🔒"}</div>
                    <div style={{ fontSize: "11px", color: "#8a8" }}>Rare: {z.rareChance * 100}% · Cost {z.staminaCost}⚡</div>
                  </div>
                  {!unlockedZones.includes(z.id) ? (
                    <button style={s.navBtn(false)} onClick={(e) => {
                      e.stopPropagation();
                      if(money >= z.cost) { setMoney(m => m - z.cost); setUnlockedZones(p => [...p, z.id]); }
                    }}>${z.cost}</button>
                  ) : (
                    <div style={{ color: "#4caf50", fontSize: "12px" }}>{zone.id === z.id ? "ACTIVE" : "GO"}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {screen === "hunt" && (
          <div style={{ textAlign: "center" }}>
            {!hunting ? (
              <div style={{ ...s.card, padding: "40px 20px" }}>
                <div style={{ fontSize: "60px", marginBottom: "20px" }}>🐊</div>
                <h2>{zone.name}</h2>
                <button style={{ ...s.btn(), width: "100%", fontSize: "18px" }} onClick={startHunt}>CAST NET</button>
              </div>
            ) : (
              <div style={s.card}>
                <div style={{ fontSize: "40px", marginBottom: "10px" }}>{wildCroc?.species ? wildCroc.species.emoji : "🐊"}</div>
                <h3 style={{ color: wildCroc?.species ? "#ffd700" : "#fff" }}>{wildCroc?.species ? wildCroc.species.name : "Wild Croc"}</h3>
                
                {catchResult === null ? (
                  <div style={{ marginTop: "30px" }}>
                    <div style={{ position: "relative", height: "50px", background: "#000", borderRadius: "25px", border: "2px solid #233323", overflow: "hidden", marginBottom: "20px" }}>
                      <div style={{ position: "absolute", left: `${greenStart}%`, width: `${greenWidth}%`, height: "100%", background: "rgba(76, 175, 80, 0.2)", borderLeft: "2px solid #4caf50", borderRight: "2px solid #4caf50" }} />
                      <div style={{ position: "absolute", left: `${catchBar}%`, width: "6px", height: "100%", background: "#fff", boxShadow: "0 0 15px #fff" }} />
                    </div>
                    {!catching ? (
                      <button style={s.btn()} onClick={() => setCatching(true)}>GET READY...</button>
                    ) : (
                      <button style={{ ...s.btn("#ffd700"), width: "100%", height: "70px", fontSize: "20px" }} onMouseDown={attemptCatch}>SNAP!</button>
                    )}
                  </div>
                ) : (
                  <div>
                    <h2 style={{ color: catchResult === "success" ? "#4caf50" : "#ff5252" }}>{catchResult === "success" ? "CAUGHT!" : "ESCAPED!"}</h2>
                    <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                      <button style={{ ...s.btn(), flex: 1 }} onClick={startHunt}>AGAIN</button>
                      <button style={{ ...s.btn("#1a241a"), color: "#fff", flex: 1 }} onClick={() => setScreen("manage")}>VIEW</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {screen === "rank" && (
          <div>
            <div style={s.card}>
              <h3 style={{ margin: "0 0 5px" }}>Global Leaderboard</h3>
              <p style={{ fontSize: "11px", color: "#8a8", margin: "0 0 15px" }}>Net Worth and Rare Collections</p>
              
              <div style={{ ...s.leaderboardRow, background: "#1a241a", borderRadius: "10px", marginBottom: "15px" }}>
                <div style={s.rankCircle}>?</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold" }}>You (Hunter)</div>
                  <div style={{ fontSize: "10px", color: "#8a8" }}>{stats.rare} Rares · ${money}</div>
                </div>
                <div style={{ fontWeight: "bold" }}>#999+</div>
              </div>

              {MOCK_LEADERBOARD.map((u, i) => (
                <div key={i} style={s.leaderboardRow}>
                  <div style={{ ...s.rankCircle, background: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : "#cd7f32" }}>{i+1}</div>
                  <div style={{ fontSize: "20px" }}>{u.pfp}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>{u.name}</div>
                    <div style={{ fontSize: "10px", color: "#8a8" }}>{u.rare} Rares</div>
                  </div>
                  <div style={{ fontWeight: "bold", color: "#4caf50" }}>${u.score.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === "shop" && (
           <div style={s.card}>
             <h3>Hunter Shop</h3>
             <p style={{color: '#8a8', fontSize: '12px'}}>Permanent Buffs</p>
             <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px'}}>
                <div>🕸️ Titanium Net (+25% Area)</div>
                <button style={s.navBtn(false)} onClick={() => {
                  if(money >= 1500) { setMoney(m => m - 1500); setUpgrades(p => [...p, "net"]); }
                }}>{hasUpgrade("net") ? "OWNED" : "$1,500"}</button>
             </div>
           </div>
        )}

        {screen === "manage" && (
          <div>
            <h3>Your Collection</h3>
            {crocs.map(c => (
              <div key={c.id} style={s.card}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span>{c.species ? c.species.emoji : "🐊"} <b>{c.name}</b> ({c.size}m)</span>
                  <button style={{...s.btn("#4caf50"), padding: '5px 10px', fontSize: '11px'}} onClick={() => {
                    setMoney(m => m + sellValue(c));
                    setCrocs(p => p.filter(x => x.id !== c.id));
                  }}>SELL ${sellValue(c)}</button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
