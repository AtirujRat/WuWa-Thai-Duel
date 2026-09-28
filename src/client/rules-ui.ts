import { phaseTrack } from "./phase-track.ts";
import type { Card } from "../types/card.ts";
import type { GameCommand, PublicPlayer, PublicRoom } from "../types/game.ts";

export interface RulesUIContext {
  dialog: HTMLDialogElement;
  esc: (text: string | null | undefined) => string;
  card: (code: string) => Card;
  getRoom: () => PublicRoom;
  showCard: (code: string, extra?: string) => void;
  send: (cmd: GameCommand) => Promise<unknown>;
}

let ui: RulesUIContext;

const phaseNames: Record<string, string> = {
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

export interface RulesBoardOptions {
  card: (code: string) => Card;
  esc: (text: string | null | undefined) => string;
  img: (c: Card) => string;
  playmat: (p: PublicPlayer, mine: boolean, live: boolean) => string;
  btn: (name: string, label: string, extra?: string, kind?: string) => string;
  selectedMulligan: Set<number>;
}

export function rulesBoard(
  r: PublicRoom,
  { card, esc, img, playmat, btn, selectedMulligan }: RulesBoardOptions,
): string {
  const me = r.players[r.seat];
  const op = r.players[1 - r.seat];
  const mine = r.active === r.seat;
  const playing = r.status === "playing";
  const staged = me.table.find((c) => c.zone === "action" && c.faceDown);
  const free = !r.choice;

  const main = playing && free && r.phase === "action" && mine;
  const action = playing && free && r.phase === "battle" && mine;
  const defense = playing && free && r.phase === "defense" && !mine;
  const combo = playing && free && r.phase === "combo" && r.comboSeat === r.seat;
  const setup = r.phase === "setup" && r.setupSeat === r.seat;

  let controls = "";
  if (r.phase === "order" && r.orderWinner === r.seat)
    controls =
      '<button data-rule="orderFirst">เล่นก่อน</button><button data-rule="orderSecond">เล่นหลัง</button>';
  if (setup)
    controls =
      btn("mulligan", "เปลี่ยนไพ่ที่เลือก", me.mulligan ? "disabled" : "") +
      btn("ready", "ยืนยันมือ / พร้อม", "", "primary");
  if (playing && free && mine && r.phase === "draw")
    controls = btn("draw", "จั่วการ์ด " + (r.turn === 1 ? 1 : 2) + " ใบ", "", "primary");
  if (main) controls = '<button data-rule="beginBattle" class="primary">เข้า Battle →</button>';
  if (action || defense)
    controls = `<button data-rule="confirm" ${staged ? "" : "disabled"}>ยืนยันแอ็กชัน</button>${btn("pass", action ? "ข้ามประลอง" : "ไม่ตอบโต้", staged ? "disabled" : "")}`;
  if (combo) controls = btn("end", "จบคอมโบ");
  if (r.phase === "result" && (mine || r.players[r.active]?.isBot))
    controls = btn("end", "จบเทิร์น →", "", "primary");
  if (r.choice)
    controls = r.choice.canAnswer
      ? '<button data-rule="choice" class="primary">จัดการเอฟเฟกต์ / เลือกการ์ด</button>'
      : "<span>รอ " + esc(r.players[r.choice.seat]?.name) + " จัดการเอฟเฟกต์</span>";

  const isBotTurn = !mine && op?.isBot;
  const hint =
    r.phase === "draw"
      ? mine
        ? "กดจั่วการ์ดเพื่อเข้าสู่ Main"
        : isBotTurn
          ? "🤖 บอทกำลังจั่วการ์ด…"
          : "รออีกฝ่ายจั่วการ์ด"
      : r.phase === "order"
        ? esc(r.players[r.orderWinner ?? 0]?.name) + " ชนะการสุ่ม เลือกก่อน/หลัง"
        : r.phase === "setup"
          ? "รอ " + esc(r.players[r.setupSeat ?? 0]?.name) + " · มัลลิแกนได้กี่ใบก็ได้ 1 ครั้ง"
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
                    ((r.comboLeft ?? 0) < 0 ? "ไม่จำกัด" : r.comboLeft)
                  : r.phase === "combo" && isBotTurn
                    ? "🤖 บอทกำลังทำคอมโบ…"
                    : defense
                      ? "ลงแอ็กชันคว่ำ 1 ใบ หรือไม่ตอบโต้"
                      : r.phase === "defense" && isBotTurn
                        ? "🤖 บอทกำลังเลือกการ์ดตอบโต้…"
                        : r.phase === "result"
                          ? isBotTurn
                            ? "สรุปผลการประลอง · บอทกำลังส่งเทิร์น…"
                            : "สรุปผลการประลอง · 👉 กด [จบเทิร์น →] เพื่อส่งเทิร์นให้บอท"
                          : "";

  return `<section class="battle-shell life-rail-layout">${op ? lifeBadge(op.name, op.hp, false) : ""}${lifeBadge(me.name, me.hp, true)}<div class="battle-bar"><strong>${r.mode === "bot" ? "บอท · กฎตามเฟส" : "ห้อง " + r.code}</strong><span>${op ? esc(op.name) + " · มือ " + op.handCount + " · ไลฟ์ " + op.hp : "รอเพื่อน"}</span><div>${r.mode === "bot" ? "" : btn("copy", "รหัสห้อง")}<button data-rule="info">กฎ / บันทึก</button>${btn("lobby", "ออกจากสนาม")}</div></div><div class="battle-half opponent-half">${opponentHand(op)}${op ? playmat(op, false, false) : '<div class="waiting-seat">ส่งรหัส ' + r.code + " ให้เพื่อน</div>"}</div><div class="battle-divider"><div class="turn-banner ${r.active === r.seat ? "your-turn" : "their-turn"}" aria-live="polite"><span>เทิร์น <b>${r.turn}</b></span><strong>${r.status === "finished" ? (r.winner === null ? "เสมอ" : esc(r.players[r.winner ?? 0]?.name) + " ชนะ") : r.status === "waiting" ? "เตรียมเริ่มเกม" : "ตาของ " + esc(r.players[r.active]?.name || "")}</strong></div><div class="battle-actions">${controls}${playing ? btn("surrender", "ยอมแพ้") : ""}</div></div><div class="battle-half">${playmat(me, true, main || action || defense || combo)}</div><div class="hand-dock"><span class="hand-count">มือ ${me.handCount}</span><div class="hand">${me.hand.map((code, i) => `<article class="card ${(action || defense || combo) && actionUnavailable(r, code, card) ? "action-unavailable" : ""}" title="${esc(action || defense || combo ? actionUnavailable(r, code, card) : "")}" ${(main && !me.used?.charge) || action || defense ? `data-hand-drag="${i}" data-code="${code}"` : ""}><button class="art-button" data-detail="${code}" aria-label="${esc(card(code).name)}">${img(card(code))}</button>${main || action || defense ? `<button data-place-hand="${i}" ${main && me.used?.charge ? "disabled" : ""} class="quick-place">${main ? "ชาร์จ" : "วาง"}</button>` : combo ? `<button data-rule="combo" data-index="${i}" ${actionUnavailable(r, code, card) ? "disabled" : ""} class="quick-place">คอมโบ</button>` : setup && !me.mulligan ? `<label><input type="checkbox" data-mulligan="${i}" ${selectedMulligan.has(i) ? "checked" : ""}> เปลี่ยน</label>` : ""}</article>`).join("")}</div></div></section>`;
}

const button = (name: string, label: string, extra = "") =>
  `<button data-rule="${name}" ${extra}>${label}</button>`;

function modal(html: string): void {
  ui.dialog.classList.toggle("level-payment-modal", html.includes("levelDiscard"));
  ui.dialog.innerHTML = button("close", "ปิด", 'class="close"') + html;
  if (!ui.dialog.open) ui.dialog.showModal();
}

function checks(
  items: Array<{ value: string; code?: string; label?: string }>,
  name: string,
): string {
  return `<div class="rule-picks">${items.map((x) => `<label><input type="checkbox" name="${name}" value="${ui.esc(x.value)}">${x.code ? `<img src="${ui.card(x.code).img}" alt="${ui.esc(ui.card(x.code).name)}"><span>${ui.esc(ui.card(x.code).name)}</span>` : ui.esc(x.label)}</label>`).join("")}</div>`;
}

function selected(name: string): string[] {
  return [...ui.dialog.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map(
    (x) => x.value,
  );
}

export function showRuleCard(id?: string, index?: number): void {
  const r = ui.getRoom();
  const p = r.players[r.seat];
  if (id) {
    const c = p.table.find((item) => item.id === id);
    if (!c || !c.code) return;
    ui.showCard(
      c.code,
      `<p>${c.zone === "concerto" ? "คอนแชร์โตต้องหงาย และใช้จ่ายค่าร่าย" : "แอ็กชันเปิดพร้อมกันหลังทั้งสองฝ่ายยืนยัน"}</p>${c.faceDown && !p.locked ? button("return", "เก็บกลับมือ", `data-id="${id}"`) : ""}`,
    );
  } else if (index !== undefined) {
    const code = p.hand[index];
    modal(
      `<h2>ลง ${ui.esc(ui.card(code).name)}</h2><p>${r.phase === "action" ? "Main: ชาร์จคอนแชร์โตลงหงาย" : "Battle: ลงแอ็กชันคว่ำ"}</p>${r.phase === "action" ? "" : button("place", "แอ็กชันคว่ำ", `data-zone="action" data-index="${index}" ${actionUnavailable(r, code, ui.card) ? "disabled" : ""}`)}${r.phase === "action" && r.active === r.seat && !p.used?.charge ? button("place", "ชาร์จคอนแชร์โต", `data-zone="concerto" data-index="${index}"`) : ""}`,
    );
  }
}

function choice(): void {
  const r = ui.getRoom();
  const q = r.choice;
  if (!q || !q.canAnswer) return;
  let content = `<h2>${ui.esc(q.label)}</h2>`;
  if (q.type === "manual") return;
  if (q.type === "discard") {
    content +=
      checks(
        (q.options as Array<{ value: string; code?: string; label?: string }>) || [],
        "effectDiscard",
      ) + button("answerDiscard", "ยืนยันทิ้ง " + q.count + " ใบ");
  } else if (q.options) {
    content += `<div class="row">${q.options.map((x) => button("answer", x.label || ui.card(x.value as string).name, `data-value="${ui.esc(String(x.value))}"`)).join("")}</div>`;
  }
  modal(content);
}

export function setupRulesUI(value: RulesUIContext): void {
  ui = value;
  if (typeof document === "undefined") return;

  document.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement;
      const t = target.closest<HTMLElement>("[data-rule]");
      if (!t) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const r = ui.getRoom();
      if (!r?.rulesVersion) return;
      const p = r.players[r.seat];
      const d = t.dataset;
      let cmd: GameCommand | undefined;

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
        case "reserve":
          modal(
            '<h2>เด็คตัวละคร</h2><p>คลิกดูความสามารถ · อัปเลเวลจากตัวละครบนสนาม</p><div class="rule-picks">' +
              p.reserve
                .map(
                  (code) =>
                    '<button data-rule="inspectCharacter" data-code="' +
                    code +
                    '"><img src="' +
                    ui.card(code).img +
                    '" alt="' +
                    ui.esc(ui.card(code).name) +
                    '"><span>Lv.' +
                    ui.card(code).level +
                    "</span></button>",
                )
                .join("") +
              "</div>",
          );
          return;
        case "inspectCharacter":
          if (p.reserve.includes(d.code!))
            ui.showCard(d.code!, button("reserve", "กลับไปดูเด็คตัวละคร"));
          return;
        case "fieldCharacter":
          if (p.field.includes(d.code!)) showUpgradeDetails(r, d.code!);
          return;
        case "inspectStack":
          if (Object.values(p.stacks || {}).some(stack => stack.includes(d.code!))) showUpgradeDetails(r, d.code!);
          return;
        case "inspectUpgrade":
          if (canUpgradeCard(r, d.code!, ui.card)) showUpgradeDetails(r, d.code!);
          return;
        case "levelPick": {
          const code = d.code!;
          if (!canUpgradeCard(r, code, ui.card)) return;
          modal(
            `<h2>อัป ${ui.esc(ui.card(code).name)} Lv.${ui.card(code).level}</h2><p>เลือกทิ้ง ${ui.card(code).level} ใบ</p>${checks(
              p.hand.map((c, i) => ({ value: String(i), code: c })),
              "levelDiscard",
            )}${button("levelPay", "ยืนยันอัปเลเวล", `data-code="${code}" disabled`)}`,
          );
          return;
        }
        case "levelPay":
          if (selected("levelDiscard").length !== Number(ui.card(d.code!).level)) return;
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
          if (r.choice) {
            cmd = { type: "answer", id: r.choice.id, value: d.value };
          }
          break;
        case "answerDiscard":
          if (r.choice) {
            cmd = {
              type: "answer",
              id: r.choice.id,
              indices: selected("effectDiscard").map(Number),
            };
          }
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

export function opponentHand(player: PublicPlayer | null | undefined): string {
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
    Array.from({ length: count }, () => '<span class="opponent-hand-back"></span>').join("") +
    "</div></div>"
  );
}

export function actionUnavailable(r: PublicRoom, code: string, card: (c: string) => Card): string {
  const p = r.players[r.seat];
  const c = card(code);
  const combo = r.phase === "combo";
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
  if (!combo && (p.locked || p.table.some((x) => x.zone === "action" && x.faceDown)))
    return "มีแอ็กชันที่ลงไว้แล้ว";
  if (combo && (c.color !== "แดง" || r.comboLeft === 0 || p.flags?.noComboTurn === r.turn))
    return "ไม่สามารถใช้เป็นคอมโบได้";
  const cost = Math.max(
    0,
    Number(c.fee) +
      ((p.flags?.costBonus as number) || 0) +
      (c.color === "แดง" && p.flags?.redTaxTurn === r.turn ? 1 : 0) -
      (code === "BP01-062" && r.previousWinner === r.seat ? 1 : 0),
  );
  if (cost > p.table.filter((x) => x.zone === "concerto").length)
    return "คอนแชร์โตไม่พอ · ต้องใช้ " + cost;
  if (c.info.includes("【リーダースキル】") && card(p.leader || "")?.character !== c.character)
    return "ผู้นำไม่ตรงเงื่อนไข";
  if (
    (c.feature_name || "").includes("音骸") &&
    p.table.some(
      (x) =>
        x.zone === "action" &&
        !x.faceDown &&
        x.code &&
        (card(x.code)?.feature_name || "").includes("音骸"),
    )
  )
    return "ใช้ Echo ไปแล้วในเฟสนี้";
  return "";
}

export function canUpgradeCard(r: PublicRoom, code: string, card: (c: string) => Card): boolean {
  const p = r.players[r.seat];
  const target = card(code);
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
  const level = Number(target.level);
  const current = Number(old.level);
  return (level === current || level === current + 1) && p.hand.length >= level;
}

function showUpgradeDetails(r: PublicRoom, code: string): void {
  const p = r.players[r.seat],
    selected = ui.card(code),
    current = p.field.find((id) => ui.card(id).character === selected.character);
  if (!current) return;
  const options = p.reserve.filter(
    (id) => ui.card(id).character === selected.character && canUpgradeCard(r, id, ui.card),
  );
  const controls =
    '<h3>ดูความสามารถ / เลือกอัปเลเวล</h3><div class="rule-picks">' +
    [...new Set([...(p.stacks?.[current] || [current]), ...options])]
      .map(
        (id) =>
          '<div><button data-rule="' +
          (id === current ? "fieldCharacter" : options.includes(id) ? "inspectUpgrade" : "inspectStack") +
          '" data-code="' +
          id +
          '" aria-pressed="' +
          (id === code) +
          '"><img src="' +
          ui.card(id).img +
          '" alt="' +
          ui.esc(ui.card(id).name) +
          " Lv." +
          ui.card(id).level +
          '"></button><span>' +
          (id === current
            ? "บนสนาม"
            : options.includes(id) ? "Lv." + ui.card(id).level + " · ทิ้ง " + ui.card(id).level + " ใบ" : "เลเวลก่อนหน้า · Lv." + ui.card(id).level) +
          "</span></div>",
      )
      .join("") +
    "</div>" +
    (options.includes(code)
      ? button("levelPick", "Up Level · อัปเลเวลเป็นใบนี้", 'data-code="' + code + '"')
      : "<p>เลือกการ์ดที่อัปได้ใน Main ของคุณ</p>");
  ui.showCard(code, controls);
}

// Card-shaped payment choices; limit selection to the upgrade cost.
if (typeof document !== "undefined") document.addEventListener("change", event => {
  const input = event.target as HTMLInputElement;
  if (input.name !== "levelDiscard") return;
  const pay = ui.dialog.querySelector<HTMLButtonElement>('[data-rule="levelPay"]');
  if (!pay) return;
  const cost = Number(ui.card(pay.dataset.code!).level);
  if (selected("levelDiscard").length > cost) input.checked = false;
  const count = selected("levelDiscard").length;
  for (const option of ui.dialog.querySelectorAll<HTMLInputElement>('input[name="levelDiscard"]')) {
    option.disabled = !option.checked && count >= cost;
    option.closest("label")?.classList.toggle("payment-selected", option.checked);
  }
  pay.disabled = count !== cost;
  pay.textContent = "ยืนยันอัปเลเวล · " + count + " / " + cost;
});

function lifeBadge(name: string, hp: number, mine: boolean): string {
  return '<aside class="field-life ' + (mine ? 'my-life' : 'enemy-life') + '" aria-label="' + ui.esc(name) + ' ไลฟ์ ' + hp + '"><span class="life-owner">' + (mine ? 'คุณ' : ui.esc(name)) + '</span><div class="life-value"><span aria-hidden="true">♥</span><strong>' + hp + '</strong><progress max="20" value="' + Math.max(0, Math.min(20, hp)) + '" aria-label="ไลฟ์"></progress></div></aside>';
}
