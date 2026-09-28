import { animate } from "motion/mini";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const closing = new WeakMap<HTMLDialogElement, object>();
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
