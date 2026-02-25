import { useState, useEffect, useRef } from "react";

const CROC_NAMES = ["Brutus","Snapper","Rex","Titan","Goliath","Fang","Duke","Hunter","Razor","Spike"];
const F_NAMES = ["Sheila","Bella","Duchess","Maya","Nova","Pearl","Queen","Ruby","Sage","Tara"];

const RARE_SPECIES = [
  { id: "saltwater", name: "Saltwater Croc", emoji: "🐊", color: "#1a6a2a", rarity: 0.2, sizeBonus: 1.5, valueBonus: 2.5, desc: "World's largest reptile" },
  { id: "albino", name: "Albino Croc", emoji: "🤍", color: "#8a7a00", rarity: 0.08, sizeBonus: 0, valueBonus: 5, desc: "Extremely rare white variant" },
  { id: "black_caiman", name: "Black Caiman", emoji: "🖤", color: "#1a1a4a", rarity: 0.1, sizeBonus: 1.0, valueBonus: 3, desc: "Apex predator of the Amazon" },
  { id: "gharial", name: "Gharial", emoji: "🦷", color: "#4a6a1a", rarity: 0.07, sizeBonus: 0.5, valueBonus: 4, desc: "Critically endangered, long snout" },
  { id: "dwarf_croc", name: "Dwarf Croc", emoji: "🌿", color: "#2a5a0a", rarity: 0.12, sizeBonus: -0.5, valueBonus: 3.5, desc: "Smallest crocodilian, very rare" },
  { id: "golden", name: "Golden Croc", emoji: "✨", color: "#7a5a00", rarity: 0.03, sizeBonus: 0, valueBonus: 10, desc: "Mythically rare golden variant" },
];

const ZONES = [
  { id: 0, name: "Billabong Creek", minSize: 1.2, maxSize: 2.5, catchDiff: 0.7, cost: 0, rareChance: 0.05 },
  { id: 1, name: "Murky Swamp", minSize: 2.0, maxSize: 3.8, catchDiff: 0.55, cost: 500, rareChance: 0.15 },
  { id: 2, name: "Deep River Delta", minSize: 3.0, maxSize: 5.5, catchDiff: 0.4, cost: 2000, rareChance: 0.28 },
  { id: 3, name: "Ancient Lagoon", minSize: 3.5, maxSize: 6.5, catchDiff: 0.3, cost: 6000, rareChance: 0.45 },
];

const XP_PER_LEVEL = 100;
const getLevelXP = (lvl) => XP_PER_LEVEL * lvl;
// green zone shrinks with level: starts at 40% wide, shrinks 2.5% per level, min 10%
const getGreenWidth = (lvl) => Math.max(10, 40 - (lvl - 1) * 2.5);

let nextId = 1;
const genCroc = (zone, rareChance) => {
  const male = Math.random() > 0.5;
  let species = null;
  if (Math.random() < rareChance) {
    const pool = RARE_SPECIES.filter(r => Math.random() < r.rarity * 3);
    if (pool.length > 0) species = pool[Math.floor(Math.random() * pool.length)];
  }
  let size = zone.minSize + Math.random() * (zone.maxSize - zone.minSize);
  if (species) size = Math.max(0.8, size + (species.sizeBonus || 0));
  return {
    id: nextId++,
    name: male ? CROC_NAMES[Math.floor(Math.random()*CROC_NAMES.length)] : F_NAMES[Math.floor(Math.random()*F_NAMES.length)],
    gender: male ? "M" : "F",
    size: +size.toFixed(1),
    age: Math.floor(Math.random()*15)+2,
    health: Math.floor(Math.random()*40)+60,
    species,
    status: "caught",
    partner: null,
    eggTimer: 0,
    farmTimer: 0,
  };
};

const farmValue = (c) => Math.floor(c.size * 180 + c.health * 1.5) * (c.species ? c.species.valueBonus : 1);
const sellValue = (c) => Math.floor(c.size * 120 + 50) * (c.species ? c.species.valueBonus : 1);

