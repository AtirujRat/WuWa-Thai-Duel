import { updateBattleLog } from "./battle-log.js";
import { formatCardText } from "./card-text.js";
import { phaseTrack } from "./phase-track.js";
import {
  rulesBoard,
  setupRulesUI,
  showRuleCard,
  opponentHand,
} from "./rules-ui.js";
import {
  installSound,
  pickup,
  release,
  updateEffects,
  sound,
} from "./card-fx.js";
installSound();
import { validateDeck, presetDeck } from "./deck-rules.js";
let placeFaceDown = false,
  tableDrag = null,
  suppressTableClick = false;
function playmat(p, mine, live) {
  const legacy = (z) =>
    (p[z] || [])
      .map(
        (code, i) =>
          `<button class="mat-card ${z === "concerto" ? "horizontal" : ""}" style="left:8px;top:${8 + i * 28}px" ${mine && live ? `data-zone="${z}" data-index="${i}"` : `data-detail="${code}"`} aria-label="${esc(card(code).name)}"><img src="${card(code).img}" alt="${esc(card(code).name)}"></button>`,
      )
      .join("");
  const zone = (z) =>
    `<div class="mat-zone mat-${z}" ${mine && live && (!room.rulesVersion || (z === "concerto" ? room.phase === "action" && !p.used?.charge : ["battle", "defense"].includes(room.phase))) ? `data-drop-zone="${z}"` : ""}><span class="mat-label">${z === "concerto" ? "คอนแชร์โต · แนวนอน" : "สนามแอ็กชัน"}</span>${legacy(z)}${(
      p.table || []
    )
      .filter((c) => c.zone === z)
      .map(
        (c) =>
          `<button data-fx-card="${c.id}" class="mat-card ${z === "concerto" ? "horizontal" : ""} ${c.faceDown ? "face-down" : ""}" style="left:${c.x * 100}%;top:${c.y * 100}%;transform:translate(-${c.x * 100}%,-${c.y * 100}%)" ${mine && live ? `data-table-drag="${c.id}" data-table-menu="${c.id}"` : !c.faceDown ? `data-detail="${c.code}"` : ""} aria-label="${c.faceDown ? "การ์ดคว่ำ" : esc(card(c.code).name)}">${c.faceDown ? '<span class="mat-back" aria-hidden="true"></span>' : `<img draggable="false" src="${card(c.code).img}" alt="${esc(card(c.code).name)}">`}</button>`,
      )
      .join("")}</div>`;
  const field = [
    ...p.field.filter((code) => code !== p.leader).slice(0, 1),
    p.leader,
    ...p.field.filter((code) => code !== p.leader).slice(1),
  ].filter(Boolean);
  return `<div class="playmat ${mine ? "own-mat" : "opponent-mat"}">${zone("concerto")}${zone("action")}<div class="mat-characters">${field.map((code) => `<div class="character-slot ${code === p.leader ? "leader-slot" : ""}"><button data-detail="${code}" class="art-button">${img(card(code))}</button><span>${code === p.leader ? "ผู้นำ" : "แบ็ค"} · Lv.${card(code).level}</span>${mine && (room.rulesVersion ? room.status === "waiting" || (room.phase === "action" && room.active === room.seat && !room.choice && !p.used?.switch) : live && room.mode !== "bot") && code !== p.leader ? btn("leader", "เป็นผู้นำ", `data-code="${code}"`) : ""}</div>`).join("")}</div><div class="character-deck"><span class="deck-back pale" role="img" aria-label="หลังการ์ดตัวละคร"></span><span>เด็คตัวละคร · ${p.reserveCount}</span>${mine ? (room.rulesVersion ? '<button data-rule="reserve">ดู / อัปเลเวล</button>' : btn("showReserve", "ดูการ์ด")) : ""}</div><div class="mat-trash">${zoneUI(p, "trash", mine, live && !room.rulesVersion && room.mode !== "bot")}</div><div class="mat-deck"><span class="deck-back" role="img" aria-label="หลังการ์ดแอ็กชัน"></span><span>สำรับแอ็กชัน · ${p.deckCount}</span>${mine && !room.rulesVersion ? `<div class="deck-buttons">${btn("draw", "จั่ว", live && p.deckCount ? "" : "disabled", "primary")}${btn("shuffle", "สับเด็ค", live && p.deckCount > 1 ? "" : "disabled")}</div>` : ""}</div></div>`;
}
document.addEventListener("change", (e) => {
  if (e.target.name === "placement") placeFaceDown = e.target.value === "down";
});
document.addEventListener(
  "click",
  async (e) => {
    if (suppressTableClick) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    const inPlay =
      tab === "play" &&
      !inLobby &&
      (!!room ||
        document.body.classList.contains("battle-view") ||
        !!document.querySelector(".battle-shell"));
    if (inPlay) {
      const handCard = e.target.closest(
        ".hand .card, .hand [data-hand-drag], .hand [data-place-hand]",
      );
      const cardEl = e.target.closest(
        '.card, .mat-card, [data-detail], [data-hand-drag], [data-table-drag], [data-table-menu], [data-place-hand], [data-fx-card], [data-rule="combo"], [data-rule="reserve"], [data-rule="levelPick"], [data-rule="place"], [data-rule="return"], .character-slot, .rule-picks label, .rule-picks > div',
      );
      if (handCard) sound("click");
      else if (cardEl) sound("card");
    }
    const menu = e.target.closest("[data-table-menu]"),
      place = e.target.closest("[data-place-hand]"),
      command = e.target.closest("[data-table-command]");
    if (menu && room.rulesVersion) {
      e.stopImmediatePropagation();
      showRuleCard(menu.dataset.tableMenu);
      return;
    }
    if (menu) {
      e.stopImmediatePropagation();
      const c = room.players[room.seat].table.find(
        (c) => c.id === menu.dataset.tableMenu,
      );
      detail(
        c.code,
        `<p>${c.faceDown ? "การ์ดนี้คว่ำอยู่ คู่เล่นมองไม่เห็นหน้าการ์ด" : "การ์ดนี้หงายอยู่"}</p><div class="row"><button data-table-command="tableFlip" data-id="${c.id}">${c.faceDown ? "หงาย" : "คว่ำ"}การ์ด</button><button data-table-command="tableTake" data-id="${c.id}" data-to="hand">กลับมือ</button>${room.mode === "bot" ? "" : `<button data-table-command="tableTake" data-id="${c.id}" data-to="trash">กองทิ้ง</button>`}</div>`,
      );
    }
    if (place && room.rulesVersion) {
      e.stopImmediatePropagation();
      showRuleCard(null, Number(place.dataset.placeHand));
      return;
    }
    if (place) {
      pickup(null);
      e.stopImmediatePropagation();
      const i = Number(place.dataset.placeHand);
      dialog.innerHTML = `<h2>วาง ${esc(card(room.players[room.seat].hand[i]).name)}</h2><p>ลงแบบ${placeFaceDown ? "คว่ำ" : "หงาย"} · เปลี่ยนได้ที่ตัวเลือกเหนือสนาม</p><div class="row">${["action", "concerto"].map((z) => `<button data-table-command="tablePlace" data-index="${i}" data-zone="${z}">${z === "action" ? "สนามแอ็กชัน" : "ช่องซ้ายแนวนอน"}</button>`).join("")}${btn("close", "ปิด")}</div>`;
      dialog.showModal();
    }
    if (command) {
      e.stopImmediatePropagation();
      const d = command.dataset;
      dialog.close();
      await action({
        type: d.tableCommand,
        id: d.id,
        to: d.to,
        index: Number(d.index),
        code: room.players[room.seat].hand[Number(d.index)],
        zone: d.zone,
        x: 0.5,
        y: 0.5,
        faceDown: placeFaceDown,
        version: room.version,
      });
    }
  },
  true,
);
document.addEventListener("dragstart", (e) => {
  if (e.target.closest("[data-hand-drag],[data-table-drag]"))
    e.preventDefault();
});
document.addEventListener("pointerdown", (e) => {
  const el = e.target.closest("[data-hand-drag],[data-table-drag]");
  if (
    !el ||
    e.button !== 0 ||
    busy ||
    e.target.closest("button:not(.art-button):not(.mat-card)")
  )
    return;
  tableDrag = {
    el,
    startX: e.clientX,
    startY: e.clientY,
    pointer: e.pointerId,
    version: room.version,
    id: el.dataset.tableDrag,
    index: Number(el.dataset.handDrag),
    code: el.dataset.code,
    ghost: null,
  };
});
document.addEventListener(
  "pointermove",
  (e) => {
    const d = tableDrag;
    if (!d || e.pointerId !== d.pointer) return;
    if (!d.ghost && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 7)
      return;
    e.preventDefault();
    if (!d.ghost) {
      pickup(d.el);
      d.ghost = d.el.cloneNode(true);
      d.ghost.className = "table-drag-ghost";
      d.ghost.removeAttribute("style");
      document.body.append(d.ghost);
      document.body.classList.add("table-dragging");
    }
    d.ghost.style.left = e.clientX + "px";
    d.ghost.style.top = e.clientY + "px";
    document
      .querySelectorAll(".drop-hover")
      .forEach((el) => el.classList.remove("drop-hover"));
    document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("[data-drop-zone]")
      ?.classList.add("drop-hover");
  },
  { passive: false },
);
async function finishTableDrag(e, cancel = false) {
  const d = tableDrag;
  if (!d || e.pointerId !== d.pointer) return;
  tableDrag = null;
  release(d.el);
  document.body.classList.remove("table-dragging");
  document
    .querySelectorAll(".drop-hover")
    .forEach((el) => el.classList.remove("drop-hover"));
  if (!d.ghost) return;
  d.ghost.remove();
  suppressTableClick = true;
  setTimeout(() => (suppressTableClick = false), 150);
  if (cancel) return;
  const target = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest("[data-drop-zone]");
  if (!target) {
    toast("ลากไปวางในสนามของคุณหรือช่องซ้าย");
    return;
  }
  const r = target.getBoundingClientRect();
  await action({
    type: d.id ? "tableMove" : "tablePlace",
    id: d.id,
    index: d.index,
    code: d.code,
    zone: target.dataset.dropZone,
    x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    faceDown: placeFaceDown,
    version: d.version,
  });
}
document.addEventListener("pointerup", (e) => finishTableDrag(e));
document.addEventListener("pointercancel", (e) => finishTableDrag(e, true));
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let cards = [],
  meta = {},
  saved = [],
  tab = "cards",
  query = "",
  set = "",
  kind = "",
  character = "",
  page = 1,
  deck = { name: "เด็คของฉัน", entries: {} },
  room = null,
  token = "",
  busy = false,
  selectedMulligan = new Set(),
  syncError = false;
