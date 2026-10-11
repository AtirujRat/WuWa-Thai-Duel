import type { Card } from "../types/card.ts";
import type { PublicRoom, GameLogEntry } from "../types/game.ts";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
let notices: HTMLElement;
let roomCode = "";
let previousFields: string[][] = [];
let upgradeDialog: HTMLDialogElement | undefined;
let upgradeTimer: ReturnType<typeof setTimeout> | undefined;
function showUpgrade(old: Card, next: Card, player: string) {
  if (!upgradeDialog) {
    upgradeDialog = document.createElement("dialog");
    upgradeDialog.className = "level-up-reveal";
    upgradeDialog.setAttribute("aria-label", "อัปเลเวลสำเร็จ");
    upgradeDialog.onclick = () => upgradeDialog?.close();
    document.body.append(upgradeDialog);
  }
  if (upgradeTimer) clearTimeout(upgradeTimer);
  upgradeDialog.innerHTML = `<div class="level-up-pair"><figure class="level-up-before"><img src="${esc(old.img)}" alt="${esc(old.name)}"><figcaption>Lv.${old.level}</figcaption></figure><span class="level-up-arrow">➜</span><figure class="level-up-after"><img src="${esc(next.img)}" alt="${esc(next.name)}"><figcaption>Lv.${next.level}</figcaption></figure></div><p>${esc(player)} เลเวลอัป ${esc(next.name)} เป็น Lv.${next.level}</p>`;
  if (!upgradeDialog.open) upgradeDialog.showModal();
  upgradeTimer = setTimeout(() => upgradeDialog?.close(), 2400);
}
const seen = new Set<string>();
let pending: GameLogEntry[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

export function updateBattlePresentation(r: PublicRoom | null, visible: boolean, card: (code: string) => Card | undefined): void {
  if (!notices) {
    notices = document.createElement("aside");
    notices.className = "effect-notifications";
    notices.setAttribute("aria-live", "polite");
    document.body.append(notices);
  }
  if (!visible || !r?.rulesVersion || roomCode !== r.code) {
    if (timer) clearTimeout(timer);
    timer = undefined; pending = []; seen.clear(); notices.replaceChildren();
    roomCode = visible && r ? r.code : ""; previousFields = r?.players.map(p => [...p.field]) || []; if (upgradeTimer) clearTimeout(upgradeTimer); upgradeDialog?.close();
    if (!visible || !r?.rulesVersion) return;
    // Joining or restoring a game must not replay old receipts.
    for (const entry of r.log) seen.add(entry.id || entry.time + entry.text);
    return;
  }
  r.players.forEach((player, seat) => {
    for (const code of player.field) {
      const next = card(code);
      if (!next) continue;
      const old = (previousFields[seat] || []).map(card).find(c => c?.character === next.character);
      if (old && Number(next.level) > Number(old.level)) showUpgrade(old, next, seat === r.seat ? "คุณ" : player.name);
    }
  });
  previousFields = r.players.map(p => [...p.field]);
  for (const entry of r.log) {
    const id = entry.id || entry.time + entry.text;
    if (!seen.has(id) && entry.notice) pending.push(entry);
    seen.add(id);
  }
  const drain = () => {
    const entry = pending.shift();
    if (!entry) { timer = undefined; return; }
    const c = entry.source ? card(entry.source) : undefined;
    notices.innerHTML = `${c ? `<img data-detail="${esc(c.code)}" src="${esc(c.img)}" alt="${esc(c.name)}">` : ""}<div><strong>${esc(c?.name || "เอฟเฟกต์การ์ด")}</strong><p>${esc(entry.text)}</p></div>`;
    // Keep receipts visible when a target-selection dialog is in the top layer.
    (document.querySelector("dialog[open]") || document.body).append(notices);
    timer = setTimeout(() => { notices.replaceChildren(); document.body.append(notices); drain(); }, 3800);
  };
  if (pending.length && !timer) drain();
}
