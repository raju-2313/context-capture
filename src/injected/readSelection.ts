(() => {
  try {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().length === 0) {
      return { selection: "", prefix: "", suffix: "" };
    }
    const text = sel.toString();
    let prefix = "";
    let suffix = "";
    try {
      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let beforeFound = false;
      let afterFound = false;
      let count = 0;
      walker.currentNode = container;
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node === range.startContainer) { beforeFound = true; continue; }
        if (node === range.endContainer) { afterFound = true; continue; }
        if (!beforeFound) {
          prefix = node.textContent?.slice(-30) || "";
        } else if (afterFound && count < 1) {
          suffix = node.textContent?.slice(0, 30) || "";
          break;
        }
        count++;
      }
    } catch {}
    return { selection: text, prefix, suffix };
  } catch (err) {
    return { selection: "", prefix: "", suffix: "", error: String(err) };
  }
})();