let actionQuery = "",
  actionColor = "",
  actionFilterMode = "all";
const CHARACTER_LIST = [
  {
    id: "Camellya",
    name: "Camellya",
    th: "คาเมลเลีย",
    lv0: "BP01-005",
    element: "ทำลาย (Havoc)",
    weapon: "ดาบ",
  },
  {
    id: "Chixia",
    name: "Chixia",
    th: "ฉือเสีย",
    lv0: "BP01-027",
    element: "หลอมละลาย (Fusion)",
    weapon: "ปืนคู่",
  },
  {
    id: "Encore",
    name: "Encore",
    th: "อังกอร์",
    lv0: "BP01-015",
    element: "หลอมละลาย (Fusion)",
    weapon: "สื่อเวท",
  },
  {
    id: "Jinshi",
    name: "Jinhsi",
    th: "จินซี",
    lv0: "BP01-030",
    element: "แสงประกาย (Spectro)",
    weapon: "ดาบใหญ่",
  },
  {
    id: "Rover(F)",
    name: "Rover (Female)",
    th: "โรเวอร์ (หญิง)",
    lv0: "BP01-018",
    element: "แสงประกาย (Spectro)",
    weapon: "ดาบ",
  },
  {
    id: "Rover(M)",
    name: "Rover (Male)",
    th: "โรเวอร์ (ชาย)",
    lv0: "BP01-021",
    element: "แสงประกาย (Spectro)",
    weapon: "ดาบ",
  },
  {
    id: "Sanhua",
    name: "Sanhua",
    th: "ซานฮวา",
    lv0: "BP01-033",
    element: "เหมันต์ (Glacio)",
    weapon: "ดาบ",
  },
  {
    id: "Shorekeeper",
    name: "Shorekeeper",
    th: "ชอร์คีปเปอร์",
    lv0: "BP01-010",
    element: "แสงประกาย (Spectro)",
    weapon: "สื่อเวท",
  },
  {
    id: "Yangyang",
    name: "Yangyang",
    th: "หยางหยาง",
    lv0: "BP01-024",
    element: "วายุ (Aero)",
    weapon: "ดาบ",
  },
];
function getSelectedCharDefs() {
  const charsInDeck = Object.keys(deck.entries)
    .map((code) => card(code))
    .filter((c) => c && c.type === "character");
  const namesInDeck = new Set(charsInDeck.map((c) => c.character));
  return CHARACTER_LIST.filter(
    (ch) => namesInDeck.has(ch.th) || deck.entries[ch.lv0],
  );
}
function toggleCharacter(charId) {
  const def = CHARACTER_LIST.find((c) => c.id === charId || c.th === charId);
  if (!def) return;
  const selected = getSelectedCharDefs();
  const isSelected = selected.some((c) => c.id === def.id);
  if (isSelected) {
    for (const code of Object.keys(deck.entries)) {
      const c = card(code);
      if (c && c.type === "character" && c.character === def.th)
        delete deck.entries[code];
    }
    toast("ปลด " + def.name + " ออกจากเด็ค");
  } else {
    if (selected.length >= 3) {
      toast("เลือกได้สูงสุด 3 ตัวละคร (ปลดตัวเดิมออกก่อน)");
      return;
    }
    const quota = { 0: 1, 1: 2, 2: 2 };
    const byLevel = {};
    cards
      .filter((c) => c.type === "character" && c.character === def.th)
      .sort((a, b) => a.code.localeCompare(b.code))
      .forEach((c) => {
        (byLevel[c.level] ??= []).push(c);
      });
    let count = 0;
    for (const [lv, max] of Object.entries(quota))
      for (const c of (byLevel[lv] || []).slice(0, max)) {
        deck.entries[c.code] = 1;
        count++;
      }
    if (!count) deck.entries[def.lv0] = 1;
    toast(
      count
        ? "เลือก " + def.name + " แล้ว · ใส่การ์ดตัวละครให้ " + count + " ใบ (Lv.0 ×1, Lv.1 ×2, Lv.2 ×2)"
        : "เลือก " + def.name + " แล้ว",
    );
  }
  refreshDeck();
}
const app = $("#app"),
  dialog = $("#detail");
let toastTimer;

