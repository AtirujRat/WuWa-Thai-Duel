import { openMotionDialog, closeMotionDialog } from "./ui-motion.ts";
import type { Card } from "../types/card.ts";
import type { PublicRoom, GameLogEntry } from "../types/game.ts";

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
let dialog: HTMLDialogElement;
let notices: HTMLElement;
let reopen: HTMLButtonElement;
let key = "";
let version = -1;
let hidden = false;
const revealTimes = new Map<string, number>();
let nextRevealAt = 0;
const seen = new Set<string>();
let pending: GameLogEntry[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

export function updateBattlePresentation(
  r: PublicRoom | null,
  visible: boolean,
  card: (code: string) => Card | undefined,
): void {
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "battle-result-modal";
    dialog.setAttribute("aria-label", "ผลการต่อสู้");
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeMotionDialog(dialog);
      hidden = true;
      reopen.hidden = false;
      document.body.append(notices);
    });
    dialog.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-result-close]")) {
        hidden = true;
        closeMotionDialog(dialog);
        reopen.hidden = false;
        document.body.append(notices);
      }
    });
    notices = document.createElement("aside");
    notices.className = "effect-notifications";
    notices.setAttribute("aria-live", "polite");
    reopen = document.createElement("button");
    reopen.className = "reopen-battle";
    reopen.textContent = "ดูผล Battle";
    reopen.hidden = true;
    reopen.onclick = () => {
      hidden = false;
      openMotionDialog(dialog);
      reopen.hidden = true;
    };
    document.body.append(dialog, notices, reopen);
  }
  if (!visible || !r?.rulesVersion) {
    closeMotionDialog(dialog);
    reopen.hidden = true;
    notices.replaceChildren();
    pending = [];
    if (timer) clearTimeout(timer);
    timer = undefined;
    key = "";
    seen.clear();
    return;
  }
  const nextKey = r.code + ":" + r.turn;
  const newRoom = !key || key.split(":")[0] !== r.code;
  if (key !== nextKey) {
    key = nextKey;
    hidden = false;
    version = -1;
    revealTimes.clear();
    nextRevealAt = 0;
    if (newRoom) {
      seen.clear();
      pending = [];
      notices.replaceChildren();
      if (timer) clearTimeout(timer);
      timer = undefined;
    }
  }
  for (const entry of r.log) {
    const id = entry.id || entry.time + entry.text;
    if (!seen.has(id) && entry.notice && (!newRoom || entry.turn === r.turn)) pending.push(entry);
    seen.add(id);
  }
  const drain = () => {
    const entry = pending.shift();
    if (!entry) {
      timer = undefined;
      return;
    }
    const c = entry.source ? card(entry.source) : undefined;
    notices.innerHTML = `${c ? `<img data-detail="${esc(c.code)}" src="${esc(c.img)}" alt="${esc(c.name)}">` : ""}<div><strong>${esc(c?.name || "เอฟเฟกต์การ์ด")}</strong><p>${esc(entry.text)}</p></div>`;
    // Keep notices inside the top-layer dialog while it is open.
    (dialog.open ? dialog : document.body).append(notices);
    timer = setTimeout(() => {
      notices.replaceChildren();
      drain();
    }, 3800);
  };
  if (pending.length && !timer) drain();
  const active =
    !!r.lastDuel && ["judgment", "combo", "comboEffects", "result"].includes(
      r.phase || "",
    ) ||
    (r.status === "finished" && !!r.lastDuel);
  if (!active) {
    closeMotionDialog(dialog);
    reopen.hidden = true;
    document.body.append(notices);
    return;
  }
  reopen.hidden = !hidden;
  if (version === r.version) return;
  version = r.version;
  const art = (code?: string | null) => {
    const c = code ? card(code) : undefined;
    return c
      ? `<img src="${esc(c.img)}" alt="${esc(c.name)}"><strong>${esc(c.name)}</strong>`
      : "<div class=unrevealed>รอเปิดการ์ด</div>";
  };
  const turnEvents = r.log.filter((x) => x.turn === r.turn && x.battle);
  const resultIndex = turnEvents.findIndex(x => x.text.startsWith("ผล Battle"));
  // Start at the judgment result: setup, card placement and phase changes stay out.
  const entries = resultIndex < 0 ? [] : turnEvents.slice(resultIndex).filter(x =>
    x.text.startsWith("ผล Battle") || x.notice || /ไลฟ์|คอมโบ|ชนะ|เสมอ|ยอมแพ้/.test(x.text)
  );
  const eventArt = (entry: GameLogEntry) => {
    const result = entry.text.startsWith("ผล Battle");
    const winner = r.lastDuel?.winner;
    const winningCard = winner === 0 ? r.lastDuel?.human : winner === 1 ? r.lastDuel?.bot : undefined;
    const codes = entry.source ? [entry.source] : result && winner == null
      ? [r.lastDuel?.human, r.lastDuel?.bot] : winningCard ? [winningCard] : [];
    const images = codes.map(code => code ? card(code) : undefined).filter((c): c is Card => !!c);
    return images.length ? '<div class="event-art">' + images.map(c =>
      '<img data-detail="' + esc(c.code) + '" src="' + esc(c.img) + '" alt="' + esc(c.name) + '" title="' + esc(c.name) + '">'
    ).join("") + '</div>' : '<div class="event-art event-symbol" aria-hidden="true">◆</div>';
  };
  const actions = document.querySelector(".battle-shell .battle-actions")?.innerHTML || "";
  const hand = document.querySelector(".battle-shell .hand-dock")?.innerHTML || "";
  const now = Date.now();
  for (const entry of entries) {
    const id = entry.id || entry.time + entry.text;
    if (!revealTimes.has(id)) {
      nextRevealAt = Math.max(now, nextRevealAt) + 700;
      revealTimes.set(id, nextRevealAt);
    }
  }
  // Preserve the persistent inspector when rebuilding the dialog content.
  const inspector = dialog.querySelector("#card-info");
  if (inspector) document.body.append(inspector);
  notices.remove();
  dialog.innerHTML = `<header><h2>ผลการต่อสู้ <small>BATTLE</small></h2><button data-result-close aria-label="ย่อหน้าต่าง">−</button></header><div class="duel-sides">${r.players.map((p, i) => `<section class="duel-side ${r.lastDuel?.winner === i ? "duel-winner" : ""}"><p>${esc(p.name)} ${r.lastDuel?.winner === i ? " · ผู้ชนะ" : ""}</p>${art(r.lastDuel ? (i === 0 ? r.lastDuel.human : r.lastDuel.bot) : null)}<p>ไลฟ์ <b>${p.hp}</b> / 20</p><progress max="20" value="${p.hp}"></progress></section>`).join("")}</div><p class="duel-reason">${esc(r.lastDuel?.reason || "เลือกแอ็กชัน · เปิดพร้อมกันเมื่อทั้งสองฝ่ายยืนยัน")}</p><ol class="duel-events" aria-live="polite">${entries.map((x) => `<li style="animation-delay:${Math.max(0, (revealTimes.get(x.id || x.time + x.text) || 0) - Date.now())}ms">${eventArt(x)}<span class="event-copy"><small>${x.text.startsWith("ผล Battle") ? "ผลการประลอง" : x.text.includes("คอมโบ") ? "COMBO" : x.notice ? "เอฟเฟกต์การ์ด" : "ความเสียหาย / ไลฟ์"}</small>${esc(x.text)}</span></li>`).join("")}</ol><div class="battle-actions">${actions}</div><div class="result-hand">${hand}</div>`;
  if (!hidden && !dialog.open) openMotionDialog(dialog);
  if (notices.childNodes.length) (dialog.open ? dialog : document.body).append(notices);
  const log = dialog.querySelector(".duel-events");
  if (log) log.scrollTop = log.scrollHeight;
}
