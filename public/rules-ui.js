import { formatCardText } from "./card-text.js";
import { phaseTrack } from "./phase-track.js";
let ui;
const phaseNames = {
  waiting: "รอเพื่อน",
  order: "เลือกก่อน / หลัง",
  setup: "จัดมือเริ่มต้น",
  start: "เริ่มเทิร์น",
  draw: "Draw · จั่วการ์ด",
  action: "Main · เตรียมตัว",
  battle: "Battle · ลงแอ็กชัน",
  defense: "รอฝ่ายรับตอบโต้",
  reveal: "เปิดการ์ด",
  judgment: "ตัดสิน",
  combo: "คอมโบ",
  comboEffects: "เอฟเฟกต์คอมโบ",
  end: "จบเทิร์น",
  result: "ผลการประลอง",
  finished: "จบเกม",
};
export function rulesBoard(
  r,
  { card, esc, img, playmat, btn, selectedMulligan },
) {
  const me = r.players[r.seat],
    op = r.players[1 - r.seat],
    mine = r.active === r.seat,
    playing = r.status === "playing",
    staged = me.table.find((c) => c.zone === "action" && c.faceDown),
    free = !r.choice;
  const main = playing && free && r.phase === "action" && mine,
    action = playing && free && r.phase === "battle" && mine,
    defense = playing && free && r.phase === "defense" && !mine,
    combo = playing && free && r.phase === "combo" && r.comboSeat === r.seat,
    setup = r.phase === "setup" && r.setupSeat === r.seat;
  let controls = "";
  if (r.phase === "order" && r.orderWinner === r.seat)
    controls =
      '<button data-rule="orderFirst">เล่นก่อน</button><button data-rule="orderSecond">เล่นหลัง</button>';
  if (setup)
    controls =
      btn("mulligan", "เปลี่ยนไพ่ที่เลือก", me.mulligan ? "disabled" : "") +
      btn("ready", "ยืนยันมือ / พร้อม", "", "primary");
  if (playing && free && mine && r.phase === "draw")
    controls = btn(
      "draw",
      "จั่วการ์ด " + (r.turn === 1 ? 1 : 2) + " ใบ",
      "",
      "primary",
    );
  if (main)
    controls =
      '<button data-rule="beginBattle" class="primary">เข้า Battle →</button>';
  if (action || defense)
    controls = `<button data-rule="confirm" ${staged ? "" : "disabled"}>ยืนยันแอ็กชัน</button>${btn("pass", action ? "ข้ามประลอง" : "ไม่ตอบโต้", staged ? "disabled" : "")}`;
  if (combo) controls = btn("end", "จบคอมโบ");
  if (r.phase === "result" && (mine || r.players[r.active].isBot))
    controls = btn("end", "จบเทิร์น →", "", "primary");
  if (r.choice)
    controls = r.choice.canAnswer
      ? '<button data-rule="choice" class="primary">จัดการเอฟเฟกต์ / เลือกการ์ด</button>'
      : "<span>รอ " +
        esc(r.players[r.choice.seat].name) +
        " จัดการเอฟเฟกต์</span>";
  const isBotTurn = !mine && op?.isBot;
  const hint =
    r.phase === "draw"
      ? mine
        ? "กดจั่วการ์ดเพื่อเข้าสู่ Main"
        : isBotTurn
          ? "🤖 บอทกำลังจั่วการ์ด…"
          : "รออีกฝ่ายจั่วการ์ด"
      : r.phase === "order"
        ? esc(r.players[r.orderWinner].name) + " ชนะการสุ่ม เลือกก่อน/หลัง"
        : r.phase === "setup"
          ? "รอ " +
            esc(r.players[r.setupSeat].name) +
            " · มัลลิแกนได้กี่ใบก็ได้ 1 ครั้ง"
          : main
            ? "จ่ายคอนแชร์โตอัตโนมัติ · ชาร์จ " +
              (me.used?.charge ? "✓" : "0/1") +
              " · เปลี่ยนผู้นำ " +
              (me.used?.switch ? "✓" : "0/1") +
              " · อัปเลเวล " +
              (me.used?.level ? "✓" : "0/1")
            : r.phase === "action" && isBotTurn
              ? "🤖 บอทกำลังเตรียมตัว (ชาร์จคอนแชร์โต / อัปเลเวล)…"
              : r.phase === "battle" && isBotTurn
                ? "🤖 บอทกำลังเลือกการ์ดลงประลอง…"
                : combo
                  ? "สีแดงเท่านั้น · คอมโบเหลือ " +
                    (r.comboLeft < 0 ? "ไม่จำกัด" : r.comboLeft)
                  : r.phase === "combo" && isBotTurn
                    ? "🤖 บอทกำลังทำคอมโบ…"
                    : defense
                      ? "ลงแอ็กชันคว่ำ 1 ใบ หรือไม่ตอบโต้"
                      : r.phase === "defense" && isBotTurn
                        ? "🤖 บอทกำลังเลือกการ์ดตอบโต้…"
                        : r.phase === "result"
                          ? (isBotTurn ? "สรุปผลการประลอง · บอทกำลังส่งเทิร์น…" : "สรุปผลการประลอง · 👉 กด [จบเทิร์น →] เพื่อส่งเทิร์นให้บอท")
                          : "";
  return `<section class="battle-shell"><div class="battle-bar"><strong>${r.mode === "bot" ? "บอท · กฎตามเฟส" : "ห้อง " + r.code}</strong><span>${op ? esc(op.name) + " · มือ " + op.handCount + " · ไลฟ์ " + op.hp : "รอเพื่อน"}</span><div>${r.mode === "bot" ? "" : btn("copy", "รหัสห้อง")}<button data-rule="info">กฎ / บันทึก</button>${btn("lobby", "ออกจากสนาม")}</div></div><div class="battle-half opponent-half">${opponentHand(op)}${op ? playmat(op, false, false) : '<div class="waiting-seat">ส่งรหัส ' + r.code + " ให้เพื่อน</div>"}</div><div class="battle-divider">${phaseTrack(r)}<strong>${phaseNames[r.phase] || r.phase} · เทิร์น ${r.turn}</strong><span>${esc(me.name)} · ไลฟ์ ${me.hp} · คอนแชร์โต ${me.table.filter((c) => c.zone === "concerto").length}</span><span>${r.status === "finished" ? (r.winner === null ? "เสมอ" : esc(r.players[r.winner].name) + " ชนะ") : esc(r.players[r.active]?.name || "") + " เป็นเจ้าของเทิร์น"}</span><div class="battle-actions">${controls}${playing ? btn("surrender", "ยอมแพ้") : ""}</div><span class="round-result">${hint}${r.lastDuel ? " · " + esc(r.lastDuel.reason) : ""}</span></div><div class="battle-half">${playmat(me, true, main || action || defense || combo)}</div><div class="hand-dock"><span class="hand-count">มือ ${me.handCount}</span><div class="hand">${me.hand.map((code, i) => `<article class="card ${(action || defense || combo) && actionUnavailable(r, code, card) ? "action-unavailable" : ""}" title="${esc(action || defense || combo ? actionUnavailable(r, code, card) : "")}" ${(main && !me.used?.charge) || action || defense ? `data-hand-drag="${i}" data-code="${code}"` : ""}><button class="art-button" data-detail="${code}" aria-label="${esc(card(code).name)}">${img(card(code))}</button>${main || action || defense ? `<button data-place-hand="${i}" ${main && me.used?.charge ? "disabled" : ""} class="quick-place">${main ? "ชาร์จ" : "วาง"}</button>` : combo ? `<button data-rule="combo" data-index="${i}" ${actionUnavailable(r, code, card) ? "disabled" : ""} class="quick-place">คอมโบ</button>` : setup && !me.mulligan ? `<label><input type="checkbox" data-mulligan="${i}" ${selectedMulligan.has(i) ? "checked" : ""}> เปลี่ยน</label>` : ""}</article>`).join("")}</div></div></section>`;
}
const button = (name, label, extra = "") =>
  `<button data-rule="${name}" ${extra}>${label}</button>`;
