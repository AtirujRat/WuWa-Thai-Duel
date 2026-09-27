import type { GameLogEntry, PublicRoom } from "../types/game.ts";

let panel: HTMLElement | null = null;
let list: HTMLOListElement | null = null;
let status: HTMLElement | null = null;
let roomCode: string | null = null;
let seen: GameLogEntry[] = [];
let pending: GameLogEntry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let collapsed = false;

const escape = (s: string | null | undefined): string =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c,
  );

const key = (x: GameLogEntry): string => x.time + "|" + x.text;

export function newLogEntries(before: GameLogEntry[], after: GameLogEntry[]): GameLogEntry[] {
  for (let n = Math.min(before.length, after.length); n > 0; n--)
    if (before.slice(-n).every((x, i) => key(x) === key(after[i]))) return after.slice(n);
  return after;
}

function category(text: string): [string, string] {
  if (/ชนะ|แพ้|เสมอ|จบเกม/.test(text)) return ["result", "ผลประลอง"];
  if (/เสียหาย|ดาเมจ|damage|ไลฟ์|heal|life/.test(text)) return ["damage", "พลังชีวิต"];
  if (/คอมโบ|pursuit/.test(text)) return ["combo", "คอมโบ"];
  if (/จั่ว|draw|รีเฟรช|สับ/.test(text)) return ["draw", "เด็ค / จั่ว"];
  if (/ชาร์จ|คอนแชร์โต|จ่าย|charge/.test(text)) return ["energy", "คอนแชร์โต"];
  if (/เอฟเฟกต์|สกิล|อัป|ผู้นำ|สลับ/.test(text)) return ["skill", "สกิล / ตัวละคร"];
  if (/เทิร์น|เฟส/.test(text)) return ["turn", "ลำดับเกม"];
  return ["card", "การ์ด / การเล่น"];
}

function append(entry: GameLogEntry, animate = false): void {
  if (!list) return;
  const [kind, label] = category(entry.text);
  const item = document.createElement("li");
  const follow = list.scrollHeight - list.scrollTop - list.clientHeight < 55;
  item.className = "battle-log-entry log-" + kind + (animate ? " log-arrive" : "");
  item.innerHTML =
    '<div class="log-meta"><strong>' +
    label +
    "</strong><time>" +
    escape(entry.time) +
    "</time></div><p>" +
    escape(entry.text).replace(/([0-9]+)/g, "<b>$1</b>") +
    "</p>";
  list.append(item);
  while (list.children.length > 100) list.firstElementChild?.remove();
  if (follow) list.scrollTop = list.scrollHeight;
}

function drain(): void {
  timer = null;
  if (!status) return;
  if (!pending.length) {
    status.textContent = "ล่าสุด";
    return;
  }
  append(pending.shift()!, true);
  status.textContent = pending.length ? "กำลังแสดง · " + pending.length : "ล่าสุด";
  if (pending.length) timer = setTimeout(drain, 550);
}

export function updateBattleLog(room: PublicRoom | null | undefined, visible: boolean): void {
  if (!panel) {
    panel = document.createElement("aside");
    panel.id = "battle-log";
    panel.setAttribute("aria-label", "บันทึกการเล่น");
    panel.innerHTML =
      '<div class="battle-log-heading"><strong>บันทึกการเล่น</strong><button type="button" aria-label="ย่อบันทึกการเล่น" aria-expanded="true">‹</button></div><span class="log-status"></span><ol role="log" aria-label="เหตุการณ์ในเกม" aria-live="polite" aria-relevant="additions"></ol>';
    document.body.append(panel);
    list = panel.querySelector("ol");
    status = panel.querySelector(".log-status");
    panel.querySelector("button")?.addEventListener("click", () => {
      collapsed = !collapsed;
      document.body.classList.toggle("log-collapsed", collapsed);
      const b = panel?.querySelector("button");
      if (b) {
        b.textContent = collapsed ? "›" : "‹";
        b.setAttribute("aria-expanded", String(!collapsed));
        b.setAttribute("aria-label", collapsed ? "ขยายบันทึกการเล่น" : "ย่อบันทึกการเล่น");
      }
    });
  }
  panel.hidden = !visible || !room;
  document.body.classList.toggle("has-battle-log", visible && !!room);
  if (!visible || !room) {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = [];
    roomCode = null;
    seen = [];
    return;
  }
  const entries = room.log || [];
  if (roomCode !== room.code) {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = [];
    list?.replaceChildren();
    roomCode = room.code;
    entries.forEach((x) => append(x));
    if (list) list.scrollTop = list.scrollHeight;
    if (status) status.textContent = entries.length ? "ล่าสุด" : "รอเหตุการณ์แรก";
  } else {
    pending.push(...newLogEntries(seen, entries));
  }
  seen = entries.map((x) => ({ ...x }));
  if (pending.length && !timer) drain();
}