function toast(s) {
  $("#toast").textContent = s;
  $("#toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 4000);
}
async function api(url, data, auth = "") {
  const r = await fetch(url, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: "Bearer " + auth } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const j = await r.json();
  if (!r.ok) throw Error(j.error || "ติดต่อเซิร์ฟเวอร์ไม่ได้");
  return j;
}
const card = (code) => cards.find((c) => c.code === code);
setupRulesUI({
  getRoom: () => room,
  send: action,
  dialog,
  card,
  esc,
  showCard: detail,
});
const btn = (action, label, extra = "", cls = "") =>
  `<button class="${cls}" data-do="${action}" ${extra}>${label}</button>`;
const img = (c) =>
  `<img class="art" src="${esc(c.img)}" alt="${esc(c.name)} ${c.code}" loading="lazy">`;
function tile(c, add = true) {
  const locked = add && c.type === "character";
  return `<article class="card ${locked ? "locked-card" : ""}"><button class="art-button" data-detail="${c.code}" aria-label="อ่าน ${esc(c.name)}">${img(c)}</button><div class="card-head"><span class="code">${c.code}</span>${locked ? '<span class="lock-tag" title="ตัวละครถูกเลือกให้อัตโนมัติเป็นพรีเซ็ต จัดการได้ที่แท็บสร้างเด็ค">🔒 พรีเซ็ต</span>' : add ? btn("add", "+", `data-code="${c.code}" aria-label="เพิ่ม ${esc(c.name)} ลงเด็ค"`, "add") : ""}</div><h3>${esc(c.name)}</h3><div class="card-meta">${c.type === "character" ? "ตัวละคร · Lv. " + c.level : c.color + " · ค่าใช้ " + c.fee + " · พลัง " + c.damage}</div></article>`;
}
function filters() {
  return `<div class="toolbar"><input class="search" id="search" aria-label="ค้นหาการ์ด" placeholder="ค้นหาชื่อ ความสามารถ หรือรหัสการ์ด…" value="${esc(query)}"><select id="set" aria-label="ชุดการ์ด"><option value="">ทุกชุด</option>${["SD01", "SD02", "BP01"].map((s) => `<option ${set === s ? "selected" : ""}>${s}</option>`).join("")}</select><select id="kind" aria-label="ประเภท"><option value="">ทุกประเภท</option><option value="character" ${kind === "character" ? "selected" : ""}>ตัวละคร</option><option value="action" ${kind === "action" ? "selected" : ""}>แอ็กชัน</option></select><select id="character" aria-label="ตัวละคร"><option value="">ทุกตัวละคร</option>${[...new Set(cards.map((c) => c.character))].map((s) => `<option ${character === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>`;
}
function filtered() {
  return cards.filter(
    (c) =>
      (!set || c.set === set) &&
      (!kind || c.type === kind) &&
      (!character || c.character === character) &&
      [c.name, c.nameTh, c.nameJp, c.nameEn, c.code, c.effectTh, ...c.tags]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
}
function results() {
  const arr = filtered();
  const pages = Math.max(1, Math.ceil(arr.length / 24));
  page = Math.min(page, pages);
  return `<p class="muted small">${arr.length} รหัสการ์ด · กดภาพเพื่ออ่านคำแปล</p><div class="grid">${
    arr
      .slice((page - 1) * 24, page * 24)
      .map((c) => tile(c))
      .join("") || '<div class="empty">ไม่พบการ์ดที่ตรงกับการค้นหา</div>'
  }</div><div class="pagination">${btn("prev", "← ก่อนหน้า", page === 1 ? "disabled" : "")}<span>${page} / ${pages}</span>${btn("next", "ถัดไป →", page === pages ? "disabled" : "")}</div>`;
}
function deckCardRow(d) {
  const v = validateDeck(d.entries, cards);
  const seen = new Set(),
    uniqueChars = [];
  for (const c of Object.keys(d.entries)
    .map((code) => card(code))
    .filter((c) => c && c.type === "character"))
    if (!seen.has(c.character)) {
      seen.add(c.character);
      uniqueChars.push(c);
    }
  const isActive = d.isPreset
    ? !deck.id && deck.name === d.name
    : !!deck.id && deck.id === d.id;
  const badge = d.isPreset
    ? '<span class="small preset-pill">เด็คตั้งต้น</span>'
    : `<span class="small ${v.valid ? "pill" : "danger"}">${v.valid ? "พร้อมเล่น" : "ยังไม่ครบ"}</span>`;
  const actions = d.isPreset
    ? ""
    : `${btn("editDeck", "แก้ไข", `data-id="${d.id}"`)}${btn("delDeck", "ลบ", `data-id="${d.id}"`, "danger")}`;
  return `<div class="deck-card-row ${isActive ? "selected" : ""}" data-do="${d.isPreset ? "selectPreset" : "selectSaved"}" ${d.isPreset ? `data-preset="${d.presetKey}"` : `data-id="${d.id}"`}><div class="deck-card-thumbs">${uniqueChars
    .slice(0, 3)
    .map((c) => `<img src="${c.img}" alt="${esc(c.name)}">`)
    .join("")}</div><div class="deck-card-info"><h3>${esc(d.name)}${isActive ? ' <span class="deck-selected-tag">✓ กำลังใช้</span>' : ""}</h3><p class="muted small">${esc(uniqueChars.map((c) => c.name).join(" · "))} — ${v.actions} ใบ</p></div><div class="deck-card-actions">${badge}${actions}</div></div>`;
}
const DECK_STORE='wuwa-decks-v2';
let deckStoreReady=false,deletedDeckIds=[];
function readStoredJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function validLocalDeck(d){return d&&typeof d.name==='string'&&d.entries&&typeof d.entries==='object'&&!Array.isArray(d.entries)&&Object.entries(d.entries).every(([code,n])=>/^[A-Za-z0-9-]+$/.test(code)&&Number.isInteger(n)&&n>0&&n<=3)}
function writeDeckStore(nextSaved=saved,nextDraft=deck,nextDeleted=deletedDeckIds){
 localStorage.setItem(DECK_STORE,JSON.stringify({saved:nextSaved,draft:nextDraft,deleted:nextDeleted}));
}
function saveDeckDraft(){if(deckStoreReady)try{writeDeckStore()}catch{}}
function restoreDeckStore(remote){
 const stored=readStoredJSON(DECK_STORE,{});
 const previous=stored.saved??readStoredJSON('wuwa-saved-decks-v1',[]);
 deletedDeckIds=Array.isArray(stored.deleted)?stored.deleted.filter(x=>typeof x==='string'):[];
 saved=(Array.isArray(previous)?previous:[]).filter(d=>validLocalDeck(d)&&typeof d.id==='string'&&/^[A-Za-z0-9_-]+$/.test(d.id)&&!deletedDeckIds.includes(d.id));
 for(const d of remote||[])if(validLocalDeck(d)&&typeof d.id==='string'&&/^[A-Za-z0-9_-]+$/.test(d.id)&&!deletedDeckIds.includes(d.id)&&!saved.some(x=>x.id===d.id))saved.push(d);
 const draft=stored.draft??readStoredJSON('wuwa-deck-draft-v1',null);if(validLocalDeck(draft))deck=draft;
 deckStoreReady=true;saveDeckDraft();
}
function deleteLocalDeck(id){
 const nextSaved=saved.filter(d=>d.id!==id),nextDeleted=[...new Set([...deletedDeckIds,id])];
 const nextDraft=deck.id===id?{name:'เด็คของฉัน',entries:{}}:deck;
 writeDeckStore(nextSaved,nextDraft,nextDeleted);
 saved=nextSaved;deck=nextDraft;deletedDeckIds=nextDeleted;
}

function savedDecksModalHTML() {
  return `${btn("close", "✕", "", "close")}<h2>เด็คที่บันทึกไว้ <span class="badge">${saved.length}</span></h2><div class="deck-card-list">${saved.map(deckCardRow).join("") || '<div class="empty">ยังไม่มีเด็คที่บันทึกไว้</div>'}</div>`;
}
function deckPickerInline() {
  const presets = ["SD01", "SD02"].map((set) => ({
    ...presetDeck(set, cards),
    isPreset: true,
    presetKey: set,
  }));
  return `<div class="deck-card-list">${[...presets, ...saved].map(deckCardRow).join("")}</div>`;
}
function deckSummaryBar() {
  const v = validateDeck(deck.entries, cards);
  const actionsInDeck = Object.entries(deck.entries)
    .map(([code, n]) => [card(code), n])
    .filter(([c]) => c && c.type === "action");
  const colorCount = (color) =>
    actionsInDeck
      .filter(([c]) => c.color === color)
      .reduce((s, [, n]) => s + n, 0);
  const chip = (dot, label, n) =>
    `<span class="color-chip"><span class="color-dot ${dot}"></span>${label} ${n}</span>`;
  return `<div id="deckSummary" class="panel deck-summary-bar row"><input id="deckName" aria-label="ชื่อเด็ค" maxlength="80" value="${esc(deck.name)}"><span class="small ${v.valid ? "pill" : "danger"}">${v.valid ? "✓ พร้อมเล่น" : v.errors.slice(0, 2).map(esc).join(" · ")}</span><span class="badge">${v.characters} ตัวละคร</span><span class="badge">${v.actions} / 40 แอ็กชัน</span><span class="color-count-group">${chip("dot-red", "แดง", colorCount("สีแดง"))}${chip("dot-green", "เขียว", colorCount("สีเขียว"))}${chip("dot-blue", "ฟ้า", colorCount("สีน้ำเงิน"))}</span>${btn("save", "บันทึกเด็ค", "", "primary")}</div>`;
}
function catalog() {
  return `<div class="stats"><div><strong>${cards.length}</strong> รหัสการ์ด</div><div><strong>${meta.records}</strong> ภาพการ์ด</div><div><strong>TH</strong> คำแปลฉบับร่าง</div></div><p class="small muted">ข้อมูล UCP ${meta.date} · ครบรายการที่ฐานข้อมูลญี่ปุ่นส่งกลับมา · <a href="#" data-do="sources">ขอบเขตข้อมูล</a></p>${filters()}<section id="results">${results()}</section>`;
}
function section1Characters() {
  const selected = getSelectedCharDefs();
  const selectedIds = new Set(selected.map((c) => c.id));
  return `<section class="deck-section panel"><div class="deck-section-header"><div><h2>1. ตัวละคร (การ์ดตัวละคร)</h2></div><span class="badge count-badge ${selected.length === 3 ? "pill" : ""}">${selected.length === 3 ? "✓ " : ""}เลือกแล้ว ${selected.length} / 3 ตัว</span></div><div class="char-picker-grid section-scroll">${CHARACTER_LIST.map(
    (ch) => {
      const isSel = selectedIds.has(ch.id);
      const lv0Card = card(ch.lv0);
      return `<div class="char-card-item ${isSel ? "selected" : ""}" data-do="toggleChar" data-char="${ch.id}"><span class="char-check">${isSel ? "✓" : "+"}</span><button class="art-button" data-detail="${ch.lv0}" aria-label="อ่าน ${esc(ch.name)}" onclick="event.stopPropagation()">${lv0Card ? img(lv0Card) : ""}</button><div class="char-name">${esc(ch.name)}</div><div class="char-sub">${esc(ch.th)} · Lv.0</div><div class="char-sub muted">${esc(ch.element)}</div><button class="char-btn-toggle ${isSel ? "primary" : ""}" data-do="toggleChar" data-char="${ch.id}">${isSel ? "✓ เลือกแล้ว" : "+ เลือกตัวนี้"}</button></div>`;
    },
  ).join("")}</div></section>`;
}
function section2CharacterCards() {
  const selected = getSelectedCharDefs();
  const charsInDeck = Object.keys(deck.entries)
    .map((code) => card(code))
    .filter((c) => c && c.type === "character");
  const totalCharCards = charsInDeck.reduce(
    (s, c) => s + (deck.entries[c.code] || 0),
    0,
  );
  if (selected.length === 0) {
    return `<section class="deck-section panel"><div class="deck-section-header"><div><h2>2. การ์ดตัวละคร</h2></div><span class="badge">0 / 15 ใบ</span></div><div class="empty">ยังไม่ได้เลือกตัวละคร<br><span class="small"></span></div></section>`;
  }
  return `<section class="deck-section panel preset-section"><div class="deck-section-header"><div><h2>2. การ์ดตัวละคร <span class="preset-label">🔒 พรีเซ็ต</span></h2><p class="muted small">ระบบเลือกให้อัตโนมัติเมื่อเลือกตัวละครหลัก (Lv.0 ×1 · Lv.1 ×2 · Lv.2 ×2 ต่อคน) — ส่วนนี้จัดการเองไม่ได้ ปรับได้เฉพาะการ์ดแอ็กชันด้านล่าง</p></div><span class="badge ${totalCharCards >= 3 && totalCharCards <= 15 ? "pill" : "danger"}">${totalCharCards} / 15 ใบ</span></div><div class="char-level-rows section-scroll">${selected
    .map((ch) => {
      const charCards = cards
        .filter((c) => c.type === "character" && c.character === ch.th)
        .sort(
          (a, b) =>
            Number(a.level) - Number(b.level) || a.code.localeCompare(b.code),
        );
      return `<div class="char-level-row"><div class="char-level-label">${esc(ch.name)}</div><div class="char-level-cards">${charCards
        .map((c) => {
          const inDeck = (deck.entries[c.code] || 0) > 0;
          return `<button class="char-level-card ${inDeck ? "in-deck" : ""}" data-detail="${c.code}" aria-label="อ่าน ${esc(c.name)} Lv.${c.level}">${img(c)}<span class="char-level-badge">Lv.${c.level}</span></button>`;
        })
        .join("")}</div></div>`;
    })
    .join("")}</div></section>`;
}
function renderActionCardsGrid() {
  const selected = getSelectedCharDefs();
  const selectedNames = new Set(selected.map((d) => d.th));
  if (selectedNames.size === 0) {
    return `<div class="empty" style="grid-column:1/-1">ยังไม่ได้เลือกตัวละคร<br><span class="small"></span></div>`;
  }
  let actions = cards.filter(
    (c) =>
      c.type === "action" &&
      (c.character === "ใช้ร่วมกัน" || selectedNames.has(c.character)),
  );
  if (actionColor) actions = actions.filter((c) => c.color === actionColor);
  if (actionQuery) {
    const q = actionQuery.toLowerCase();
    actions = actions.filter((c) =>
      [c.name, c.nameTh, c.code, c.character, c.effectTh]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  if (actions.length === 0)
    return `<div class="empty" style="grid-column:1/-1">ไม่พบการ์ดแอ็กชันตามเงื่อนไขที่ค้นหา</div>`;
  const actionCount = Object.keys(deck.entries)
    .map((code) => card(code))
    .filter((c) => c && c.type === "action")
    .reduce((s, c) => s + (deck.entries[c.code] || 0), 0);
  return actions
    .map((c) => {
      const inDeck = deck.entries[c.code] || 0;
      return `<article class="card action-card-tile compatible" style="background:#101a26;padding:10px;border-radius:8px;border:1px solid ${inDeck > 0 ? "var(--gold)" : "var(--line)"}"><button class="art-button" data-detail="${c.code}" aria-label="อ่าน ${esc(c.name)}">${img(c)}</button><div class="card-head"><span class="code">${c.code}</span><span class="badge ${c.color === "สีแดง" ? "color-red" : c.color === "สีเขียว" ? "color-green" : "color-blue"}">${esc(c.color)}</span></div><h3 style="font-size:15px;margin:4px 0">${esc(c.name)}</h3><div class="card-meta">${c.character === "ใช้ร่วมกัน" ? '<span class="action-compat-badge">🌐 ใช้ร่วมกัน</span>' : `<span class="action-compat-badge">✓ ${esc(c.character)}</span>`}</div><div class="card-meta" style="margin-top:4px">ค่าใช้ ${c.fee} · พลัง ${c.damage} · เร็ว ${c.speed || "—"}</div><div class="row" style="justify-content:space-between;align-items:center;margin-top:10px;border-top:1px solid var(--line);padding-top:8px"><span class="badge ${inDeck > 0 ? "pill" : ""}">ในเด็ค: ${inDeck} / 3</span><div class="row" style="gap:4px">${btn("remove", "−", `data-code="${c.code}" ${inDeck === 0 ? "disabled" : ""} aria-label="ลด ${esc(c.name)}"`, "add")}${btn("add", "+", `data-code="${c.code}" ${inDeck >= 3 || actionCount >= 40 ? "disabled" : ""} aria-label="เพิ่ม ${esc(c.name)}"`, "add")}</div></div></article>`;
    })
    .join("");
}
function section3ActionCards() {
  const selected = getSelectedCharDefs();
  const selectedNames = new Set(selected.map((d) => d.th));
  const actionsInDeck = Object.keys(deck.entries)
    .map((code) => card(code))
    .filter((c) => c && c.type === "action");
  const actionCount = actionsInDeck.reduce(
    (s, c) => s + (deck.entries[c.code] || 0),
    0,
  );
  const totalCompat = cards.filter(
    (c) =>
      c.type === "action" &&
      selectedNames.size > 0 &&
      (c.character === "ใช้ร่วมกัน" || selectedNames.has(c.character)),
  ).length;
  return `<section class="deck-section panel"><div class="deck-section-header"><div><h2>3. เลือกการ์ดแอ็กชัน</h2>${selected.length > 0 ? `<p class="muted small">${selected.map((s) => s.name).join(", ")} และการ์ดใช้ร่วมกัน (${totalCompat} ใบ)</p>` : ""}</div><span class="badge count-badge ${actionCount === 40 ? "pill" : "danger"}">${actionCount} / 40 ใบ</span></div><div class="toolbar" style="margin:0 0 16px 0"><input class="search" id="actionSearch" aria-label="ค้นหาการ์ดแอ็กชัน" placeholder="ค้นหาชื่อการ์ด ความสามารถ หรือรหัส..." value="${esc(actionQuery)}"><select id="actionColor" aria-label="กรองสีการ์ด"><option value="" ${actionColor === "" ? "selected" : ""}>ทุกสี</option><option value="สีแดง" ${actionColor === "สีแดง" ? "selected" : ""}>สีแดง</option><option value="สีเขียว" ${actionColor === "สีเขียว" ? "selected" : ""}>สีเขียว</option><option value="สีน้ำเงิน" ${actionColor === "สีน้ำเงิน" ? "selected" : ""}>สีน้ำเงิน</option></select><span class="badge" style="align-self:center">การ์ดที่เล่นได้: ${totalCompat} ใบ</span></div><div id="actionGrid" class="grid section-scroll">${renderActionCardsGrid()}</div></section>`;
}
function decksPage() {
  return `<div class="deck-builder-shell"><div class="row subnav" style="justify-content:space-between"><div class="row">${btn("preset1", "ใช้เด็คฝึก SD01")}${btn("preset2", "ใช้เด็คฝึก SD02")}${btn("new", "+ เริ่มเด็คใหม่")}${btn("savedModal", "📂 เด็คที่บันทึก (" + saved.length + ")")}</div><div class="row">${btn("import", "นำเข้าเด็ค")}${btn("export", "ส่งออกเด็ค")}<input id="importFile" type="file" accept="application/json,.json" hidden></div></div>${deckSummaryBar()}<div class="deck-builder-main"><div class="deck-builder-left">${section1Characters()}${section2CharacterCards()}</div><div class="deck-builder-right">${section3ActionCards()}</div></div></div>`;
}
function playLobby() {
  const valid = validateDeck(deck.entries, cards);
  const modeToggle = `<div class="row play-mode-toggle" role="tablist" aria-label="โหมดการเล่น"><button type="button" class="mode-tab ${playMode === "bot" ? "active" : ""}" data-do="playMode" data-mode="bot" role="tab" aria-selected="${playMode === "bot"}">🤖 เล่นกับบอท</button><button type="button" class="mode-tab ${playMode === "friend" ? "active" : ""}" data-do="playMode" data-mode="friend" role="tab" aria-selected="${playMode === "friend"}">👥 เล่นกับผู้เล่น</button></div>`;
  const botPanel = `<div class="bot-lobby"><p class="small muted">กฎพื้นฐานตามคู่มือ 12 ก.ย. 2026 · เด็คเริ่มต้นประมวลผลเอฟเฟกต์อัตโนมัติ · ชุดเสริมบางใบต้องจัดการเอฟเฟกต์ผ่านแผงยืนยัน</p><div class="row"><label>ระดับบอท <select id="botDifficulty"><option value="easy">ง่าย · สุ่มการ์ด</option><option value="normal" selected>ปกติ · เลือกตามพลัง</option></select></label><label>เด็คบอท <select id="botDeck"><option>SD02</option><option>SD01</option></select></label></div><div style="margin-top:16px">${btn("startBot", "เริ่มเล่นกับบอท", valid.valid ? "" : "disabled", "primary")}</div></div>`;
  const friendPanel = `<div class="friend-lobby"><p class="small muted">สร้างห้องแล้วส่งรหัสให้เพื่อน หรือใส่รหัสห้องที่ได้รับมาเพื่อเข้าร่วม</p>${btn("create", "สร้างห้อง", valid.valid ? "" : "disabled")}<hr style="width:100%;border:0;border-top:1px solid var(--line)"><label>รหัสห้องของเพื่อน<input id="roomCode" maxlength="8" value="${esc(new URLSearchParams(location.search).get("room") || "")}" placeholder="รหัส 8 ตัว (แยกตัวพิมพ์เล็ก/ใหญ่)" style="display:block;width:100%"></label>${btn("join", "เข้าห้องเพื่อน", valid.valid ? "" : "disabled")}</div>`;
  return `<div class="notice">ห้องใหม่ใช้กฎตามเฟส: จั่วอัตโนมัติ ชาร์จ อัปเลเวล เปิดแอ็กชันพร้อมกัน และคอมโบ · เอฟเฟกต์ชุดเสริมบางใบใช้แผงจัดการด้วยตนเอง</div><div class="split"><div class="panel"><h2>เริ่มดวล 1 ต่อ 1</h2>${modeToggle}<div class="stack"><label>ชื่อของคุณ (ไม่บังคับ)<input id="playerName" maxlength="32" placeholder="เว้นว่างได้ · ระบบจะตั้งชื่อ Guest ให้อัตโนมัติ" style="display:block;width:100%"></label><p>เด็คที่เลือก: <strong>${esc(deck.name)}</strong><br><span class="small ${valid.valid ? "pill" : "danger"}">${valid.valid ? "พร้อมเล่น · " + valid.actions + " แอ็กชัน" : esc(valid.errors.join(" · "))}</span></p>${deckPickerInline()}${playMode === "bot" ? botPanel : friendPanel}</div></div><aside class="panel"><h3>ลองสองคนได้อย่างไร</h3><p class="muted">เครื่องเดียว: เปิดเว็บในอีกเบราว์เซอร์ แล้วใส่รหัสห้อง</p><p class="muted">คนละเครื่อง: อยู่ Wi-Fi เดียวกัน เปิดที่อยู่ LAN ที่ปรากฏตอนเริ่มเดโม แล้วใส่รหัสห้องเดียวกัน</p><p class="small muted">การเล่นผ่านอินเทอร์เน็ตคนละเครือข่ายจะเพิ่มเมื่อโฮสต์จริง เก็บหน้าต่างเซิร์ฟเวอร์ไว้ระหว่างเล่น</p>${room ? btn("resume", "กลับเข้าห้องเดิม") : ""}</aside></div>`;
}
const zoneNames = {
  hand: "มือ",
  deck: "ใต้เด็ค",
  action: "แอ็กชัน",
  concerto: "คอนแชร์โต",
  trash: "กองทิ้ง",
};
function fieldUI(p, mine, live) {
  return `<div class="row">${p.field
    .map((code) => {
      const c = card(code);
      return `<div style="text-align:center"><button class="art-button" style="width:80px" data-detail="${code}">${img(c)}</button><div class="small">${esc(c.name)} Lv.${c.level}</div>${p.leader === code ? '<span class="badge pill">ผู้นำ</span>' : mine && live ? btn("leader", "เป็นผู้นำ", `data-code="${code}"`) : ""}</div>`;
    })
    .join("")}</div>`;
}
function zoneUI(p, zone, mine, live) {
  return `<div class="zone"><h3>${zoneNames[zone]} <span class="badge">${p[zone].length}</span></h3><div class="row">${p[zone].map((code, i) => `<button class="art-button" style="width:62px" ${mine && live ? `data-zone="${zone}" data-index="${i}"` : `data-detail="${code}"`} aria-label="${esc(card(code).name)}"><img class="mini" style="width:100%" src="${card(code).img}" alt="${esc(card(code).name)}"></button>`).join("")}</div></div>`;
}
function board() {
  if (room.rulesVersion)
    return rulesBoard(room, { card, esc, img, playmat, btn, selectedMulligan });
  const me = room.players[room.seat],
    op = room.players[1 - room.seat],
    bot = room.mode === "bot",
    waiting = room.status === "waiting",
    live = room.status === "playing",
    canPlace = live && (!bot || room.botPhase === "choose");
  return `<section class="battle-shell"><div class="battle-bar"><strong>${bot ? "ฝึกกับบอท" : "ห้อง " + room.code}</strong><span>${syncError ? "กำลังเชื่อมต่อใหม่…" : op ? esc(op.name) + " · มือ " + op.handCount + " · ไลฟ์ " + op.hp : "รอเพื่อนเข้าห้อง"}</span><div>${!bot ? btn("copy", "รหัสห้อง") : ""}${btn("battleInfo", "บันทึก / กติกา")}${btn("lobby", "ออกจากสนาม")}</div></div><div class="battle-half opponent-half">${opponentHand(op)}${op ? playmat(op, false, false) : '<div class="waiting-seat">รอเพื่อนเข้าห้อง · ' + room.code + "</div>"}</div><div class="battle-divider">${phaseTrack(room)}<strong>${waiting ? "เตรียมตัว" : room.status === "finished" ? (bot ? (room.winner === null ? "เสมอ" : room.winner === 0 ? "คุณชนะ" : "บอทชนะ") : "จบเกม") : bot ? room.turn + " / 40 รอบ" : "เทิร์น " + room.turn}</strong><span>${esc(me.name)} · ไลฟ์ ${me.hp}${bot ? " · พลังงาน " + me.energy + "/3" : ""}</span><div class="battle-actions">${waiting ? `${btn("mulligan", "เปลี่ยนไพ่ที่เลือก", me.ready || me.mulligan ? "disabled" : "")}${btn("ready", me.ready ? "พร้อมแล้ว" : "พร้อมเล่น", me.ready ? "disabled" : "", "primary")}` : live ? (bot ? (room.botPhase === "result" ? btn("nextRound", "รอบถัดไป →", "", "primary") : `${btn("resolveTable", "เปิดการ์ดและดวล", !(me.table || []).some((c) => c.zone === "action") ? "disabled" : "", "primary")}${btn("pass", "ผ่าน", (me.table || []).some((c) => c.zone === "action") ? "disabled" : "")}`) : `${btn("hpDown", "− ไลฟ์")}${btn("hpUp", "+ ไลฟ์")}${btn("end", "ส่งเทิร์น", room.active === room.seat ? "" : "disabled")}${btn("clear", "เก็บแอ็กชัน")}`) : ""}${live ? btn("surrender", "ยอมแพ้") : ""}</div>${canPlace ? `<div class="placement"><label><input type="radio" name="placement" value="up" ${placeFaceDown ? "" : "checked"}> หงาย</label><label><input type="radio" name="placement" value="down" ${placeFaceDown ? "checked" : ""}> คว่ำ</label></div>` : ""}${bot && room.lastDuel ? `<span class="round-result">${esc(room.lastDuel.reason)} · เสียหาย ${room.lastDuel.damage}</span>` : ""}</div><div class="battle-half">${playmat(me, true, canPlace)}</div><div class="hand-dock"><span class="hand-count">มือ ${me.handCount}</span><div class="hand">${me.hand.map((code, i) => `<article class="card" ${canPlace ? `data-hand-drag="${i}" data-code="${code}"` : ""}><button class="art-button" data-detail="${code}" aria-label="${esc(card(code).name)}">${img(card(code))}</button>${canPlace ? `<button data-place-hand="${i}" class="quick-place">วาง</button>` : waiting && !me.ready && !me.mulligan ? `<label><input type="checkbox" data-mulligan="${i}" ${selectedMulligan.has(i) ? "checked" : ""}> เปลี่ยน</label>` : ""}</article>`).join("")}</div></div></section>`;
}

let inLobby = false;
let playMode = "bot";
function guestName() {
  return "Guest-" + Math.floor(1000 + Math.random() * 9000);
}
function render() {
  saveDeckDraft();
  document.body.classList.toggle(
    "battle-view",
    tab === "play" && !!room && !inLobby,
  );
  document.body.classList.toggle("deck-view", tab === "decks");
  document
    .querySelectorAll("[data-tab]")
    .forEach((n) => n.classList.toggle("active", n.dataset.tab === tab));
  $(".heading h1").textContent =
    tab === "cards"
      ? "ทุกการ์ด เริ่มต้นการดวลของคุณ"
      : tab === "decks"
        ? "สร้างทีม จัดเด็ค พร้อมดวล"
        : "เลือกคู่ดวลของคุณ";
  $(".heading .muted").textContent =
    tab === "cards"
      ? "ค้นหาการ์ดจริง อ่านคำแปลไทย และสร้างเด็คในแบบของคุณ"
      : tab === "decks"
        ? "เลือกตัวละครที่เข้ากัน แล้วเติมแอ็กชันให้ครบ 40 ใบ"
        : "ฝึกกับบอทคนเดียว หรือเปิดโต๊ะเล่นกับเพื่อน";
  app.innerHTML =
    tab === "cards"
      ? catalog()
      : tab === "decks"
        ? decksPage()
        : room && !inLobby
          ? board()
          : playLobby();
  updateEffects(room, tab === "play" && !inLobby);
  updateBattleLog(room, tab === "play" && !inLobby);
}
function refreshDeck() {
  saveDeckDraft();
  if (tab === "decks") {
    const left = $(".deck-builder-left"),
      right = $(".deck-builder-right");
    if (left && right) {
      const scrolls = [
        ...document.querySelectorAll(".deck-builder-main .section-scroll"),
      ].map((el) => el.scrollTop);
      left.innerHTML = `${section1Characters()}${section2CharacterCards()}`;
      right.innerHTML = section3ActionCards();
      document
        .querySelectorAll(".deck-builder-main .section-scroll")
        .forEach((el, i) => (el.scrollTop = scrolls[i] || 0));
    }
    const summary = $("#deckSummary");
    if (summary) summary.outerHTML = deckSummaryBar();
  }
}
function detail(code, extra = "") {
  const c = card(code);
  if (!c) return;
  if (dialog.open) dialog.close();
  const panel = $("#card-info");
  panel.hidden = false;
  document.body.classList.add("has-card-info");
  const inDeck = deck.entries[code] || 0;
  const actionCount = Object.keys(deck.entries)
    .map((k) => card(k))
    .filter((item) => item && item.type === "action")
    .reduce((s, item) => s + (deck.entries[item.code] || 0), 0);
  const isMax =
    c.type === "character" ? inDeck >= 1 : inDeck >= 3 || actionCount >= 40;
  panel.innerHTML = `<div class="card-info-heading"><strong>รายละเอียดการ์ด</strong><button data-do="closeCardInfo" aria-label="ปิดรายละเอียดการ์ด">✕</button></div><div class="card-info-content"><div class="detail-grid"><img id="detailArt" src="${c.img}" alt="${esc(c.name)}"><div><p class="eyebrow">${c.code} · ${c.set}</p><h2>${esc(c.name)}</h2>${extra}<p class="muted">${esc(c.nameJp)}<br>${esc(c.nameEn)}</p><div class="row">${c.type === "character" ? `<span class="badge">Lv. ${c.level}</span><span class="badge">${esc(c.element)}</span><span class="badge">${esc(c.weapon)}</span>` : `<span class="badge">${c.color}</span><span class="badge">ค่าใช้ ${c.fee}</span><span class="badge">ความเร็ว ${c.speed || "—"}</span><span class="badge">ความเสียหาย ${c.damage || "0"}</span>`}</div><p class="small muted">${c.tags.map(esc).join(" · ")}</p><div class="effect">${formatCardText(c.effectTh)}</div><p class="small muted">คำแปลไทยไม่เป็นทางการ · ฉบับร่าง</p><details><summary>ข้อความญี่ปุ่นต้นฉบับ</summary><p class="effect">${formatCardText(c.info || "—")}</p></details><label class="small">ภาพเวอร์ชัน <select id="variant">${c.variants.map((v, i) => `<option value="${v.img}">${v.rarity} · ${esc(v.obtain)} · ${i + 1}</option>`).join("")}</select></label><div class="row" style="margin-top:20px">${c.type === "character" ? '<span class="lock-tag" title="ตัวละครถูกเลือกให้อัตโนมัติเป็นพรีเซ็ต จัดการได้ที่แท็บสร้างเด็ค">🔒 พรีเซ็ตตัวละคร</span>' : btn("add", "+ เพิ่มลงเด็ค", `data-code="${code}" ${isMax ? "disabled" : ""}`, "primary")}<a href="${c.source}" target="_blank" rel="noreferrer">ข้อมูลต้นฉบับ ↗</a></div></div></div></div>`;
  panel.querySelector(".card-info-content").scrollTop = 0;
}
function moveDialog(zone, index) {
  const code = room.players[room.seat][zone][index];
  detail(
    code,
    `<p class="muted">จาก ${zoneNames[zone]}</p><div class="row">${Object.entries(
      zoneNames,
    )
      .filter(([z]) => z !== zone)
      .map(([z, n]) =>
        btn(
          "move",
          n,
          `data-from="${zone}" data-to="${z}" data-index="${index}"`,
        ),
      )
      .join("")}</div>`,
  );
}
async function action(cmd) {
  if (busy) return;
  busy = true;
  if ((room.mode === "bot" || room.rulesVersion) && cmd.version === undefined)
    cmd.version = room.version;
  try {
    room = await api("/api/rooms/" + room.code, cmd, token);
    syncError = false;
    render();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
  }
}
function add(code, delta) {
  const c = card(code);
  if (!c) return;
  if (c.type === "character")
    return toast("การ์ดตัวละครเป็นพรีเซ็ตอัตโนมัติ ปรับได้เฉพาะการ์ดแอ็กชัน");
  if (delta > 0 && c.type === "action") {
    const actionCount = Object.keys(deck.entries)
      .map((k) => card(k))
      .filter((item) => item && item.type === "action")
      .reduce((s, item) => s + (deck.entries[item.code] || 0), 0);
    if (actionCount >= 40) return toast("การ์ดแอ็กชันครบ 40 ใบแล้ว");
  }
  const n = (deck.entries[code] || 0) + delta;
  if (n > (c.type === "character" ? 1 : 3))
    return toast(
      "รหัสนี้ใส่ได้สูงสุด " + (c.type === "character" ? 1 : 3) + " ใบ",
    );
  if (n <= 0) delete deck.entries[code];
  else deck.entries[code] = n;
  refreshDeck();
  if (delta > 0) toast("เพิ่ม " + c.name + " แล้ว");
}
function exportDeck() {
  const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "wuwa-thai-deck-v1",
            name: deck.name,
            entries: deck.entries,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "wuwa-deck.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button,a,[data-do]");
  if (!t) return;
  try {
    if (t.dataset.tab) {
      tab = t.dataset.tab;
      render();
      return;
    }
    if (t.dataset.detail) {
      detail(t.dataset.detail);
      return;
    }
    if (t.dataset.zone) {
      moveDialog(t.dataset.zone, Number(t.dataset.index));
      return;
    }
    const doIt = t.dataset.do;
    if (!doIt) return;
    e.preventDefault();
    if (doIt === "toggleChar") {
      toggleCharacter(t.dataset.char);
      return;
    }
    if (doIt === "warnIncompat") {
      toast(
        "การ์ดนี้ใช้ได้เฉพาะเมื่อมี " +
          (t.dataset.char || "ตัวละครที่ตรงกัน") +
          " ในเด็คตัวละคร",
      );
      return;
    }
    if (doIt === "savedModal") {
      dialog.innerHTML = savedDecksModalHTML();
      dialog.showModal();
      return;
    }
    if (doIt === "battleInfo") {
      dialog.innerHTML =
        btn("close", "ปิด", "", "close") +
        "<h2>ข้อมูลการดวล</h2><p>" +
        (room.mode === "bot"
          ? "โหมดฝึกกติกาย่อ · แดงชนะเขียว เขียวชนะน้ำเงิน น้ำเงินชนะแดง · สีเดียวกันตัดสินด้วยความเร็ว · จั่วเองเพิ่มได้ในช่วงเลือกการ์ด · ช่องซ้ายไม่มีผลเพิ่มพลัง"
          : "โต๊ะจำลอง · ผู้เล่นจัดการเอฟเฟกต์และค่าใช้เอง") +
        "</p>" +
        room.log
          .slice()
          .reverse()
          .map((x) => "<p>" + esc(x.text) + "</p>")
          .join("");
      dialog.showModal();
      return;
    }
    if (doIt === "showReserve") {
      const p = room.players[room.seat];
      dialog.innerHTML =
        btn("close", "ปิด", "", "close") +
        '<h2>เด็คตัวละคร</h2><div class="row">' +
        p.reserve
          .map(
            (code) =>
              "<div>" +
              tile(card(code), false) +
              (room.mode !== "bot" && room.status === "playing"
                ? btn("level", "เปลี่ยนเลเวล", 'data-code="' + code + '"')
                : "") +
              "</div>",
          )
          .join("") +
        "</div>";
      dialog.showModal();
      return;
    }
    if (doIt === "closeCardInfo") {
      $("#card-info").hidden = true;
      document.body.classList.remove("has-card-info");
      return;
    }
    if (doIt === "close") {
      dialog.close();
      return;
    }
    if (doIt === "add" || doIt === "remove") {
      add(t.dataset.code, doIt === "add" ? 1 : -1);
      return;
    }
    if (doIt === "prev" || doIt === "next") {
      page += doIt === "next" ? 1 : -1;
      $("#results").innerHTML = results();
      $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (doIt === "preset1" || doIt === "preset2") {
      deck = presetDeck(doIt === "preset1" ? "SD01" : "SD02", cards);
      render();
      toast("โหลดเด็คฝึกแล้ว");
      return;
    }
    if (doIt === "new") {
      if (
        Object.keys(deck.entries).length &&
        !confirm("เริ่มเด็คใหม่? การแก้ไขที่ยังไม่บันทึกจะหายไป")
      )
        return;
      deck = { name: "เด็คของฉัน", entries: {} };
      render();
      return;
    }
    if (doIt === "save") {
      const nextDeck={...structuredClone(deck),id:deck.id||crypto.randomUUID()};
      const nextSaved=saved.filter(d=>d.id!==nextDeck.id).concat(nextDeck);
      try{writeDeckStore(nextSaved,nextDeck)}catch{toast('บันทึกไม่ได้ กรุณาส่งออกเด็คเก็บไว้');return}
      deck=nextDeck;saved=nextSaved;
      if (tab === "decks") render();
      toast("บันทึกเด็คในเบราว์เซอร์นี้แล้ว");
      return;
    }
    if (doIt === "selectPreset") {
      deck = presetDeck(t.dataset.preset, cards);
      render();
      toast("โหลดเด็คฝึก " + t.dataset.preset + " แล้ว");
      return;
    }
    if (doIt === "selectSaved") {
      const d = saved.find((x) => x.id === t.dataset.id);
      if (!d) return;
      deck = structuredClone(d);
      if (dialog.open) dialog.close();
      if (tab === "play") inLobby = true;
      render();
      toast("เปิดเด็ค " + d.name + " แล้ว");
      return;
    }
    if (doIt === "editDeck") {
      const d = saved.find((x) => x.id === t.dataset.id);
      if (!d) return;
      deck = structuredClone(d);
      tab = "decks";
      if (dialog.open) dialog.close();
      render();
      toast("เปิดเด็ค " + d.name + " เพื่อแก้ไข");
      return;
    }
    if (doIt === "delDeck") {
      const d = saved.find((x) => x.id === t.dataset.id);
      if (!d) return;
      if (!confirm('ลบเด็ค "' + d.name + '" ? การลบไม่สามารถย้อนกลับได้')) return;
      t.disabled = true;
      try {
        deleteLocalDeck(d.id);
        if (dialog.open) dialog.innerHTML = savedDecksModalHTML();
        render();
        toast("ลบเด็คแล้ว");
      } catch {
        toast("ลบเด็คไม่สำเร็จ — เบราว์เซอร์ไม่อนุญาตให้บันทึกข้อมูล");
      } finally {
        t.disabled = false;
      }
      return;
    }
    if (doIt === "export") {
      exportDeck();
      return;
    }
    if (doIt === "import") {
      $("#importFile").click();
      return;
    }
    if (doIt === "sources") {
      dialog.innerHTML = `${btn("close", "✕", "", "close")}<h2>ขอบเขตข้อมูล</h2><p>รวบรวมจาก UCP วันที่ ${meta.date}: ${meta.records} รายการภาพ / ${cards.length} รหัสการ์ด</p><p>SD01 23 รหัส · SD02 23 รหัส · BP01 77 รหัส</p><p>${esc(meta.scope)}</p><p>${esc(meta.translation)}</p><p>เลขรหัสซ้ำรวมเป็นการ์ดเดียวสำหรับจัดเด็ค เลือกภาพลายอื่นได้ในรายละเอียด</p><a href="${meta.source}" target="_blank" rel="noreferrer">เว็บไซต์ทางการ ↗</a>`;
      dialog.showModal();
      return;
    }
    if (doIt === "playMode") {
      playMode = t.dataset.mode;
      render();
      return;
    }
    if (doIt === "startBot") {
      const name = $("#playerName").value.trim() || guestName();
      t.disabled = true;
      try {
        const result = await api("/api/rooms/bot", {
          name,
          entries: deck.entries,
          difficulty: $("#botDifficulty").value,
          botDeck: $("#botDeck").value,
        });
        room = result.room;
        token = result.token;
        selectedMulligan.clear();
        sessionStorage.setItem(
          "wuwa-room",
          JSON.stringify({ code: room.code, token }),
        );
        inLobby = false;
        render();
      } finally {
        t.disabled = false;
      }
      return;
    }
    if (doIt === "nextRound" || doIt === "pass" || doIt === "resolveTable") {
      await action({ type: doIt });
      return;
    }
    if (doIt === "create" || doIt === "join") {
      const name = $("#playerName").value.trim() || guestName();
      t.disabled = true;
      try {
        const result = await api("/api/rooms/" + doIt, {
          name,
          entries: deck.entries,
          ...(doIt === "join" ? { code: $("#roomCode").value.trim() } : {}),
        });
        room = result.room;
        token = result.token;
        sessionStorage.setItem(
          "wuwa-room",
          JSON.stringify({ code: room.code, token }),
        );
        inLobby = false;
        render();
      } finally {
        t.disabled = false;
      }
      return;
    }
    if (doIt === "copy") {
      try {
        await navigator.clipboard.writeText(room.code);
        toast("คัดลอกรหัสห้องแล้ว");
      } catch {
        toast("รหัสห้อง: " + room.code);
      }
      return;
    }
    if (doIt === "lobby") {
      inLobby = true;
      render();
      return;
    }
    if (doIt === "resume") {
      inLobby = false;
      render();
      return;
    }
    if (doIt === "reserve") {
      const p = room.players[room.seat];
      dialog.innerHTML = `${btn("close", "✕", "", "close")}<h2>เลือกเลเวลตัวละคร</h2><p class="muted">เปลี่ยนเมื่อกฎหรือเอฟเฟกต์อนุญาต ระบบไม่คิดค่าใช้ให้</p><div class="grid">${p.reserve.map((code) => `<div>${tile(card(code), false)}${btn("level", "ใช้เลเวลนี้", `data-code="${code}"`)}</div>`).join("")}</div>`;
      dialog.showModal();
      return;
    }
    if (doIt === "surrender" && !confirm("ยืนยันยอมแพ้และจบเกมนี้?")) return;
    if (doIt === "move") {
      await action({
        type: "move",
        from: t.dataset.from,
        to: t.dataset.to,
        index: Number(t.dataset.index),
      });
      dialog.close();
      return;
    }
    if (doIt === "level") {
      await action({ type: "level", code: t.dataset.code });
      dialog.close();
      return;
    }
    const commands = {
      draw: { type: "draw" },
      shuffle: { type: "shuffle" },
      hpUp: { type: "hp", delta: 1 },
      hpDown: { type: "hp", delta: -1 },
      ready: { type: "ready" },
      mulligan: { type: "mulligan", indices: [...selectedMulligan] },
      commit: { type: "commit", index: Number(t.dataset.index) },
      cancel: { type: "cancel" },
      leader: { type: "leader", code: t.dataset.code },
      reveal: { type: "reveal" },
      end: { type: "end" },
      clear: { type: "clear" },
      surrender: { type: "surrender" },
      topConcerto: { type: "move", from: "deck", to: "concerto", index: 0 },
      topTrash: { type: "move", from: "deck", to: "trash", index: 0 },
    };
    if (commands[doIt]) {
      await action(commands[doIt]);
      if (doIt === "mulligan") selectedMulligan.clear();
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    query = e.target.value;
    page = 1;
    $("#results").innerHTML = results();
  }
  if (e.target.id === "deckName") {deck.name = e.target.value;saveDeckDraft();}
  if (e.target.id === "actionSearch") {
    actionQuery = e.target.value;
    const g = $("#actionGrid");
    if (g) g.innerHTML = renderActionCardsGrid();
  }
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.id === "actionColor") {
    actionColor = t.value;
    const g = $("#actionGrid");
    if (g) g.innerHTML = renderActionCardsGrid();
  }
  if (["set", "kind", "character"].includes(t.id)) {
    if (t.id === "set") set = t.value;
    if (t.id === "kind") kind = t.value;
    if (t.id === "character") character = t.value;
    page = 1;
    $("#results").innerHTML = results();
  }
  if (t.id === "variant") $("#detailArt").src = t.value;
  if (t.dataset.mulligan !== undefined) {
    const i = Number(t.dataset.mulligan);
    if (t.checked) selectedMulligan.add(i);
    else selectedMulligan.delete(i);
  }
  if (t.id === "importFile") {
    try {
      if (t.files[0].size > 50000) throw Error("ไฟล์ใหญ่เกินไป");
      const d = JSON.parse(await t.files[0].text());
      if (
        typeof d.name !== "string" ||
        d.name.length > 80 ||
        !d.entries ||
        typeof d.entries !== "object" ||
        Array.isArray(d.entries)
      )
        throw Error("รูปแบบเด็คไม่ถูกต้อง");
      for (const [code, n] of Object.entries(d.entries)) {
        const c = card(code);
        if (
          !c ||
          !Number.isInteger(n) ||
          n < 1 ||
          n > (c.type === "character" ? 1 : 3)
        )
          throw Error("รหัสหรือจำนวนการ์ดไม่ถูกต้อง");
      }
      deck = { name: d.name, entries: d.entries };
      render();
      toast("นำเข้าเด็คแล้ว กดบันทึกเพื่อเก็บไว้");
    } catch (err) {
      toast(err.message);
    }
  }
});
try {
  [cards, meta, saved] = await Promise.all([
    api("/cards.json"),
    api("/catalog-meta.json"),
    api("/api/decks").catch(()=>[]),
  ]);
  restoreDeckStore(saved);
  const last = sessionStorage.getItem("wuwa-room");
  if (last) {
    try {
      const s = JSON.parse(last);
      token = s.token;
      room = await api("/api/rooms/" + s.code, undefined, token);
    } catch {
      sessionStorage.removeItem("wuwa-room");
    }
  }
  if (new URLSearchParams(location.search).has("room")) tab = "play";
  render();
} catch (e) {
  app.innerHTML = `<div class="notice">โหลดเดโมไม่สำเร็จ: ${esc(e.message)} · เปิดผ่าน START-DEMO.cmd แล้วลองใหม่</div>`;
}
setInterval(async () => {
  if (!room || busy || tableDrag) return;
  try {
    const next = await api("/api/rooms/" + room.code, undefined, token);
    if (tableDrag) return;
    const changed = next.version !== room.version || syncError;
    room = next;
    syncError = false;
    if (changed && tab === "play" && !inLobby) render();
  } catch {
    if (!syncError) {
      syncError = true;
      if (tab === "play" && !inLobby) render();
    }
  }
}, 1000);
if (document.modelContext?.registerTool) {
  try {
    document.modelContext.registerTool({
      name: "search_wuwa_cards",
      description:
        "Search the loaded WuWa card catalog and display matching cards.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute(input) {
        if (typeof input?.query !== "string")
          throw Error("query must be a string");
        query = input.query;
        set = "";
        kind = "";
        character = "";
        page = 1;
        tab = "cards";
        render();
        return filtered().map((c) => ({
          code: c.code,
          name: c.name,
          effect: c.effectTh,
        }));
      },
    });
  } catch {}
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !dialog.open) {
    $("#card-info").hidden = true;
    document.body.classList.remove("has-card-info");
  }
});