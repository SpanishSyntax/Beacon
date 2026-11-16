// src/library-tree.js
var el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
};
function icon(kind) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.5", "aria-hidden": "true" })) svg.setAttribute(key, value);
  svg.classList.add("fc-tree-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", kind === "deck" ? "M7 4h12a1 1 0 0 1 1 1v12M5 8h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM6 12h8M6 16h5" : kind === "proposition" ? "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" : "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3 5h10M7 13h7");
  svg.append(path);
  return svg;
}
var settingsIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="20,12 21.81,13.95 21.24,15.83 18.65,16.44 17.66,17.66 17.56,20.31 15.83,21.24 13.56,19.85 12,20 10.05,21.81 8.17,21.24 7.56,18.65 6.34,17.66 3.69,17.56 2.76,15.83 4.15,13.56 4,12 2.19,10.05 2.76,8.17 5.35,7.56 6.34,6.34 6.44,3.69 8.17,2.76 10.44,4.15 12,4 13.95,2.19 15.83,2.76 16.44,5.35 17.66,6.34 20.31,6.44 21.24,8.17 19.85,10.44"/><circle cx="12" cy="12" r="3"/></svg>';
var plusIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
function mountLibraryTree({ ctx, container, signal, button, onReview, onPreview, onEdit, onDelete, onCreateCard, onCreateCue, onDeckSettings, onMemberships, onReorder, onRename, onSelection, onError }) {
  const viewport = el("div", "fc-tree-viewport");
  const inner = el("div", "fc-tree-inner");
  const empty = el("p", "fc-muted");
  viewport.append(inner);
  container.append(viewport, empty);
  const selected = /* @__PURE__ */ new Set(), expanded = /* @__PURE__ */ new Set(), factories = /* @__PURE__ */ new Map(), records = /* @__PURE__ */ new Map(), mounted = /* @__PURE__ */ new Map(), drafts = /* @__PURE__ */ new Map();
  let state = null, query = "", disposed = false;
  const live = () => !disposed && !signal.aborted;
  const cueToken = (id) => `cue:${id}`;
  const propTokens = (p) => p.cues.filter((c) => !c.deleted).map((c) => cueToken(c.id));
  const leaves = (p) => {
    const ids = propTokens(p);
    return ids.length ? ids : [`proposition:${p.id}`];
  };
  function selection() {
    const cueIds = [], propositionIds = [], emptyPropositionIds = [];
    for (const p of state?.propositions ?? []) {
      if (p.archived) continue;
      const cues = p.cues.filter((c) => !c.deleted && selected.has(cueToken(c.id)));
      if (cues.length) {
        propositionIds.push(p.id);
        cueIds.push(...cues.map((c) => c.id));
      }
      if (!propTokens(p).length && selected.has(`proposition:${p.id}`)) emptyPropositionIds.push(p.id);
    }
    const emptyDeckIds = (state?.decks ?? []).filter((d) => selected.has(`deck:${d.id}`)).map((d) => d.id);
    return { cueIds, propositionIds, emptyPropositionIds, emptyDeckIds, count: selected.size };
  }
  const run = (action) => async () => {
    try {
      await action();
    } catch (error) {
      if (live()) onError(error instanceof Error ? error.message : String(error));
    }
  };
  function rowSelection(tokens, label) {
    const count2 = tokens.filter((key) => selected.has(key)).length;
    return { label: `Select ${label}`, checked: count2 === tokens.length, indeterminate: count2 > 0 && count2 < tokens.length, onChange(value) {
      if (!live()) return;
      for (const token of tokens) {
        if (value) selected.add(token);
        else selected.delete(token);
      }
      render();
    } };
  }
  function disclosure(key, label) {
    return { label: `Toggle ${label}`, expanded: expanded.has(key) || !!query, onChange(value) {
      if (!live()) return;
      if (value) expanded.add(key);
      else expanded.delete(key);
      if (query) searchFolds[value ? "delete" : "add"](key);
      render();
    } };
  }
  const searchFolds = /* @__PURE__ */ new Set();
  function menuItems(record) {
    const { kind, deck, p, cue, archive } = record;
    if (archive) return [];
    const items = kind === "deck" ? [
      { key: "settings", label: "Deck settings", onSelect: run(() => onDeckSettings(record.deck)) }
    ] : kind === "proposition" ? [{ key: "memberships", label: "Decks\u2026", onSelect: run(() => onMemberships(record.p)) }] : [{ key: "edit", label: "Edit", onSelect: run(() => onEdit(record.p, record.cue)) }, { key: "delete", label: "Delete", disabled: ["running", "cancelling"].includes(state.batch?.status), onSelect: run(() => onDelete(record.p, record.cue)) }];
    const ids = kind === "deck" ? state.decks.map((d) => d.id) : kind === "proposition" ? deck.propositionIds.filter((id2) => state.propositions.some((p2) => p2.id === id2 && !p2.archived)) : p.cues.filter((c) => !c.deleted).map((c) => c.id);
    const id = kind === "deck" ? deck.id : kind === "proposition" ? p.id : cue.id;
    for (const direction of [-1, 1]) items.push({ key: direction === -1 ? "up" : "down", label: direction === -1 ? "Move up" : "Move down", disabled: !!query || ids.indexOf(id) + direction < 0 || ids.indexOf(id) + direction >= ids.length, onSelect: run(() => onReorder({ kind, id, ...kind === "proposition" ? { deckId: deck.id } : kind === "cue" ? { propositionId: p.id } : {}, direction })) });
    return items;
  }
  function content(key) {
    if (factories.has(key)) return factories.get(key);
    const factory = (slot, mountSignal) => {
      if (mountSignal.aborted || !live()) return;
      const record = records.get(key);
      const root = el("div", "fc-tree-row-content");
      root.dataset.fcOccurrence = key;
      root.append(icon(record.kind === "archive" ? "deck" : record.kind));
      const labelSlot = el("span", "fc-tree-name");
      root.append(labelSlot);
      const label = el(record.kind === "deck" || record.kind === "cue" ? "button" : "span", "fc-tree-label");
      if (label.tagName === "BUTTON") label.type = "button";
      labelSlot.append(label);
      const metadata = el("span", "fc-tree-metadata");
      root.append(metadata);
      let draft, input, error;
      if (record.kind === "deck") {
        if (!drafts.has(record.deck.id)) drafts.set(record.deck.id, { editing: false, value: "", saving: false, error: "" });
        draft = drafts.get(record.deck.id);
        input = el("input", "fc-tree-rename");
        input.type = "text";
        input.setAttribute("aria-label", "Deck name");
        error = el("span", "fc-tree-rename-error");
        error.setAttribute("role", "alert");
        const commit = async () => {
          if (!live() || mountSignal.aborted || !draft.editing || draft.saving) return;
          const value = draft.value.trim();
          if (!value || value === record.deck.name) {
            draft.editing = false;
            draft.error = "";
            refresh();
            return;
          }
          draft.saving = true;
          refresh();
          try {
            await onRename(record.deck.id, value);
            draft.editing = false;
            draft.error = "";
          } catch (cause) {
            draft.error = cause instanceof Error ? cause.message : String(cause);
          } finally {
            draft.saving = false;
            if (!mountSignal.aborted && live()) refresh();
          }
        };
        label.addEventListener("click", (event) => {
          event.stopPropagation();
          draft.editing = true;
          draft.value = record.deck.name;
          draft.error = "";
          refresh();
          input.focus();
          input.select?.();
        }, { signal: mountSignal });
        input.addEventListener("input", () => {
          draft.value = input.value;
        }, { signal: mountSignal });
        input.addEventListener("blur", () => {
          void commit();
        }, { signal: mountSignal });
        input.addEventListener("keydown", (event) => {
          if (event.isComposing || event.keyCode === 229) return;
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (!draft.saving) {
              draft.editing = false;
              draft.error = "";
              refresh();
            }
          }
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            void commit();
          }
        }, { signal: mountSignal });
        labelSlot.append(error);
        button(root, "Review", run(() => onReview({ deckIds: [record.deck.id] })), mountSignal, { size: "xs", variant: "outline" });
      } else if (record.kind === "cue") {
        label.addEventListener("click", (event) => {
          event.stopPropagation();
          onPreview(record.p, record.cue, record.archive);
        }, { signal: mountSignal });
      }
      if (!record.archive && record.kind !== "archive") {
        const more = el("span", "fc-tree-more");
        root.append(more);
        if (record.kind === "deck" || record.kind === "proposition") {
          const label2 = record.kind === "deck" ? "Create card" : "Add cue";
          button(more, label2, run(() => record.kind === "deck" ? onCreateCard(record.deck) : onCreateCue(record.p, record.deck)), mountSignal, { icon: plusIcon, iconOnly: true, size: "icon-sm", variant: "ghost", title: label2 });
        }
        const actionsLabel = `${record.kind === "deck" ? "Deck" : record.kind === "proposition" ? "Proposition" : "Cue"} actions`;
        button(more, actionsLabel, () => {
          ctx.ui.openMenu(more, { label: actionsLabel, items: menuItems(record) }, { signal: mountSignal });
        }, mountSignal, { icon: settingsIcon, iconOnly: true, size: "icon-sm", variant: "ghost", title: actionsLabel });
      }
      function refresh() {
        const title = record.kind === "deck" ? record.deck.name : record.kind === "proposition" ? record.p.name : record.kind === "cue" ? record.cue.question.replace(/\s+/g, " ").trim() || "Cue" : "Archive";
        label.textContent = title;
        label.title = record.kind === "proposition" ? record.p.statement || title : record.kind === "deck" ? "Rename deck" : title;
        metadata.textContent = record.kind === "proposition" ? `${record.p.cues.filter((c) => !c.deleted).length} cues` : "";
        if (draft) {
          label.hidden = draft.editing;
          if (draft.editing) {
            if (input.parentElement !== labelSlot) labelSlot.prepend(input);
            if (input.value !== draft.value) input.value = draft.value;
          } else input.remove();
          input.disabled = draft.saving;
          error.textContent = draft.error;
        }
      }
      mounted.set(key, refresh);
      slot.append(root);
      refresh();
      return () => {
        if (mounted.get(key) === refresh) mounted.delete(key);
        root.remove();
      };
    };
    factories.set(key, factory);
    return factory;
  }
  function remember(key, data) {
    if (records.has(key)) Object.assign(records.get(key), data);
    else records.set(key, data);
    return content(key);
  }
  let tree = ctx.ui.mountTree(inner, { label: "Flashcards library", header: "Name", rows: [], columns: [
    { key: "propositions", header: "Propositions", width: "6.5rem", align: "right" },
    { key: "due", header: "Due", width: "3rem", align: "right" },
    { key: "new", header: "New today", width: "6rem", align: "right" }
  ] }, { signal });
  function render() {
    if (!live() || !state) return;
    const liveProps = state.propositions.filter((p) => !p.archived), byId = new Map(liveProps.map((p) => [p.id, p]));
    const allowed = /* @__PURE__ */ new Set([...state.decks.filter((d) => !d.propositionIds.some((id) => byId.has(id))).map((d) => `deck:${d.id}`), ...liveProps.flatMap(leaves)]);
    for (const key of selected) if (!allowed.has(key)) selected.delete(key);
    const includes = (p) => !query || [p.name, p.statement, ...p.cues.filter((c) => !c.deleted).flatMap((c) => [c.question, c.answer])].some((text) => String(text || "").toLocaleLowerCase().includes(query));
    const seen = /* @__PURE__ */ new Set();
    function row(key, data, label, tokens, children) {
      seen.add(key);
      const branch = children?.length ? { children, disclosure: disclosure(key, label) } : {};
      if (branch.disclosure && query && searchFolds.has(key)) branch.disclosure.expanded = false;
      return { key, content: remember(key, data), ...tokens ? { selection: rowSelection(tokens, label) } : {}, ...branch };
    }
    function proposition(p, deck, archive) {
      const key = archive ? `archive:p:${p.id}` : `deck:${deck.id}:p:${p.id}`;
      const children = p.cues.filter((c) => !c.deleted).map((cue) => row(`${key}:cue:${cue.id}`, { kind: "cue", p, cue, archive }, cue.question, archive ? null : [cueToken(cue.id)]));
      return row(key, { kind: "proposition", p, deck, archive }, p.name, archive ? null : leaves(p), children);
    }
    const rows = [];
    for (const deck of state.decks) {
      const all = deck.propositionIds.map((id) => byId.get(id)).filter(Boolean);
      const deckMatches = !query || deck.name.toLocaleLowerCase().includes(query);
      const matching = all.filter((p) => deckMatches || includes(p));
      if (query && !deckMatches && !matching.length) continue;
      const key = `deck:${deck.id}`, tokens = all.length ? [...new Set(all.flatMap(leaves))] : [`deck:${deck.id}`];
      const r = row(key, { kind: "deck", deck, archive: false }, deck.name, tokens, matching.map((p) => proposition(p, deck, false)));
      r.cells = { propositions: String(all.length), due: String(deck.due), new: `${deck.newToday} / ${deck.newLimit}` };
      rows.push(r);
    }
    const archived = state.propositions.filter((p) => p.archived && includes(p));
    if (archived.length) {
      const r = row("archive", { kind: "archive", archive: true }, "Archive", null, archived.map((p) => proposition(p, null, true)));
      r.cells = { propositions: String(archived.length) };
      rows.push(r);
    }
    tree.update({ rows });
    for (const [key, refresh] of mounted) if (seen.has(key)) refresh();
    empty.textContent = rows.length ? "" : query ? "No matching flashcards." : "No flashcards yet. Pick knowledge or upload a file above to generate your first cues.";
    empty.hidden = !!rows.length;
    onSelection(selection());
  }
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    tree.dispose();
    viewport.remove();
    empty.remove();
    selected.clear();
    records.clear();
    factories.clear();
    mounted.clear();
    drafts.clear();
  };
  signal.addEventListener("abort", dispose, { once: true });
  return {
    update(next, search = "") {
      if (!live()) return;
      const q = search.toLocaleLowerCase().trim();
      if (q !== query) searchFolds.clear();
      query = q;
      state = next;
      render();
    },
    selection,
    clearSelection() {
      if (!live()) return;
      selected.clear();
      render();
    },
    revealDeck(id, propositionId) {
      const deck = state?.decks.find((deck2) => deck2.id === id);
      if (!live() || !deck) return false;
      query = "";
      searchFolds.clear();
      expanded.add(`deck:${id}`);
      if (propositionId && deck.propositionIds.includes(propositionId)) expanded.add(`deck:${id}:p:${propositionId}`);
      render();
      if (container.closest(".fc-root")?.contains(document.activeElement)) {
        const node = [...inner.querySelectorAll("[data-fc-occurrence]")].find((node2) => node2.dataset.fcOccurrence === `deck:${id}`);
        node?.scrollIntoView?.({ block: "nearest" });
      }
      return true;
    },
    dispose
  };
}

