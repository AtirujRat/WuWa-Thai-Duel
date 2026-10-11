import { animate, stagger } from "framer-motion/dom";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const closing = new WeakMap<HTMLDialogElement, object>();
export function cancelDialogClose(dialog: HTMLDialogElement): void {
  closing.delete(dialog);
  dialog.style.opacity = "1";
}
export function openMotionDialog(dialog: HTMLDialogElement): void {
  closing.delete(dialog);
  if (!dialog.open) dialog.showModal();
  animate(dialog, { opacity: [0, 1] }, { duration: reduced() ? 0 : .22 });
}
export function closeMotionDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open || closing.has(dialog)) return;
  const token = {};
  closing.set(dialog, token);
  animate(dialog, { opacity: 0 }, { duration: reduced() ? 0 : .14 }).then(() => {
    if (closing.get(dialog) !== token) return;
    dialog.close();
    closing.delete(dialog);
    dialog.style.opacity = "";
  });
}
export function installUiMotion(): void {
  document.addEventListener("pointerdown", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button || button.disabled || reduced()) return;
    animate(button, { opacity: [1, .68, 1] }, { duration: .2 });
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (button && !button.disabled && !reduced()) animate(button, { opacity: [1, .68, 1] }, { duration: .2 });
  });
  new MutationObserver(records => {
    for (const record of records) {
      const dialog = record.target;
      if (dialog instanceof HTMLDialogElement && dialog.open && !reduced()) {
        animate(dialog, { opacity: [0, 1] }, { duration: .22 });
      }
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
}

let lastView = "";
export function animatePage(root: HTMLElement, view: string): void {
  if (view === lastView) return;
  lastView = view;
  if (reduced()) return;
  animate(root, { opacity: [0, 1], y: [10, 0] }, { duration: .26, ease: "easeOut" });
  const tiles = [...root.querySelectorAll<HTMLElement>(".deck-selection-grid > *, .deck-section, .friend-lobby, .bot-lobby")].slice(0, 12);
  if (tiles.length) animate(tiles, { opacity: [0, 1], y: [8, 0] }, { duration: .24, delay: stagger(.035), ease: "easeOut" });
}