function modal(html) {
  ui.dialog.innerHTML = button("close", "ปิด", 'class="close"') + html;
  if (!ui.dialog.open) ui.dialog.showModal();
}
function checks(items, name) {
  return `<div class="rule-picks">${items.map((x) => `<label><input type="checkbox" name="${name}" value="${ui.esc(x.value)}">${x.code ? `<img src="${ui.card(x.code).img}" alt="${ui.esc(ui.card(x.code).name)}"><span>${ui.esc(ui.card(x.code).name)}</span>` : ui.esc(x.label)}</label>`).join("")}</div>`;
}
function selected(name) {
  return [...ui.dialog.querySelectorAll(`input[name="${name}"]:checked`)].map(
    (x) => x.value,
  );
}
export function showRuleCard(id, index) {
  const r = ui.getRoom(),
    p = r.players[r.seat];
  if (id) {
    const c = p.table.find((c) => c.id === id);
    ui.showCard(
      c.code,
      `<p>${c.zone === "concerto" ? "คอนแชร์โตต้องหงาย และใช้จ่ายค่าร่าย" : "แอ็กชันเปิดพร้อมกันหลังทั้งสองฝ่ายยืนยัน"}</p>${c.faceDown && !p.locked ? button("return", "เก็บกลับมือ", `data-id="${id}"`) : ""}`,
    );
  } else {
    modal(
      `<h2>ลง ${ui.esc(ui.card(p.hand[index]).name)}</h2><p>${r.phase === "action" ? "Main: ชาร์จคอนแชร์โตลงหงาย" : "Battle: ลงแอ็กชันคว่ำ"}</p>${r.phase === "action" ? "" : button("place", "แอ็กชันคว่ำ", `data-zone="action" data-index="${index}" ${actionUnavailable(r, p.hand[index], ui.card) ? "disabled" : ""}`)}${r.phase === "action" && r.active === r.seat && !p.used?.charge ? button("place", "ชาร์จคอนแชร์โต", `data-zone="concerto" data-index="${index}"`) : ""}`,
    );
  }
}
function choice() {
  const r = ui.getRoom(),
    q = r.choice;
  if (!q || !q.canAnswer) return;
  let content = `<h2>${ui.esc(q.label)}</h2>`;
  if (q.type === "manual") {
    content += `<p class="notice">เอฟเฟกต์นี้ยังไม่คำนวณอัตโนมัติ โปรดทำตามข้อความก่อนยืนยัน</p><p class="effect">${formatCardText(ui.card(q.source).effectTh)}</p><label>ฝ่ายที่ได้รับผล <select id="effectSeat">${r.players.map((p, i) => `<option value="${i}">${ui.esc(p.name)}</option>`).join("")}</select></label><label>การปรับ <select id="effectType"><option value="life">เพิ่ม/ลดไลฟ์</option><option value="draw">จั่ว</option><option value="charge">บนเด็ค → คอนแชร์โต</option><option value="pursuit">เพิ่ม/ลดจำนวนคอมโบ</option><option value="damageBonus">เพิ่ม/ลดพลังโจมตี</option><option value="speedBonus">เพิ่ม/ลดความเร็ว</option><option value="costBonus">เพิ่ม/ลดค่าร่ายเทิร์นนี้</option><option value="noCombo">ห้ามคอมโบ (0 เทิร์นนี้ / 1 เทิร์นหน้า)</option></select></label><input id="effectN" type="number" min="-20" max="20" value="1" aria-label="จำนวนเอฟเฟกต์">${button("adjust", "ปรับตามเอฟเฟกต์")}${q.seat === r.seat ? button("manualCards", "จัดการการ์ดตามเอฟเฟกต์") : ""}`;
  }
  if (q.type === "discard")
    content +=
      checks(q.options, "effectDiscard") +
      button("answerDiscard", "ยืนยันทิ้ง " + q.count + " ใบ");
  else
    content += `<div class="row">${q.options.map((x) => button("answer", x.label || ui.card(x.code).name, `data-value="${ui.esc(x.value)}"`)).join("")}</div>`;
  modal(content);
}
export function setupRulesUI(value) {
  ui = value;
  document.addEventListener(
    "click",
    async (e) => {
      const t = e.target.closest("[data-rule]");
      if (!t) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const r = ui.getRoom();
      if (!r?.rulesVersion) return;
      const p = r.players[r.seat],
        d = t.dataset;
      let cmd;
      switch (d.rule) {
        case "beginBattle":
          cmd = { type: "beginBattle" };
          break;
        case "close":
          ui.dialog.close();
          return;
        case "orderFirst":
        case "orderSecond":
          cmd = { type: "chooseOrder", first: d.rule === "orderFirst" };
          break;
        case "place":
          cmd = {
            type: "tablePlace",
            index: Number(d.index),
            code: p.hand[Number(d.index)],
            zone: d.zone,
            x: 0.4,
            y: 0.5,
            faceDown: d.zone === "action",
          };
          break;
        case "return":
          cmd = { type: "tableTake", id: d.id, to: "hand" };
          break;
        case "confirm":
          cmd = { type: "resolveTable" };
          break;
        case "combo":
          cmd = { type: "combo", index: Number(d.index) };
          break;
        case "commitPay":
          cmd = { type: "resolveTable", payment: selected("payment") };
          break;
        case "comboPay":
          cmd = {
            type: "combo",
            index: Number(d.index),
            payment: selected("payment"),
          };
          break;
        case "reserve": {
          modal(
            `<h2>เด็คตัวละคร</h2><p>อัปได้เลเวลเดิมหรือ +1 · ทิ้งการ์ดตามเลเวลปลายทาง</p><div class="rule-picks">${p.reserve.map((code) => `<div><button data-detail="${code}"><img src="${ui.card(code).img}" alt="${ui.esc(ui.card(code).name)}"></button><span>${ui.esc(ui.card(code).name)} Lv.${ui.card(code).level}</span>${canUpgradeCard(r, code, ui.card) ? button("levelPick", "อัปเลเวล", `data-code="${code}"`) : ""}</div>`).join("")}</div>`,
          );
          return;
        }
        case "levelPick":
          if (!canUpgradeCard(r, d.code, ui.card)) return;
          modal(
            `<h2>อัป ${ui.esc(ui.card(d.code).name)} Lv.${ui.card(d.code).level}</h2><p>เลือกทิ้ง ${ui.card(d.code).level} ใบ</p>${checks(
              p.hand.map((code, i) => ({ value: String(i), code })),
              "levelDiscard",
            )}${button("levelPay", "ยืนยันอัปเลเวล", `data-code="${d.code}"`)}`,
          );
          return;
        case "levelPay":
          cmd = {
            type: "level",
            code: d.code,
            indices: selected("levelDiscard").map(Number),
          };
          break;
        case "choice":
          choice();
          return;
        case "answer":
          cmd = { type: "answer", id: r.choice.id, value: d.value };
          break;
        case "answerDiscard":
          cmd = {
            type: "answer",
            id: r.choice.id,
            indices: selected("effectDiscard").map(Number),
          };
          break;
        case "manualCards":
          modal(
            "<h2>จัดการการ์ดตามเอฟเฟกต์</h2><p>ใช้เฉพาะสิ่งที่ข้อความการ์ดระบุ</p>" +
              ["hand", "trash"]
                .map(
                  (zone) =>
                    "<h3>" +
                    (zone === "hand" ? "มือ" : "กองทิ้ง") +
                    '</h3><div class="rule-picks">' +
                    p[zone]
                      .map(
                        (code, i) =>
                          '<div><img src="' +
                          ui.card(code).img +
                          '" alt="' +
                          ui.esc(ui.card(code).name) +
                          '">' +
                          ["hand", "trash", "concerto", "deck"]
                            .filter((to) => to !== zone)
                            .map((to) =>
                              button(
                                "manualMove",
                                {
                                  hand: "ขึ้นมือ",
                                  trash: "ทิ้ง",
                                  concerto: "คอนแชร์โต",
                                  deck: "ใต้เด็ค",
                                }[to],
                                'data-from="' +
                                  zone +
                                  '" data-to="' +
                                  to +
                                  '" data-index="' +
                                  i +
                                  '"',
                              ),
                            )
                            .join("") +
                          "</div>",
                      )
                      .join("") +
                    "</div>",
                )
                .join("") +
              "<h3>ผู้นำ</h3>" +
              p.field
                .filter((code) => code !== p.leader)
                .map((code) =>
                  button(
                    "manualSwitch",
                    ui.card(code).name,
                    'data-code="' + code + '"',
                  ),
                )
                .join("") +
              "<h3>อัปเลเวลจากเอฟเฟกต์</h3>" +
              p.reserve
                .map((code) =>
                  button(
                    "manualLevel",
                    ui.card(code).name + " Lv." + ui.card(code).level,
                    'data-code="' + code + '"',
                  ),
                )
                .join(""),
          );
          return;
        case "manualMove":
          cmd = {
            type: "answer",
            id: r.choice.id,
            actor: r.seat,
            operation: {
              type: "move",
              from: d.from,
              to: d.to,
              index: Number(d.index),
            },
          };
          break;
        case "manualSwitch":
        case "manualLevel":
          cmd = {
            type: "answer",
            id: r.choice.id,
            actor: r.seat,
            operation: {
              type: d.rule === "manualSwitch" ? "switch" : "level",
              code: d.code,
            },
          };
          break;
        case "adjust":
          cmd = {
            type: "answer",
            id: r.choice.id,
            adjust: {
              seat: Number(ui.dialog.querySelector("#effectSeat").value),
              type: ui.dialog.querySelector("#effectType").value,
              n: Number(ui.dialog.querySelector("#effectN").value),
            },
          };
          break;
        case "info":
          modal(
            `<h2>กฎที่ใช้ในห้องนี้</h2><p>${ui.esc(r.ruleNotice)}</p><p>มือเริ่มต้น 5 · มัลลิแกนได้กี่ใบก็ได้ 1 ครั้ง · เทิร์นแรกจั่ว 1 หลังจากนั้นเจ้าของเทิร์นจั่ว 2 · ฟ้าชนฟ้าเสมอ · ชนะสีแดงคอมโบได้ไม่จำกัด · เด็คหมดรีเฟรชจากกองทิ้ง · จบเทิร์นเจ้าของเทิร์นทิ้งจนเหลือ 8</p><a href="https://wwcg.ucp-jp.com/jp/rules" target="_blank" rel="noreferrer">คู่มือทางการ 12 กันยายน 2026</a>${p.flags?.peek ? `<h3>มือฝ่ายตรงข้าม (จากเอฟเฟกต์)</h3><p>${r.players[1 - r.seat].hand.map((code) => ui.esc(ui.card(code).name)).join(" · ")}</p>` : ""}<h3>บันทึก</h3>${r.log
              .slice()
              .reverse()
              .map((x) => `<p>${ui.esc(x.text)}</p>`)
              .join("")}`,
          );
          return;
      }
      if (cmd) {
        ui.dialog.close();
        await ui.send({ ...cmd, version: r.version });
      }
    },
    true,
  );
}