// src/review.js
var ratings = ["Again", "Hard", "Good", "Easy"];
var ratingOptions = (label) => {
  const color = `var(--fc-rating-${label.toLowerCase()})`;
  const tint = (percent) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;
  return { variant: "custom", colors: {
    background: tint(12),
    text: color,
    border: tint(55),
    hover: { background: tint(20), border: tint(75) },
    active: { background: tint(28), border: color },
    focusVisible: { border: color, ring: tint(50) }
  } };
};
var message = (error) => error instanceof Error ? error.message : String(error);
var el2 = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
};
var interval = (ms) => {
  if (ms < 6e4) return `${Math.max(1, Math.round(ms / 1e3))}s`;
  if (ms < 36e5) return `${Math.round(ms / 6e4)}m`;
  if (ms < 864e5) return `${Math.round(ms / 36e5)}h`;
  return `${Math.round(ms / 864e5)}d`;
};
function lifetime(...parents) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const parent of parents.filter(Boolean)) {
    if (parent.aborted) abort();
    else parent.addEventListener("abort", abort, { once: true });
  }
  controller.signal.addEventListener("abort", () => {
    for (const parent of parents.filter(Boolean)) parent.removeEventListener("abort", abort);
  }, { once: true });
  if (controller.signal.aborted) for (const parent of parents.filter(Boolean)) parent.removeEventListener("abort", abort);
  return controller;
}
function createReviewController({ ctx, signal, button, markdown, onRated }) {
  const owner = lifetime(signal, ctx.signal);
  let active = null;
  const dispose = () => {
    owner.abort();
    active?.close();
  };
  owner.signal.addEventListener("abort", () => active?.close(), { once: true });
  function present(scope, practiceCards) {
    const practice = practiceCards !== void 0;
    active?.close();
    if (owner.signal.aborted) return;
    const session = lifetime(owner.signal);
    let practiceIndex = 0;
    let handle, closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      session.abort();
      if (active?.close === close) active = null;
      handle?.dispose();
    };
    active = { close };
    const mount = (container, hostSignal) => {
      if (closed || session.signal.aborted || hostSignal.aborted) return;
      const content = lifetime(session.signal, hostSignal);
      const root = el2("div", `fc-root fc-review-surface${practice ? " fc-practice-surface" : ""}`);
      root.tabIndex = -1;
      const stage = el2("div", "fc-review-stage"), title = el2("h2", "fc-review-title");
      stage.tabIndex = -1;
      stage.setAttribute("role", "group");
      stage.setAttribute("aria-label", practice ? "Flashcard practice" : "Flashcard review");
      stage.setAttribute("data-plugin-initial-focus", "");
      title.hidden = true;
      const card = el2("div", "fc-review-card"), footer = el2("div", "fc-review-footer"), bottom = el2("div", "fc-review-bottom");
      const practiceNote = practice ? el2("p", "fc-review-meta fc-practice-note", "Practice mode does not change your review schedule.") : null;
      stage.append(title, card, bottom, footer);
      root.append(stage);
      if (practiceNote) root.append(practiceNote);
      container.append(root);
      let cardScope = null, timer = null, revealAction = null, rateAction = null, advanceAction = null, revealed = false;
      const focusOwned = () => {
        if (!content.signal.aborted && root.contains(document.activeElement)) root.focus({ preventScroll: true });
      };
      const clearWait = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
      };
      const cleanup = () => {
        clearWait();
        cardScope?.abort();
        root.remove();
      };
      content.signal.addEventListener("abort", cleanup, { once: true });
      function reset() {
        if (card.contains(document.activeElement) || footer.contains(document.activeElement) || title.contains(document.activeElement)) focusOwned();
        clearWait();
        cardScope?.abort();
        cardScope = lifetime(content.signal);
        revealAction = null;
        rateAction = null;
        advanceAction = null;
        revealed = false;
        title.textContent = "";
        title.hidden = true;
        card.hidden = true;
        card.replaceChildren();
        footer.replaceChildren();
        bottom.replaceChildren();
        return cardScope.signal;
      }
      function question(ticket, cs, count2) {
        card.hidden = false;
        markdown(card, ticket.question, cs);
        const answer = el2("div", "fc-answer"), actions = el2("div", "fc-actions"), error = el2("p", "fc-error");
        error.setAttribute("role", "alert");
        card.append(answer);
        footer.append(actions, error);
        if (count2 !== void 0) bottom.append(el2("p", "fc-review-remaining", count2));
        return { answer, actions, error };
      }
      function control(parent, label, action, cs, hint, options = {}) {
        const wrapper = el2("div", "fc-rating");
        parent.append(wrapper);
        const handle2 = button(wrapper, label, action, cs, options);
        wrapper.append(el2("span", "fc-shortcut", hint));
        return handle2;
      }
      function nextPractice() {
        if (content.signal.aborted) return;
        const cs = reset(), index = practiceIndex, cue = practiceCards[index];
        if (!cue) {
          footer.append(el2("p", "fc-review-meta", "Practice complete."));
          return;
        }
        const remaining = practiceCards.length - index - 1;
        const { answer, actions } = question(cue, cs, `${remaining} ${remaining === 1 ? "card" : "cards"} remaining`);
        let revealButton;
        revealAction = () => {
          if (revealed || cs.aborted || index !== practiceIndex) return;
          focusOwned();
          revealed = true;
          title.textContent = cue.propositionName;
          title.hidden = false;
          markdown(answer, cue.answer, cs);
          revealButton.dispose();
          actions.replaceChildren();
          advanceAction = () => {
            if (cs.aborted || !revealed || index !== practiceIndex) return;
            focusOwned();
            practiceIndex++;
            nextPractice();
          };
          control(actions, "Next", () => advanceAction?.(), cs, "Space", { variant: "outline" });
        };
        revealButton = control(actions, "Reveal answer", () => revealAction?.(), cs, "Space", { variant: "outline" });
      }
      const retry = (parent, cs) => button(parent, "Retry next card", nextReview, cs);
      async function nextReview() {
        if (content.signal.aborted) return;
        const pending = reset();
        footer.append(el2("p", "fc-review-meta", "Loading next card\u2026"));
        try {
          const result = await ctx.call("next-review", scope);
          if (pending.aborted) return;
          const cs = reset();
          if (!result.ticket) {
            footer.append(el2("p", "fc-review-meta", result.nextDue ? `No cards ready. Next due ${new Date(result.nextDue).toLocaleString()}.` : "No cards due in this selection."));
            if (result.nextDue) {
              const arm = () => {
                if (cs.aborted) return;
                const delay = result.nextDue - Date.now();
                timer = setTimeout(() => {
                  timer = null;
                  if (cs.aborted) return;
                  if (delay > 2147483647) arm();
                  else void nextReview();
                }, Math.min(2147483647, Math.max(100, delay)));
              };
              arm();
            }
            return;
          }
          const ticket = result.ticket;
          const { answer, actions, error } = question(ticket, cs, result.remaining === void 0 ? void 0 : `${result.remaining} ready`);
          let revealButton, retryButton, revealBusy = false, ratingBusy = false;
          const requests = /* @__PURE__ */ new Map();
          const failed = (cause) => {
            if (cs.aborted) return;
            error.textContent = message(cause);
            if (!retryButton) retryButton = retry(footer, cs);
          };
          revealAction = async () => {
            if (revealBusy || revealed || cs.aborted) return;
            focusOwned();
            revealBusy = true;
            revealButton.update({ disabled: true });
            try {
              const result2 = await ctx.call("reveal-review", { ticketId: ticket.id });
              if (cs.aborted) return;
              revealed = true;
              error.textContent = "";
              title.textContent = ticket.propositionName;
              title.hidden = false;
              markdown(answer, result2.answer, cs);
              focusOwned();
              revealButton.dispose();
              actions.replaceChildren();
              const ratingButtons = [];
              rateAction = async (rating) => {
                if (ratingBusy || cs.aborted) return;
                focusOwned();
                ratingBusy = true;
                ratingButtons.forEach((handle2) => handle2.update({ disabled: true }));
                if (!requests.has(rating)) requests.set(rating, crypto.randomUUID());
                let accepted = false;
                try {
                  await ctx.call("rate-review", { ticketId: ticket.id, rating, requestId: requests.get(rating) });
                  accepted = true;
                } catch (cause) {
                  failed(cause);
                  return;
                } finally {
                  ratingBusy = false;
                  if (!cs.aborted && !accepted) ratingButtons.forEach((handle2) => handle2.update({ disabled: false }));
                }
                try {
                  void Promise.resolve(onRated?.()).catch(() => {
                  });
                } catch {
                }
                if (!cs.aborted) await nextReview();
              };
              ratings.forEach((label, index) => ratingButtons.push(control(actions, `${label} \xB7 ${interval(result2.intervals[index + 1])}`, () => rateAction?.(index + 1), cs, String(index + 1), ratingOptions(label))));
            } catch (cause) {
              failed(cause);
            } finally {
              revealBusy = false;
              if (!cs.aborted && !revealed) {
                revealButton.update({ disabled: false });
              }
            }
          };
          revealButton = control(actions, "Reveal answer", () => revealAction?.(), cs, "Space", { variant: "outline" });
        } catch (cause) {
          if (pending.aborted) return;
          const cs = reset();
          const error = el2("p", "fc-error", message(cause));
          error.setAttribute("role", "alert");
          footer.append(error);
          retry(footer, cs);
        }
      }
      const keydown = (event) => {
        const target = event.target;
        if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || target?.closest?.("input,textarea,select,a,[contenteditable]:not([contenteditable=false])")) return;
        const space = event.code === "Space" || event.key === " ";
        if (!practice && revealed && space && target?.closest?.(".fc-rating")) {
          event.preventDefault();
          return;
        }
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (!practice && revealed && space) {
          event.preventDefault();
          return;
        }
        if (event.repeat || target?.closest?.("button")) return;
        if (space) {
          event.preventDefault();
          if (!revealed) void revealAction?.();
          else if (practice) advanceAction?.();
        } else if (!practice && revealed && /^[1-4]$/.test(event.key)) {
          event.preventDefault();
          void rateAction?.(Number(event.key));
        }
      };
      root.addEventListener("keydown", keydown);
      content.signal.addEventListener("abort", () => root.removeEventListener("keydown", keydown), { once: true });
      if (practice) nextPractice();
      else void nextReview();
      return () => content.abort();
    };
    try {
      handle = ctx.ui.openSurface({ title: practice ? "Flashcard practice" : "Flashcard review", background: "dimmed", content: mount, onClose: close }, { signal: session.signal });
      if (closed) handle.dispose();
    } catch (cause) {
      close();
      throw cause;
    }
  }
  return { open: (scope) => present(scope), openPractice: (cards) => present(void 0, cards), dispose };
}