export default function App() {
  const [screen, setScreen] = useState("home");
  const [money, setMoney] = useState(300);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpNeeded, setXpNeeded] = useState(getLevelXP(1));
  const [unlockedZones, setUnlockedZones] = useState([0]);
  const [zone, setZone] = useState(ZONES[0]);
  const [crocs, setCrocs] = useState([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("normal");
  const [stats, setStats] = useState({ caught: 0, farmed: 0, bred: 0, sold: 0, rare: 0 });

  const [hunting, setHunting] = useState(false);
  const [wildCroc, setWildCroc] = useState(null);
  const [catchBar, setCatchBar] = useState(0);
  const [catching, setCatching] = useState(false);
  const [catchResult, setCatchResult] = useState(null);
  const dirRef = useRef(1);
  const animRef = useRef(null);
  const catchBarRef = useRef(0);

  const greenWidth = getGreenWidth(level);
  const greenStart = (100 - greenWidth) / 2;

  // level up
  useEffect(() => {
    if (xp >= xpNeeded) {
      const newLvl = level + 1;
      setLevel(newLvl);
      setXp(x => x - xpNeeded);
      setXpNeeded(getLevelXP(newLvl));
      showMsg(`⬆️ Level Up! You're now Level ${newLvl}! Catch zone is smaller!`, "levelup");
    }
  }, [xp, xpNeeded]);

  const addXp = (amt) => setXp(x => x + amt);

  useEffect(() => {
    const t = setInterval(() => {
      setCrocs(prev => {
        const updates = [];
        const next = prev.map(c => {
          if (c.status === "farming") {
            const ft = c.farmTimer - 1;
            if (ft <= 0) {
              const val = farmValue(c);
              updates.push({ type: "money", val });
              updates.push({ type: "msg", text: `💰 ${c.name} farmed for $${val}!`, kind: "normal" });
              updates.push({ type: "stat", key: "farmed" });
              updates.push({ type: "xp", val: 15 });
              return null;
            }
            return { ...c, farmTimer: ft };
          }
          if (c.status === "resting") {
            const rt = c.restTimer - 1;
            // female also tracks egg
            if (c.gender === "F" && c.pendingEgg) {
              const et = c.eggTimer - 1;
              if (et <= 0) {
                // spawn baby
                const babyMale = Math.random() > 0.5;
                const baby = {
                  id: nextId++,
                  name: babyMale ? CROC_NAMES[Math.floor(Math.random()*CROC_NAMES.length)] : F_NAMES[Math.floor(Math.random()*F_NAMES.length)],
                  gender: babyMale ? "M" : "F",
                  size: +(0.3 + Math.random() * 0.3).toFixed(1),
                  age: 0,
                  health: 90 + Math.floor(Math.random()*10),
                  species: Math.random() < 0.3 ? c.species : null, // inherit species chance
                  status: "hatchling",
                  partner: null, eggTimer: 0, farmTimer: 0,
                };
                updates.push({ type: "addCroc", croc: baby });
                updates.push({ type: "msg", text: `🐣 A baby ${baby.gender === "M" ? "male" : "female"} was born! Meet ${baby.name}!`, kind: "normal" });
                updates.push({ type: "stat", key: "bred" });
                return { ...c, pendingEgg: false, eggTimer: 0, restTimer: rt <= 0 ? 0 : rt, status: rt <= 0 ? "caught" : "resting" };
              }
              if (rt <= 0) return { ...c, restTimer: 0, eggTimer: et };
              return { ...c, restTimer: rt, eggTimer: et };
            }
            if (rt <= 0) {
              updates.push({ type: "msg", text: `✅ ${c.name} is rested and ready!`, kind: "normal" });
              return { ...c, status: "caught", restTimer: 0 };
            }
            return { ...c, restTimer: rt };
          }
          if (c.status === "egg") {
            const et = c.eggTimer - 1;
            if (et <= 0) {
              updates.push({ type: "msg", text: `🐊 Hatchlings from ${c.name}!`, kind: "normal" });
              updates.push({ type: "stat", key: "bred" });
              return { ...c, status: "hatchling", eggTimer: 0 };
            }
            return { ...c, eggTimer: et };
          }
          return c;
        }).filter(Boolean);
        const babies = updates.filter(u => u.type === "addCroc").map(u => u.croc);
        updates.forEach(u => {
          if (u.type === "money") setMoney(m => m + u.val);
          if (u.type === "msg") showMsg(u.text, u.kind);
          if (u.type === "stat") setStats(s => ({ ...s, [u.key]: s[u.key] + 1 }));
          if (u.type === "xp") addXp(u.val);
        });
        return babies.length > 0 ? [...next, ...babies] : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const showMsg = (m, kind = "normal") => { setMsg(m); setMsgType(kind); setTimeout(() => setMsg(""), 3500); };

  useEffect(() => {
    if (!catching) { cancelAnimationFrame(animRef.current); return; }
    const speed = zone.catchDiff * 2.8;
    const tick = () => {
      catchBarRef.current += dirRef.current * speed;
      if (catchBarRef.current >= 100) { dirRef.current = -1; catchBarRef.current = 100; }
      if (catchBarRef.current <= 0) { dirRef.current = 1; catchBarRef.current = 0; }
      setCatchBar(+catchBarRef.current.toFixed(1));
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [catching, zone]);

  const startHunt = () => {
    setWildCroc(genCroc(zone, zone.rareChance));
    catchBarRef.current = 0;
    setCatchBar(0);
    setCatchResult(null);
    setCatching(false);
    setHunting(true);
  };

  const attemptCatch = () => {
    setCatching(false);
    cancelAnimationFrame(animRef.current);
    const pos = catchBarRef.current;
    const success = pos >= greenStart && pos <= greenStart + greenWidth;
    if (success) {
      const c = wildCroc;
      setCrocs(prev => [...prev, { ...c, status: "caught" }]);
      setStats(s => ({ ...s, caught: s.caught + 1, rare: c.species ? s.rare + 1 : s.rare }));
      addXp(c.species ? 40 : 20);
      setCatchResult("success");
      if (c.species) showMsg(`🌟 RARE CATCH! ${c.species.emoji} ${c.species.name} — ${c.name}!`, "rare");
      else showMsg(`🎉 Caught ${c.name} (${c.gender}, ${c.size}m)!`);
    } else {
      setCatchResult("fail");
      showMsg("💨 It got away!");
    }
  };

  const farmCroc = (id) => {
    setCrocs(prev => prev.map(c => c.id === id ? { ...c, status: "farming", farmTimer: 20 } : c));
  };
  const sellCroc = (id, isBred = false) => {
    const c = crocs.find(x => x.id === id);
    const val = sellValue(c);
    setMoney(m => m + val);
    addXp(10);
    setCrocs(prev => prev.filter(x => x.id !== id));
    setStats(s => ({ ...s, sold: s.sold + 1 }));
    showMsg(`💵 Sold ${c.name} for $${val}!`);
  };
  const releaseCroc = (id) => {
    const c = crocs.find(x => x.id === id);
    addXp(5);
    setCrocs(prev => prev.filter(x => x.id !== id));
    showMsg(`🌿 Released ${c.name}!`);
  };
  const breedPair = (maleId, femaleId) => {
    setCrocs(prev => prev.map(c => {
      if (c.id === maleId) return { ...c, status: "resting", partner: null, restTimer: 86400 };
      if (c.id === femaleId) return { ...c, status: "resting", partner: null, restTimer: 86400, eggTimer: 25, pendingEgg: true };
      return c;
    }));
    showMsg("❤️ Breeding done! Parents resting for 24hrs. Egg incoming!");
  };
  const unlockZone = (z) => {
    if (money >= z.cost) {
      setMoney(m => m - z.cost);
      setUnlockedZones(prev => [...prev, z.id]);
      showMsg(`🔓 Unlocked ${z.name}!`);
    }
  };

  const males = crocs.filter(c => c.gender === "M" && c.status === "caught");
  const females = crocs.filter(c => c.gender === "F" && c.status === "caught");

  const s = {
    app: { fontFamily: "'Segoe UI',sans-serif", background: "#0f1a0a", minHeight: "100vh", color: "#d4e8c2" },
    header: { background: "#1a3a0a", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #4a7c2f", flexWrap: "wrap", gap: 8 },
    title: { fontSize: 20, fontWeight: "bold", color: "#7ec850" },
    nav: { display: "flex", gap: 6, padding: "8px 16px", background: "#162610", borderBottom: "1px solid #2d5a1b", flexWrap: "wrap" },
    navBtn: (a) => ({ background: a ? "#4a7c2f" : "#1a3a0a", color: a ? "#fff" : "#a0c878", border: "1px solid #4a7c2f", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: a ? "bold" : "normal", fontSize: 13 }),
    content: { padding: 16, maxWidth: 680, margin: "0 auto" },
    card: { background: "#162610", border: "1px solid #2d5a1b", borderRadius: 12, padding: 14, marginBottom: 10 },
    btn: (color = "#4a7c2f") => ({ background: color, color: "#fff", border: "none", borderRadius: 7, padding: "7px 13px", cursor: "pointer", fontWeight: "bold", fontSize: 12, margin: "0 3px 3px 0" }),
    tag: (c) => ({ background: c, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: "bold", display: "inline-block" }),
    msg: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: msgType === "rare" ? "#4a3a00" : msgType === "levelup" ? "#003a4a" : "#2d5a1b", border: `1px solid ${msgType === "rare" ? "#ffd700" : msgType === "levelup" ? "#00bcd4" : "#7ec850"}`, color: "#fff", padding: "10px 22px", borderRadius: 20, fontWeight: "bold", zIndex: 100, fontSize: 14, boxShadow: "0 4px 20px #0008", whiteSpace: "nowrap" },
  };

  const xpPct = Math.min(100, (xp / xpNeeded) * 100);

  return (
    <div style={s.app}>
      {msg && <div style={s.msg}>{msg}</div>}
      <div style={s.header}>
        <div style={s.title}>🐊 Crocodile Hunter</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13 }}>
            <span style={{ color: "#7ec850", fontWeight: "bold" }}>Lv.{level}</span>
            <div style={{ background: "#0d1f05", borderRadius: 6, height: 8, width: 100, marginTop: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${xpPct}%`, background: "#00bcd4", borderRadius: 6, transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 10, color: "#a0c878" }}>{xp}/{xpNeeded} XP</div>
          </div>
          <div style={{ background: "#2d5a1b", padding: "5px 12px", borderRadius: 20, color: "#ffe066", fontWeight: "bold", fontSize: 15 }}>💵 ${money.toLocaleString()}</div>
        </div>
      </div>
      <div style={s.nav}>
        {["home","hunt","manage","breed","codex"].map(sc => (
          <button key={sc} style={s.navBtn(screen===sc)} onClick={() => { setScreen(sc); setHunting(false); setCatching(false); cancelAnimationFrame(animRef.current); }}>
            {sc==="home"?"🏠 Home":sc==="hunt"?"🎯 Hunt":sc==="manage"?"🐊 Crocs":sc==="breed"?"❤️ Breed":"📖 Codex"}
          </button>
        ))}
      </div>

      <div style={s.content}>

        {/* HOME */}
        {screen === "home" && (
          <div>
            <h2 style={{ color: "#7ec850", margin: "0 0 12px" }}>G'day, Hunter!</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              {[["🐊","Caught",stats.caught,"#2d5a1b"],["🏭","Farmed",stats.farmed,"#5a3000"],["🥚","Bred",stats.bred,"#4a007a"],["💰","Sold",stats.sold,"#2d5a2d"],["🌟","Rare",stats.rare,"#5a4a00"]].map(([e,l,v,bg]) => (
                <div key={l} style={{ background: bg, border: "1px solid #4a7c2f", borderRadius: 10, padding: "8px 14px", textAlign: "center", flex: 1, minWidth: 70 }}>
                  <div style={{ fontSize: 20 }}>{e}</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "#7ec850" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#a0c878" }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <h3 style={{ color: "#7ec850", margin: "0 0 10px" }}>🗺️ Hunting Zones</h3>
              {ZONES.map(z => {
                const unlocked = unlockedZones.includes(z.id);
                return (
                  <div key={z.id} style={{ background: unlocked ? "#1f4a10" : "#111", border: `1px solid ${unlocked ? "#4a7c2f" : "#333"}`, borderRadius: 10, padding: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "bold", color: unlocked ? "#d4e8c2" : "#555" }}>{z.name}</div>
                      <div style={{ fontSize: 11, color: "#a0c878" }}>{z.minSize}–{z.maxSize}m · Rare chance: {Math.round(z.rareChance*100)}%</div>
                    </div>
                    {unlocked ? (
                      <button style={s.btn(zone.id===z.id?"#7ec850":"#2d5a1b")} onClick={() => setZone(z)}>{zone.id===z.id?"✓ Active":"Select"}</button>
                    ) : (
                      <button style={s.btn(money>=z.cost?"#b85c00":"#333")} onClick={() => unlockZone(z)} disabled={money<z.cost}>🔒 ${z.cost}</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ ...s.card, fontSize: 12, color: "#a0c878" }}>
              <b style={{ color: "#7ec850" }}>Catch zone:</b> Currently <b style={{ color: "#ffe066" }}>{greenWidth.toFixed(0)}%</b> wide (shrinks as you level up — harder but more XP!)
            </div>
          </div>
        )}

        {/* HUNT */}
        {screen === "hunt" && (
          <div>
            <h2 style={{ color: "#7ec850", margin: "0 0 12px" }}>🎯 {zone.name}</h2>
            {!hunting ? (
              <div style={s.card}>
                <p style={{ margin: "0 0 12px", color: "#a0c878" }}>Zone: <b style={{ color: "#d4e8c2" }}>{zone.name}</b> · Crocs: <b>{zone.minSize}–{zone.maxSize}m</b> · Rare chance: <b style={{ color: "#ffd700" }}>{Math.round(zone.rareChance*100)}%</b></p>
                <p style={{ margin: "0 0 12px", color: "#a0c878", fontSize: 12 }}>Catch zone: <b style={{ color: "#ffe066" }}>{greenWidth.toFixed(0)}%</b> wide (Lv.{level})</p>
                <button style={s.btn()} onClick={startHunt}>🐊 Find a Croc!</button>
              </div>
            ) : (
              <div style={s.card}>
                {wildCroc && (
                  <div style={{ marginBottom: 14, padding: 10, background: wildCroc.species ? `${wildCroc.species.color}44` : "#1a3a0a", border: `1px solid ${wildCroc.species ? wildCroc.species.color : "#2d5a1b"}`, borderRadius: 10 }}>
                    {wildCroc.species && (
                      <div style={{ color: "#ffd700", fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>
                        🌟 RARE SPECIES! {wildCroc.species.emoji} {wildCroc.species.name}
                        <span style={{ fontSize: 11, color: "#d4b800", marginLeft: 6 }}>— {wildCroc.species.desc}</span>
                      </div>
                    )}
                    <div>
                      <span style={s.tag(wildCroc.gender==="M"?"#1a4a8a":"#8a1a5a")}>{wildCroc.gender}</span>{" "}
                      <b style={{ fontSize: 15 }}>{wildCroc.name}</b>
                      <span style={{ fontSize: 12, color: "#a0c878", marginLeft: 8 }}>{wildCroc.size}m · Age {wildCroc.age} · HP {wildCroc.health}%</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#a0c878", marginTop: 4 }}>
                      Farm ~<b>${farmValue(wildCroc)}</b> · Sell ~<b>${sellValue(wildCroc)}</b>
                      {wildCroc.species && <span style={{ color: "#ffd700" }}> · {wildCroc.species.valueBonus}x value!</span>}
                    </div>
                  </div>
                )}
                {catchResult === null && (
                  <div>
                    <div style={{ marginBottom: 8, color: "#a0c878", fontSize: 12 }}>
                      Stop in the <b style={{ color: "#7ec850" }}>green zone</b> to catch! Zone is <b style={{ color: "#ffe066" }}>{greenWidth.toFixed(0)}%</b> wide at Lv.{level}
                    </div>
                    <div style={{ position: "relative", height: 40, background: "#0d1f05", borderRadius: 8, overflow: "hidden", border: "1px solid #4a7c2f", marginBottom: 12 }}>
                      <div style={{ position: "absolute", left: `${greenStart}%`, width: `${greenWidth}%`, height: "100%", background: "#2d6b1040", borderLeft: "2px solid #4a7c2f", borderRight: "2px solid #4a7c2f" }} />
                      <div style={{ position: "absolute", top: 0, left: `${catchBar}%`, width: 5, height: "100%", background: wildCroc?.species ? "#ffd700" : "#7ec850", borderRadius: 3, boxShadow: wildCroc?.species ? "0 0 8px #ffd700" : "none" }} />
                      <div style={{ position: "absolute", width: "100%", textAlign: "center", lineHeight: "40px", fontSize: 12, color: "#a0c87880" }}>
                        {greenStart.toFixed(0)}% ——— {(greenStart+greenWidth).toFixed(0)}%
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {!catching ? (
                        <button style={s.btn()} onClick={() => setCatching(true)}>▶ Start</button>
                      ) : (
                        <button style={s.btn(wildCroc?.species?"#7a5a00":"#c8a02a")} onClick={attemptCatch}>🪤 CATCH!</button>
                      )}
                      <button style={s.btn("#444")} onClick={() => { setHunting(false); setCatching(false); cancelAnimationFrame(animRef.current); }}>Leave</button>
                    </div>
                  </div>
                )}
                {catchResult === "success" && (
                  <div>
                    <div style={{ color: wildCroc?.species ? "#ffd700" : "#7ec850", fontWeight: "bold", fontSize: 15 }}>
                      {wildCroc?.species ? `🌟 Rare catch! +40 XP` : `🎉 Caught! +20 XP`}
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                      <button style={s.btn()} onClick={startHunt}>Hunt Again</button>
                      <button style={s.btn("#2d5a8a")} onClick={() => setScreen("manage")}>View Crocs</button>
                    </div>
                  </div>
                )}
                {catchResult === "fail" && (
                  <div>
                    <div style={{ color: "#c84a4a", fontWeight: "bold" }}>💨 It escaped!</div>
                    <button style={{ ...s.btn(), marginTop: 10 }} onClick={startHunt}>Try Again</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MANAGE */}
        {screen === "manage" && (
          <div>
            <h2 style={{ color: "#7ec850", margin: "0 0 12px" }}>🐊 Your Crocs ({crocs.length})</h2>
            {crocs.length === 0 && <div style={s.card}>No crocs yet — go hunting!</div>}
            {crocs.map(c => (
              <div key={c.id} style={{ ...s.card, borderColor: c.species ? c.species.color : c.gender==="M" ? "#1a4a8a" : "#8a1a5a" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6 }}>
                  <div>
                    {c.species && <span style={s.tag(c.species.color)}>{c.species.emoji} {c.species.name}</span>}{" "}
                    <span style={s.tag(c.gender==="M"?"#1a4a8a":"#8a1a5a")}>{c.gender}</span>{" "}
                    <b>{c.name}</b>{" "}
                    <span style={{ fontSize: 11, color: "#a0c878" }}>{c.size}m · Age {c.age} · HP {c.health}%</span>
                  </div>
                  <span style={s.tag(
                    c.status==="farming"?"#7a4000":c.status==="breeding"?"#4a007a":c.status==="egg"?"#7a6000":c.status==="hatchling"?"#007a4a":"#2d5a1b"
                  )}>
                    {                    c.status==="farming"?`🏭 ${c.farmTimer}s`:c.status==="resting"?(c.pendingEgg?`🥚 egg+rest ${Math.floor(c.restTimer/3600)}h${Math.floor((c.restTimer%3600)/60)}m`:`😴 rest ${Math.floor(c.restTimer/3600)}h${Math.floor((c.restTimer%3600)/60)}m`):c.status==="egg"?`🥚 ${c.eggTimer}s`:c.status==="hatchling"?"🐊 Hatchling!":"✅ Ready"}
                  </span>
                </div>
                {(c.status === "caught" || c.status === "hatchling") && (
                  <div style={{ marginTop: 10 }}>
                    <button style={s.btn("#7a4000")} onClick={() => farmCroc(c.id)}>🏭 Farm (${farmValue(c)})</button>
                    <button style={s.btn("#2d5a8a")} onClick={() => sellCroc(c.id)}>💵 Sell (${sellValue(c)})</button>
                    <button style={s.btn("#2d6b40")} onClick={() => releaseCroc(c.id)}>🌿 Release</button>
                    {c.status === "caught" && c.gender === "M" && females.length > 0 && (
                      <button style={s.btn("#4a007a")} onClick={() => setScreen("breed")}>❤️ Breed</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* BREED */}
        {screen === "breed" && (
          <div>
            <h2 style={{ color: "#7ec850", margin: "0 0 12px" }}>❤️ Breeding</h2>
            {males.length === 0 || females.length === 0 ? (
              <div style={s.card}>
                Need at least one ready <b>male</b> and one ready <b>female</b>.
                <div style={{ marginTop: 10 }}><button style={s.btn()} onClick={() => setScreen("hunt")}>🎯 Go Hunting</button></div>
              </div>
            ) : (
              <div>
                <div style={{ ...s.card, color: "#a0c878", fontSize: 12 }}>
                  Pair a male + female. Breeding takes ~25s, then eggs hatch in ~15s. Rare species can breed with common ones!
                </div>
                {males.map(m => (
                  <div key={m.id} style={s.card}>
                    <div style={{ fontWeight: "bold", marginBottom: 8 }}>
                      {m.species && <span style={s.tag(m.species.color)}>{m.species.emoji}</span>}{" "}
                      <span style={s.tag("#1a4a8a")}>M</span> <b>{m.name}</b> — {m.size}m
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {females.map(f => (
                        <button key={f.id} style={s.btn("#4a007a")} onClick={() => breedPair(m.id, f.id)}>
                          ❤️ + {f.species ? f.species.emoji : "🐊"} {f.name} ({f.size}m)
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CODEX */}
        {screen === "codex" && (
          <div>
            <h2 style={{ color: "#7ec850", margin: "0 0 12px" }}>📖 Rare Species Codex</h2>
            <div style={{ ...s.card, fontSize: 12, color: "#a0c878", marginBottom: 14 }}>
              Hunt in higher-tier zones for better chances. Your <b>level</b> increases XP gain but also shrinks the catch zone!
            </div>
            {RARE_SPECIES.map(r => {
              const caught = crocs.some(c => c.species?.id === r.id) || stats.rare > 0;
              return (
                <div key={r.id} style={{ ...s.card, borderColor: r.color, opacity: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 22 }}>{r.emoji}</span>{" "}
                      <b style={{ color: "#d4e8c2", fontSize: 15 }}>{r.name}</b>
                      <div style={{ fontSize: 12, color: "#a0c878", marginTop: 3 }}>{r.desc}</div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 12 }}>
                      <div style={{ color: "#ffd700" }}>💰 {r.valueBonus}x value</div>
                      <div style={{ color: "#a0c878" }}>Rarity: {Math.round(r.rarity * 100)}%</div>
                      {r.sizeBonus > 0 && <div style={{ color: "#7ec850" }}>+{r.sizeBonus}m size</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