export function opponentHand(player) {
  if (!player) return "";
  const count = Math.max(0, Number(player.handCount) || 0);
  return (
    '<div class="opponent-hand" aria-label="มือฝ่ายตรงข้าม ' +
    count +
    ' ใบ"><strong>มือฝ่ายตรงข้าม <span>' +
    count +
    ' ใบ</span></strong><div class="opponent-hand-cards" aria-hidden="true" style="--hand-count:' +
    Math.max(1, count) +
    '">' +
    Array.from(
      { length: count },
      () => '<span class="opponent-hand-back"></span>',
    ).join("") +
    "</div></div>"
  );
}

export function actionUnavailable(r, code, card) {
  const p = r.players[r.seat],
    c = card(code),
    combo = r.phase === "combo";
  if (!c || c.type !== "action") return "";
  if (
    r.status !== "playing" ||
    r.choice ||
    !(
      (r.phase === "battle" && r.active === r.seat) ||
      (r.phase === "defense" && r.active !== r.seat) ||
      (combo && r.comboSeat === r.seat)
    )
  )
    return "ยังไม่ถึงช่วงใช้แอ็กชันของคุณ";
  if (
    !combo &&
    (p.locked || p.table.some((x) => x.zone === "action" && x.faceDown))
  )
    return "มีแอ็กชันที่ลงไว้แล้ว";
  if (
    combo &&
    (c.color !== "แดง" || r.comboLeft === 0 || p.flags?.noComboTurn === r.turn)
  )
    return "ไม่สามารถใช้เป็นคอมโบได้";
  const cost = Math.max(
    0,
    Number(c.fee) +
      (p.flags?.costBonus || 0) +
      (c.color === "แดง" && p.flags?.redTaxTurn === r.turn ? 1 : 0) -
      (code === "BP01-062" && r.previousWinner === r.seat ? 1 : 0),
  );
  if (cost > p.table.filter((x) => x.zone === "concerto").length)
    return "คอนแชร์โตไม่พอ · ต้องใช้ " + cost;
  if (
    c.info.includes("【リーダースキル】") &&
    card(p.leader)?.character !== c.character
  )
    return "ผู้นำไม่ตรงเงื่อนไข";
  if (
    (c.feature_name || "").includes("音骸") &&
    p.table.some(
      (x) =>
        x.zone === "action" &&
        !x.faceDown &&
        (card(x.code)?.feature_name || "").includes("音骸"),
    )
  )
    return "ใช้ Echo ไปแล้วในเฟสนี้";
  return "";
}

export function canUpgradeCard(r, code, card) {
  const p = r.players[r.seat],
    target = card(code);
  if (
    r.status !== "playing" ||
    r.choice ||
    r.phase !== "action" ||
    r.active !== r.seat ||
    p.used?.level ||
    !p.reserve.includes(code) ||
    !target ||
    code === "BP01-011"
  )
    return false;
  const old = p.field.map(card).find((c) => c?.character === target.character);
  if (!old) return false;
  const level = Number(target.level),
    current = Number(old.level);
  return (level === current || level === current + 1) && p.hand.length >= level;
}