// src/dashboard.js
var states = [["new", "New"], ["learning", "Learning"], ["review", "Review"], ["relearning", "Relearning"]];
var svgNamespace = "http://www.w3.org/2000/svg";
var count = (value) => Number.isFinite(value) && value > 0 ? value : 0;
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
}
function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS(svgNamespace, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== void 0) node.textContent = text;
  return node;
}
function dateLabels(day) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || "");
  if (!parts) return { weekday: "", date: day || "", full: day || "" };
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12);
  return {
    weekday: date.toLocaleDateString(void 0, { weekday: "short" }),
    date: date.toLocaleDateString(void 0, { month: "short", day: "numeric" }),
    full: date.toLocaleDateString(void 0, { weekday: "short", month: "short", day: "numeric" })
  };
}
function mountDashboard({ container, signal }) {
  const root = element("section", "fc-dashboard");
  root.setAttribute("aria-label", "Spaced repetition");
  const heading = element("h2", "fc-dashboard-heading", "Spaced repetition");
  const loading = element("p", "fc-muted", "Loading statistics\u2026");
  loading.setAttribute("role", "status");
  const stateTitle = element("h3", "", "Current states");
  const stateBar = element("div", "fc-state-bar");
  stateBar.setAttribute("aria-hidden", "true");
  const legend = element("ul", "fc-state-legend");
  const stateCaption = element("p", "fc-chart-caption", "Active propositions with at least one cue.");
  const charts = element("div", "fc-chart-grid");
  root.append(heading, loading, stateTitle, stateBar, legend, stateCaption, charts);
  const stateNodes = states.map(([key, label]) => {
    const segment = element("span", "fc-state-segment");
    segment.dataset.state = key;
    stateBar.append(segment);
    const item = element("li");
    item.dataset.state = key;
    const name = element("span", "", label), value = element("strong", "", "0");
    item.append(name, document.createTextNode(" "), value);
    legend.append(item);
    return { key, label, segment, value };
  });
  function chart(kind, title, caption) {
    const figure = element("figure", "fc-chart"), chartTitle = element("h3", "", title);
    figure.dataset.chart = kind;
    const scroll = element("div", "fc-chart-scroll");
    const svg = svgElement("svg", { class: "fc-chart-svg", role: "img", width: "100%", preserveAspectRatio: "xMidYMid meet" });
    scroll.append(svg);
    figure.append(chartTitle, scroll, element("figcaption", "fc-chart-caption", caption));
    charts.append(figure);
    return { title, svg };
  }
  const due = chart("due", "Scheduled due", "Current scheduled due dates.");
  const activity = chart("activity", "Scheduled reviews", "Scheduled review ratings recorded each day.");
  let disposed = false;
  function renderChart(chart2, values, kind, width) {
    const rows = Array.isArray(values) ? values : [];
    const step = width / Math.max(rows.length, 1), baseline = 130;
    const maximum = Math.max(1, ...rows.map((row) => count(row.count)));
    chart2.svg.replaceChildren();
    chart2.svg.setAttribute("viewBox", `0 0 ${width} 184`);
    const descriptions = [];
    for (const [index, row] of rows.entries()) {
      const labels = dateLabels(row.day);
      const special = kind === "due" && row.day === null ? "Overdue" : kind === "due" && index === 1 || kind === "activity" && index === rows.length - 1 ? "Today" : "";
      const label = special || (kind === "due" ? labels.weekday : labels.date);
      const detail = special || labels.full, value = count(row.count);
      descriptions.push(`${detail}: ${value}`);
      const group = svgElement("g", { "data-day": row.day ?? "overdue" });
      const x = step * (index + 0.5), height = Math.max(1, value / maximum * 104);
      const bucket = kind === "activity" ? "activity" : special === "Overdue" ? "overdue" : special === "Today" ? "today" : "future";
      group.append(svgElement("rect", { class: "fc-chart-bar", "data-bucket": bucket, x: x - step * 0.3, y: baseline - height, width: step * 0.6, height, fill: "currentColor", opacity: ".6", rx: 2 }));
      group.append(svgElement("text", { class: "fc-chart-count", x, y: baseline - height - 6, "text-anchor": "middle", "font-size": 12, fill: "currentColor" }, String(value)));
      const dateText = svgElement("text", { class: "fc-chart-label", x, y: 151, "text-anchor": "middle", "font-size": 10, fill: "currentColor" });
      dateText.append(svgElement("tspan", { x }, label));
      if (kind === "due" && !special) dateText.append(svgElement("tspan", { class: "fc-chart-date", x, dy: 15 }, labels.date));
      group.append(dateText);
      chart2.svg.append(group);
    }
    const accessible = `${chart2.title}: ${descriptions.length ? descriptions.join("; ") : "No data available."}`;
    chart2.svg.setAttribute("aria-label", accessible);
  }
  function update(statistics) {
    if (disposed || signal.aborted) return;
    loading.hidden = statistics != null;
    const total = states.reduce((sum, [key]) => sum + count(statistics?.states?.[key]), 0);
    for (const node of stateNodes) {
      const value = count(statistics?.states?.[node.key]);
      node.value.textContent = String(value);
      node.segment.style.width = `${total ? value / total * 100 : 0}%`;
      node.segment.title = `${node.label}: ${value}`;
    }
    const width = Math.max(320, Array.isArray(statistics?.due) ? statistics.due.length * 64 : 0, Array.isArray(statistics?.activity) ? statistics.activity.length * 48 : 0);
    renderChart(due, statistics?.due, "due", width);
    renderChart(activity, statistics?.activity, "activity", width);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener("abort", dispose);
    root.remove();
  }
  if (signal.aborted) dispose();
  else {
    container.append(root);
    signal.addEventListener("abort", dispose, { once: true });
    update();
  }
  return { update, dispose };
}

