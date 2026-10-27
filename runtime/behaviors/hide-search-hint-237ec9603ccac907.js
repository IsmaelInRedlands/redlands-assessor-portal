export default function install(app) {
  const mount = app.getMount("assessor-search-panel");
  function removeHint() {
    mount.querySelectorAll(".rp-hint").forEach((node) => node.remove());
  }
  removeHint();
  const observer = new MutationObserver(removeHint);
  observer.observe(mount, { childList: true, subtree: true });
  app.onCleanup(() => observer.disconnect());
}