// src/practice-queue.js
function buildPracticeCards(state, scope = {}) {
  if (!state) return [];
  const decks = scope.deckIds === void 0 ? null : new Set(scope.deckIds);
  const propositions = scope.propositionIds === void 0 ? null : new Set(scope.propositionIds);
  const cues = scope.cueIds === void 0 ? null : new Set(scope.cueIds);
  const byId = new Map(state.propositions.filter((p) => !p.archived).map((p) => [p.id, p]));
  const seen = /* @__PURE__ */ new Set(), cards = [];
  for (const deck of state.decks) {
    if (decks && !decks.has(deck.id)) continue;
    for (const id of deck.propositionIds) {
      const p = byId.get(id);
      if (!p || propositions && !propositions.has(id)) continue;
      for (const cue of p.cues) {
        if (cue.deleted || seen.has(cue.id) || cues && !cues.has(cue.id)) continue;
        seen.add(cue.id);
        cards.push({ propositionId: p.id, cueId: cue.id, propositionName: p.name, question: cue.question, answer: cue.answer });
      }
    }
  }
  return cards;
}

// src/main.js
var el3 = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
};
var message2 = (error) => error instanceof Error ? error.message : String(error);
var generationSummary = (source, tokens) => `${source} (approximately ${tokens.toLocaleString()} input tokens)`;
var uuid = () => crypto.randomUUID();
var flashcardsIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 4h12a1 1 0 0 1 1 1v12"/><rect x="3" y="8" width="14" height="13" rx="2"/><path d="M6 12h8M6 16h5"/></svg>';
var trashIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
var deletionBlocked = "Wait for generation to finish or cancel it before deleting content.";
var activeBatch = (batch) => batch && ["running", "pending", "queued", "cancelling"].includes(batch.status);
function lifetime2(...parents) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const parent of parents) {
    if (parent.aborted) abort();
    else parent.addEventListener("abort", abort, { once: true });
  }
  controller.signal.addEventListener("abort", () => {
    for (const parent of parents) parent.removeEventListener("abort", abort);
  }, { once: true });
  return controller;
}
function parseSteps(text) {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  if (!parts.length) throw new Error("Enter at least one learning step.");
  const values = parts.map((part) => {
    const match = /^(\d+)(m|h)?$/i.exec(part);
    if (!match) throw new Error("Use whole minutes, separated by spaces or commas (for example 1m 10m).");
    return Number(match[1]) * (match[2]?.toLowerCase() === "h" ? 60 : 1);
  });
  if (values.some((value, index) => !Number.isSafeInteger(value) || value <= 0 || value >= 1440 || index > 0 && value <= values[index - 1])) throw new Error("Steps must be increasing positive whole minutes, each shorter than one day.");
  return values;
}
function activate(ctx) {
  for (const capability of ["mountMarkdown", "mountKnowledgePicker", "mountTree", "openSurface", "openMenu"]) {
    if (typeof ctx.ui?.[capability] !== "function") throw new Error(`Flashcards requires a newer LearnHarness host with ctx.ui.${capability}. Please update LearnHarness.`);
  }
  let snapshot = null, refreshing = null, refreshAgain = false;
  const observers = /* @__PURE__ */ new Set(), registrations = [];
  const publish = (value) => {
    if (!value || ctx.signal.aborted || snapshot && value.revision < snapshot.revision) return;
    snapshot = value;
    for (const observer of observers) observer(value);
  };
  const report = (error) => {
    for (const observer of observers) observer(null, message2(error));
  };
  const refresh = () => {
    if (!observers.size || ctx.signal.aborted) return Promise.resolve();
    if (refreshing) {
      refreshAgain = true;
      return refreshing;
    }
    refreshing = (async () => {
      do {
        refreshAgain = false;
        try {
          const state = await ctx.call("get-state");
          if (observers.size) publish(state);
        } catch (error) {
          if (observers.size) report(error);
        }
      } while (refreshAgain && observers.size && !ctx.signal.aborted);
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };
  const observe = (fn, signal) => {
    observers.add(fn);
    signal.addEventListener("abort", () => observers.delete(fn), { once: true });
    if (snapshot) fn(snapshot);
    void refresh();
  };
  function widget(handle, signal) {
    if (signal.aborted) handle.dispose();
    else signal.addEventListener("abort", () => handle.dispose(), { once: true });
    return handle;
  }
  function button(parent, label, action, signal, options = {}) {
    const slot = el3("span", "fc-button");
    parent.append(slot);
    let pending = false, disabled = !!options.disabled;
    const handle = widget(ctx.ui.mountButton(slot, { label, size: "sm", variant: "outline", ...options, onClick: async () => {
      if (pending || signal.aborted || disabled) return;
      pending = true;
      handle.update({ disabled: true });
      try {
        await action();
      } finally {
        pending = false;
        if (!signal.aborted) handle.update({ disabled });
      }
    } }, { signal }), signal);
    return { update(props) {
      if (Object.hasOwn(props, "disabled")) disabled = props.disabled;
      handle.update({ ...props, disabled: pending || disabled });
    }, dispose: () => handle.dispose() };
  }
  function markdown(parent, text, signal) {
    const slot = el3("div", "fc-markdown");
    parent.append(slot);
    return widget(ctx.ui.mountMarkdown(slot, { text: text || "" }, { signal }), signal);
  }
  async function mutate(operation, input, signal) {
    const value = await ctx.call(operation, input);
    if (signal.aborted) return false;
    publish(value);
    return true;
  }
  function field(parent, label, value, type = "text") {
    const wrapper = el3("label", "fc-field"), input = el3(type === "textarea" ? "textarea" : "input", "fc-input");
    if (type !== "textarea") input.type = type;
    input.value = String(value ?? "");
    wrapper.append(el3("span", "fc-label", label), input);
    parent.append(wrapper);
    return input;
  }
  function dialog(title, parentSignal, build, closeLabel = "Cancel") {
    let handle;
    handle = ctx.ui.openDialog({ title, content: (container, hostSignal) => {
      const scope = lifetime2(parentSignal, hostSignal, ctx.signal), root = el3("div", "fc-root fc-dialog");
      const error = el3("p", "fc-error");
      error.setAttribute("role", "alert");
      root.append(el3("h2", "fc-dialog-heading", title));
      container.append(root);
      const actions = el3("div", "fc-actions");
      const run = (action) => async () => {
        try {
          await action();
        } catch (cause) {
          if (!scope.signal.aborted) error.textContent = message2(cause);
        }
      };
      build({ root, actions, signal: scope.signal, run, close: () => handle?.dispose() });
      root.append(error, actions);
      button(actions, closeLabel, () => handle?.dispose(), scope.signal, { variant: "ghost" });
      return () => {
        scope.abort();
        root.remove();
      };
    } }, { signal: parentSignal });
    return widget(handle, parentSignal);
  }
  async function confirmGeneration(propositionIds, signal, showError) {
    try {
      const preflight = await ctx.call("preflight", { propositionIds: [...propositionIds] });
      if (signal.aborted) return;
      const requestId = uuid();
      dialog("Generate flashcards", signal, ({ root, actions, signal: ds, run, close }) => {
        root.append(el3("p", "fc-muted", generationSummary(`${preflight.propositionCount} propositions`, preflight.estimatedTokens)));
        button(actions, "Start", run(async () => {
          if (await mutate("start-generation", { preflightId: preflight.id, requestId }, ds)) close();
        }), ds, { variant: "default" });
      });
    } catch (error) {
      if (!signal.aborted) showError(message2(error));
    }
  }
  function confirmFileGeneration(preflight, notices, signal, onStarted) {
    const requestId = uuid();
    dialog("Generate flashcards", signal, ({ root, actions, signal: ds, run, close }) => {
      root.append(el3("p", "fc-muted fc-file-name", generationSummary(preflight.name, preflight.estimatedTokens)));
      for (const notice of notices) root.append(el3("p", "fc-muted", notice));
      button(actions, "Start", run(async () => {
        const state = await ctx.call("start-generation", { preflightId: preflight.id, requestId });
        if (ds.aborted) return;
        publish(state);
        close();
        onStarted(state);
      }), ds, { variant: "default" });
    });
  }
  function cueFields(root, cue = {}) {
    return {
      question: field(root, "Question (Markdown)", cue.question, "textarea"),
      answer: field(root, "Answer (Markdown)", cue.answer, "textarea")
    };
  }
  function createCard(deck, proposition, signal, onCreated) {
    const requestId = uuid();
    dialog(proposition ? "Add cue" : "Create card", signal, ({ root, actions, signal: ds, run, close }) => {
      const name = proposition ? null : field(root, "Name", "");
      const { question, answer } = cueFields(root);
      button(actions, "Save", run(async () => {
        const created = await ctx.call(proposition ? "create-cue" : "create-card", {
          ...proposition ? { propositionId: proposition.id } : { deckId: deck.id, name: name.value },
          question: question.value,
          answer: answer.value,
          requestId
        });
        if (ds.aborted) return;
        publish(created.state);
        close();
        onCreated(created);
      }), ds, { variant: "default" });
    });
  }
  function editCue(proposition, cue, signal) {
    dialog("Edit cue", signal, ({ root, actions, signal: ds, run, close }) => {
      const { question, answer } = cueFields(root, cue);
      button(actions, "Save", run(async () => {
        if (await mutate("save-cue", { propositionId: proposition.id, cueId: cue.id, question: question.value, answer: answer.value, version: proposition.version }, ds)) close();
      }), ds, { variant: "default" });
    });
  }
  function deleteContents(scope, signal) {
    const state = snapshot;
    if (!state) return;
    const whole = new Set(scope.propositionIds ?? []);
    for (const d of state.decks) if (scope.deckIds?.includes(d.id)) for (const id of d.propositionIds) whole.add(id);
    const selected = new Set(scope.cueIds ?? []);
    const count2 = state.propositions.reduce((n, p) => n + p.cues.filter((c) => !c.deleted && (whole.has(p.id) || selected.has(c.id))).length, 0);
    const request = { ...structuredClone(scope), revision: state.revision, requestId: uuid() };
    dialog("Delete flashcards?", signal, ({ root, actions, signal: ds, run, close }) => {
      const description = el3("div", "fc-muted fc-delete-description");
      root.append(description);
      markdown(description, `${count2} ${count2 === 1 ? "cue" : "cues"} will be deleted from every deck. Targets with no remaining cues and their schedules will be removed. Past review statistics are kept. Learning-graph data is unchanged.`, ds);
      const label = el3("label", "fc-check"), emptyDecks = el3("input");
      emptyDecks.type = "checkbox";
      emptyDecks.checked = true;
      label.append(emptyDecks, document.createTextNode("Delete empty decks too"));
      root.append(label);
      const note = el3("p", "fc-muted");
      root.append(note);
      let submitted;
      const confirm = button(actions, "Delete", run(async () => {
        submitted ??= { ...request, deleteEmptyDecks: emptyDecks.checked };
        emptyDecks.disabled = true;
        if (await mutate("delete-content", submitted, ds)) close();
      }), ds, { variant: "destructive" });
      observe((current) => {
        if (!current) return;
        const blocked = !!activeBatch(current.batch);
        note.textContent = blocked ? deletionBlocked : "";
        confirm.update({ disabled: blocked, title: blocked ? deletionBlocked : void 0 });
      }, ds);
    });
  }
  function deleteCue(proposition, cue, signal) {
    deleteContents({ cueIds: [cue.id] }, signal);
  }
  function previewCue(proposition, cue, archive, signal) {
    dialog(proposition.name, signal, ({ root, actions, signal: ds, close }) => {
      root.classList.add("fc-preview-dialog");
      const card = el3("div", "fc-review-card fc-preview-card"), answer = el3("div", "fc-answer");
      markdown(card, cue.question, ds);
      markdown(answer, cue.answer, ds);
      card.append(answer);
      root.append(card);
      if (!archive) {
        button(actions, "Edit", () => {
          close();
          editCue(proposition, cue, signal);
        }, ds);
        const deletion = button(actions, "Delete", () => {
          close();
          deleteCue(proposition, cue, signal);
        }, ds, { variant: "destructive" });
        observe((current) => {
          if (!current) return;
          const blocked = !!activeBatch(current.batch);
          deletion.update({ disabled: blocked, title: blocked ? deletionBlocked : void 0 });
        }, ds);
      }
    }, "Close");
  }
  function memberships(proposition, state, signal) {
    dialog("Deck memberships", signal, ({ root, actions, signal: ds, run, close }) => {
      root.append(el3("p", "fc-muted", "Memberships share the same cues, schedule, and history. Keep at least one deck."));
      const choices = state.decks.map((deck) => {
        const label = el3("label", "fc-check"), input = el3("input");
        input.type = "checkbox";
        input.checked = proposition.memberships.includes(deck.id);
        label.append(input, document.createTextNode(deck.name));
        root.append(label);
        return { id: deck.id, input };
      });
      button(actions, "Save memberships", run(async () => {
        const deckIds = choices.filter((choice) => choice.input.checked).map((choice) => choice.id);
        if (!deckIds.length) throw new Error("Choose at least one deck.");
        if (await mutate("set-memberships", { propositionId: proposition.id, deckIds }, ds)) close();
      }), ds, { variant: "default" });
    });
  }
  function editDeck(deck, signal) {
    dialog(deck ? "Deck settings" : "Create deck", signal, ({ root, actions, signal: ds, run, close }) => {
      const name = field(root, "Deck name", deck?.name || ""), limit = deck ? field(root, "New propositions per day", deck.newLimit, "number") : null;
      if (limit) {
        limit.min = "0";
        limit.step = "1";
      }
      button(actions, deck ? "Save" : "Create", run(async () => {
        if (!name.value.trim()) throw new Error("Enter a deck name.");
        const input = deck ? { id: deck.id, name: name.value, newLimit: Number(limit.value) } : { name: name.value };
        if (await mutate(deck ? "save-deck" : "create-deck", input, ds)) close();
      }), ds, { variant: "default" });
      if (deck) {
        const deletion = button(actions, "Delete deck\u2026", () => {
          close();
          deleteContents({ deckIds: [deck.id] }, signal);
        }, ds, { variant: "destructive" });
        observe((current) => {
          if (!current) return;
          const blocked = !!activeBatch(current.batch);
          deletion.update({ disabled: blocked, title: blocked ? deletionBlocked : void 0 });
        }, ds);
      }
    });
  }
  function mountLibrary(container, hostSignal) {
    const view = lifetime2(hostSignal, ctx.signal), signal = view.signal;
    const root = el3("div", "fc-root fc-library"), toolbar = el3("div", "fc-toolbar"), error = el3("p", "fc-error");
    error.setAttribute("role", "alert");
    const showError = (text) => {
      if (!signal.aborted) error.textContent = text;
    };
    const guarded = (action) => async () => {
      try {
        await action();
      } catch (cause) {
        showError(message2(cause));
      }
    };
    const review = createReviewController({ ctx, signal, button, markdown, onRated: () => {
      void refresh();
    } });
    const practice = (scope) => review.openPractice(buildPracticeCards(snapshot, scope));
    const pickerSlot = el3("div", "fc-picker"), fileInput = el3("input"), fileStatus = el3("p", "fc-muted fc-file-status");
    const canConvertFiles = typeof ctx.documents?.toMarkdown === "function";
    fileInput.type = "file";
    fileInput.multiple = false;
    fileInput.hidden = true;
    fileInput.setAttribute("aria-label", "Choose a file for flashcards");
    fileStatus.setAttribute("role", "status");
    let generationIds = [], generationButton, fileButton, filePreparing = false, cleanupMessage = null;
    function updateGenerationButtons() {
      const busy = filePreparing || !!activeBatch(snapshot?.batch);
      generationButton?.update({ disabled: !generationIds.length || busy });
      fileButton?.update({ disabled: !canConvertFiles || busy });
    }
    const picker = widget(ctx.ui.mountKnowledgePicker(pickerSlot, { value: generationIds, onChange: (ids) => {
      generationIds = [...ids];
      picker.update({ value: generationIds });
      updateGenerationButtons();
    } }, { signal }), signal);
    toolbar.append(pickerSlot);
    generationButton = button(toolbar, "Generate", () => confirmGeneration(generationIds, signal, showError), signal, { disabled: true, variant: "default" });
    fileButton = button(toolbar, "Generate from file\u2026", () => fileInput.click(), signal, { disabled: !canConvertFiles, title: canConvertFiles ? void 0 : "Update LearnHarness to generate flashcards from files." });
    toolbar.append(fileInput);
    const deckPanel = el3("section", "fc-deck-panel"), deckToolbar = el3("div", "fc-deck-toolbar");
    deckPanel.setAttribute("aria-label", "Decks");
    const searchLabel = el3("label", "fc-search"), search = el3("input", "fc-input");
    search.type = "search";
    search.placeholder = "Search decks, propositions, and cues";
    search.setAttribute("aria-label", "Search flashcards");
    searchLabel.append(search);
    const batchArea = el3("div"), selectionActions = el3("div", "fc-actions fc-selection-actions"), selectionCount = el3("span", "fc-muted"), treeSlot = el3("div", "fc-tree");
    const scopeActions = el3("div", "fc-actions fc-scope-actions"), selectionSummary = el3("div", "fc-selection-summary");
    selectionSummary.append(selectionCount);
    selectionActions.append(scopeActions, selectionSummary);
    let selection = { cueIds: [], propositionIds: [], count: 0 }, tree, hasPracticeCards = false;
    const currentScope = () => selection.count ? { cueIds: [...selection.cueIds], propositionIds: [...selection.propositionIds] } : {};
    const reviewAction = button(scopeActions, "Review all", () => review.open(currentScope()), signal);
    const practiceAction = button(scopeActions, "Practice all", () => practice(currentScope()), signal, { disabled: true });
    const deleteSlot = el3("span", "fc-delete-selected");
    const deleteAction = button(deleteSlot, "Delete selected", () => deleteContents({ cueIds: [...selection.cueIds], propositionIds: [...selection.emptyPropositionIds], deckIds: [...selection.emptyDeckIds] }, signal), signal, { icon: trashIcon, iconOnly: true, size: "icon-sm", variant: "ghost", title: "Delete selected" });
    const clearSelection = button(selectionSummary, "Clear", () => tree.clearSelection(), signal, { variant: "ghost", disabled: true });
    const updateSelection = () => {
      const selected = selection.count > 0;
      selectionCount.textContent = `${selection.count} selected`;
      reviewAction.update({ label: selected ? "Review selected" : "Review all", disabled: selected && !selection.cueIds.length });
      practiceAction.update({ label: selected ? "Practice selected" : "Practice all", disabled: selected ? !selection.cueIds.length : !hasPracticeCards });
      const blocked = !!activeBatch(snapshot?.batch);
      deleteAction.update({ disabled: !selected || blocked, title: blocked ? deletionBlocked : "Delete selected" });
      if (selected) scopeActions.append(deleteSlot);
      else deleteSlot.remove();
      clearSelection.update({ disabled: !selected });
    };
    updateSelection();
    deckToolbar.append(searchLabel);
    button(deckToolbar, "Create deck", () => editDeck(null, signal), signal);
    deckPanel.append(deckToolbar, selectionActions, treeSlot);
    const dashboardSlot = el3("div", "fc-dashboard-slot");
    root.append(toolbar, fileStatus, error, batchArea, deckPanel, dashboardSlot);
    container.append(root);
    const dashboard = mountDashboard({ container: dashboardSlot, signal });
    tree = mountLibraryTree({
      ctx,
      container: treeSlot,
      signal,
      button,
      onReview: (scope) => review.open(scope),
      onPreview: (p, cue, archive) => previewCue(p, cue, archive, signal),
      onEdit: (p, cue) => editCue(p, cue, signal),
      onDelete: (p, cue) => deleteCue(p, cue, signal),
      onCreateCard: (deck) => createCard(deck, null, signal, (created) => revealCreatedCard(created, deck.id)),
      onCreateCue: (p, deck) => createCard(deck, p, signal, (created) => revealCreatedCard(created, deck.id)),
      onDeckSettings: (deck) => editDeck(deck, signal),
      onMemberships: (p) => memberships(p, snapshot, signal),
      onReorder: (input) => mutate("reorder", input, signal),
      onRename: (id, name) => mutate("save-deck", { id, name }, signal),
      onSelection: (value) => {
        selection = value;
        updateSelection();
      },
      onError: showError
    });
    const revealDeck = (id, propositionId) => {
      if (signal.aborted || !id) return;
      search.value = "";
      tree.update(snapshot, "");
      tree.revealDeck(id, propositionId);
    };
    const revealCreatedCard = (created, preferredDeckId) => {
      if (signal.aborted) return;
      const p = snapshot.propositions.find((p2) => p2.id === created.propositionId);
      if (!p) return;
      revealDeck(p.memberships.includes(preferredDeckId) ? preferredDeckId : p.memberships[0], p.id);
    };
    fileInput.addEventListener("change", async () => {
      const files = [...fileInput.files || []];
      fileInput.value = "";
      if (signal.aborted || !canConvertFiles || filePreparing || activeBatch(snapshot?.batch) || !files.length) return;
      if (files.length !== 1) {
        showError("Choose one file at a time.");
        return;
      }
      filePreparing = true;
      error.textContent = "";
      fileStatus.textContent = "Converting file\u2026";
      updateGenerationButtons();
      try {
        const converted = await ctx.documents.toMarkdown(files[0], { signal });
        if (signal.aborted) return;
        fileStatus.textContent = "Preparing generation\u2026";
        const preflight = await ctx.call("preflight-file", { name: converted.name, markdown: converted.markdown });
        if (signal.aborted) return;
        if (preflight.existingSourceId) {
          const opened = await ctx.call("open-file-deck", { sourceId: preflight.existingSourceId });
          if (signal.aborted) return;
          publish(opened.state);
          revealDeck(opened.deckId);
        } else confirmFileGeneration(preflight, converted.notices, signal, (state) => revealDeck(state.batch?.deckId));
      } catch (cause) {
        if (!signal.aborted) showError(message2(cause));
      } finally {
        if (!signal.aborted) {
          filePreparing = false;
          fileStatus.textContent = "";
          updateGenerationButtons();
        }
      }
    }, { signal });
    const retryFileGeneration = async (batchId) => {
      try {
        const preflight = await ctx.call("preflight-file-retry", { batchId });
        if (!signal.aborted) confirmFileGeneration(preflight, [], signal, (state) => revealDeck(state.batch?.deckId));
      } catch (cause) {
        if (!signal.aborted) showError(message2(cause));
      }
    };
    let batchScope = lifetime2(signal);
    function renderBatch(batch) {
      batchScope.abort();
      batchScope = lifetime2(signal);
      batchArea.replaceChildren();
      const emptyFileResult = batch?.kind === "file" && batch.status === "completed" && batch.added === 0;
      if (!batch || batch.status === "completed" && !batch.error && !batch.chunks.some((chunk) => chunk.error) && !emptyFileResult) return;
      const bs = batchScope.signal, panel = el3("section", "fc-batch");
      batchArea.append(panel);
      if (batch.kind === "file") panel.append(el3("p", "fc-muted fc-file-name", batch.name));
      panel.append(el3("p", "", `Generation: ${batch.status} \xB7 ${batch.completed}/${batch.total} chunks \xB7 ${batch.added} cues added`));
      if (emptyFileResult) panel.append(el3("p", "", "No flashcards were generated from this file."));
      for (const chunk of batch.chunks.filter((chunk2) => chunk2.error)) panel.append(el3("p", "fc-error", `Chunk ${chunk.id}: ${chunk.error}`));
      if (batch.error) panel.append(el3("p", "fc-error", batch.error));
      const controls = el3("div", "fc-actions");
      panel.append(controls);
      if (activeBatch(batch)) button(controls, "Cancel generation", guarded(() => mutate("cancel-generation", { batchId: batch.id }, signal)), bs);
      if (!activeBatch(batch) && (batch.kind === "file" ? batch.failedChunkIds?.length : batch.failedTargetIds?.length)) button(controls, "Retry failed\u2026", () => batch.kind === "file" ? retryFileGeneration(batch.id) : confirmGeneration(batch.failedTargetIds, signal, showError), bs);
      if (batch.error) button(controls, "Retry saving", guarded(() => mutate("resume-results", {}, signal)), bs);
    }
    search.addEventListener("input", () => {
      if (snapshot) tree.update(snapshot, search.value);
    }, { signal });
    observe((state, loadError) => {
      if (signal.aborted) return;
      if (loadError) {
        showError(loadError);
        return;
      }
      if (state.cleanupError) {
        cleanupMessage = state.cleanupError;
        showError(cleanupMessage);
      } else if (cleanupMessage && error.textContent === cleanupMessage) {
        error.textContent = "";
        cleanupMessage = null;
      }
      updateGenerationButtons();
      renderBatch(state.batch);
      tree.update(state, search.value);
      hasPracticeCards = state.propositions.some((p) => !p.archived && p.cues.some((c) => !c.deleted));
      updateSelection();
      dashboard.update(state.statistics);
    }, signal);
    return () => {
      view.abort();
      review.dispose();
      tree.dispose();
      dashboard.dispose();
      root.remove();
    };
  }
  function mountSettings(container, hostSignal) {
    const scope = lifetime2(hostSignal, ctx.signal), signal = scope.signal;
    const root = el3("div", "fc-root fc-settings"), error = el3("p", "fc-error"), fields = el3("div"), modelArea = el3("div", "fc-model-settings");
    error.setAttribute("role", "alert");
    root.append(fields, modelArea, error);
    container.append(root);
    let initialized = false, rows, followRows, modelPicker, thinkingPicker, modelPickers, modelRow, thinkingRow, catalog = null;
    let overrideDraft = false, modelBusy = false;
    const followingCheap = (settings) => !overrideDraft && !settings.modelOverride && settings.thinkingOverride == null;
    const showError = (cause) => {
      if (!signal.aborted) error.textContent = message2(cause);
    };
    const save = async (patch) => {
      try {
        const state = await ctx.call("save-settings", patch);
        if (signal.aborted) return;
        error.textContent = "";
        publish(state);
        rows?.update({ rows: settingsRows(snapshot.settings) });
        updateModels(snapshot.settings);
      } catch (cause) {
        showError(cause);
        throw cause;
      }
    };
    const settingsRows = (settings) => {
      const row = (key, label, value, type, parse = (value2) => value2, extras = {}) => ({ key, label, value, type, ...extras, onChange: async (value2) => {
        try {
          await save({ [key]: parse(value2) });
        } catch (cause) {
          showError(cause);
          throw cause;
        }
      } });
      return [
        row("retention", "Desired retention (%)", settings.retention * 100, "number", (value) => Number(value) / 100, { min: 70, max: 99, step: 1 }),
        row("learningSteps", "Learning steps (minutes)", settings.learningSteps.map((value) => `${value}m`).join(" "), "text", parseSteps),
        row("relearningSteps", "Relearning steps (minutes)", settings.relearningSteps.map((value) => `${value}m`).join(" "), "text", parseSteps),
        row("dayStart", "Day starts at (hour)", settings.dayStart, "number", Number, { min: 0, max: 23, step: 1 }),
        row("chunkBudget", "Generation chunk budget (estimated tokens)", settings.chunkBudget, "number", Number, { min: 1, step: 1 })
      ];
    };
    const changeModels = async (patch) => {
      if (modelBusy || signal.aborted) return;
      modelBusy = true;
      updateModels(snapshot.settings);
      try {
        await save(patch);
        if (!signal.aborted) overrideDraft = false;
      } finally {
        modelBusy = false;
        if (!signal.aborted) updateModels(snapshot.settings);
      }
    };
    const followCheapRow = (settings) => ({
      key: "followCheapSlot",
      label: "Model",
      description: "Follow cheap slot",
      type: "toggle",
      value: followingCheap(settings),
      disabled: modelBusy,
      onChange: async (follow) => {
        if (modelBusy || signal.aborted) return;
        if (follow) await changeModels({ modelOverride: null, thinkingOverride: null });
        else if (catalog?.slots?.cheap?.model) await changeModels({ modelOverride: catalog.slots.cheap.model, thinkingOverride: catalog.slots.cheap.thinkingLevel ?? null });
        else {
          overrideDraft = true;
          updateModels(snapshot.settings);
        }
      }
    });
    const updateModels = (settings) => {
      const following = followingCheap(settings), model = settings.modelOverride || catalog?.slots?.cheap?.model || void 0;
      followRows?.update({ rows: [followCheapRow(settings)] });
      if (modelPickers) modelPickers.hidden = following;
      if (modelRow) modelRow.hidden = following;
      if (thinkingRow) thinkingRow.hidden = following;
      modelPicker?.update({ value: model, disabled: following || modelBusy });
      thinkingPicker?.update({ model, value: settings.thinkingOverride ?? (settings.modelOverride ? void 0 : catalog?.slots?.cheap?.thinkingLevel), disabled: following || modelBusy || !model });
    };
    observe((state, loadError) => {
      if (signal.aborted) return;
      if (loadError) {
        showError(loadError);
        return;
      }
      if (!initialized) {
        initialized = true;
        rows = widget(ctx.ui.mountSettingsRows(fields, { rows: settingsRows(state.settings) }, { signal }), signal);
        const followSlot = el3("div", "fc-follow-cheap-row");
        modelPickers = el3("div", "fc-model-overrides");
        modelRow = el3("div", "fc-model-row");
        thinkingRow = el3("div", "fc-thinking-row");
        const modelSlot = el3("div"), thinkingSlot = el3("div");
        modelRow.append(modelSlot);
        thinkingRow.append(thinkingSlot);
        modelPickers.append(modelRow, thinkingRow);
        modelArea.append(followSlot, modelPickers);
        followRows = widget(ctx.ui.mountSettingsRows(followSlot, { rows: [followCheapRow(state.settings)] }, { signal }), signal);
        modelPicker = widget(ctx.ui.mountModelPicker(modelSlot, { value: state.settings.modelOverride || void 0, onChange: async (value) => {
          try {
            await changeModels({ modelOverride: value, thinkingOverride: null });
          } catch {
          }
        } }, { signal }), signal);
        thinkingPicker = widget(ctx.ui.mountThinkingPicker(thinkingSlot, { model: state.settings.modelOverride || void 0, value: state.settings.thinkingOverride ?? void 0, onChange: async (value) => {
          try {
            await changeModels({ thinkingOverride: value });
          } catch {
          }
        } }, { signal }), signal);
        updateModels(state.settings);
        void ctx.call("get-catalog").then((value) => {
          if (!signal.aborted) {
            catalog = value;
            updateModels(snapshot.settings);
          }
        }).catch(showError);
      } else {
        rows.update({ rows: settingsRows(state.settings) });
        updateModels(state.settings);
      }
    }, signal);
    return () => {
      scope.abort();
      root.remove();
    };
  }
  registrations.push(ctx.registerView({ id: "library", name: "Flashcards", mount: mountLibrary }));
  registrations.push(ctx.registerAction({ id: "open", name: "Flashcards", icon: flashcardsIcon, run: () => ctx.app.openView("library") }));
  registrations.push(ctx.placeAction({ id: "open-sidebar", actionId: "open", location: "sidebar" }));
  registrations.push(ctx.registerSettings(mountSettings));
  registrations.push(ctx.onNotification((event) => {
    if ((!event.pluginId || event.pluginId === ctx.manifest.id) && ["changed", "batch-changed"].includes(event.topic)) void refresh();
  }));
  registrations.push(ctx.onResync(() => {
    void refresh();
  }));
  registrations.push(ctx.onAppEvent((event) => {
    if (["sources-changed", "activity-changed", "chats-changed"].includes(event.type)) void refresh();
  }));
  const dispose = () => {
    for (const unregister of registrations.splice(0).reverse()) unregister();
    observers.clear();
  };
  ctx.cleanup(dispose);
  return dispose;
}
export {
  activate
};
