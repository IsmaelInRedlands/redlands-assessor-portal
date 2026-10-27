export default async function install(app) {
  const panelMount = app.getMount("assessor-search-panel");
  const layer = app.layers[app.config.layerId];
  const cleanups = [];
  let highlightHandle = null;
  let selectedGraphic = null;

  function el(tag, opts = {}, children = []) {
    const node = document.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (opts.text !== undefined) node.textContent = opts.text;
    if (opts.type) node.type = opts.type;
    if (opts.placeholder) node.placeholder = opts.placeholder;
    if (opts.value !== undefined) node.value = opts.value;
    if (opts.list) node.setAttribute("list", opts.list);
    if (opts.ariaLabel) node.setAttribute("aria-label", opts.ariaLabel);
    if (opts.style) Object.assign(node.style, opts.style);
    for (const child of children) node.appendChild(child);
    return node;
  }

  function clearHighlight() {
    if (highlightHandle) {
      highlightHandle.remove();
      highlightHandle = null;
    }
    if (selectedGraphic) {
      app.view.graphics.remove(selectedGraphic);
      selectedGraphic = null;
    }
  }

  async function highlightParcel(feature) {
    clearHighlight();
    try {
      const layerView = await app.view.whenLayerView(layer);
      highlightHandle = layerView.highlight(feature);
    } catch (error) {
      app.reportError(error);
    }
    if (feature?.geometry) {
      selectedGraphic = feature.clone ? feature.clone() : feature;
      selectedGraphic.symbol = {
        type: "simple-fill",
        color: [255, 225, 0, 0.22],
        outline: { color: [255, 153, 0, 1], width: 3 }
      };
      app.view.graphics.add(selectedGraphic);
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .rp-panel { font-family: Arial, Helvetica, sans-serif; color:#24384b; box-sizing:border-box; display:flex; flex-direction:column; gap:12px; min-width:0; }
    .rp-card { background:#fff; border:1px solid #d0d7de; border-radius:3px; box-shadow:0 1px 2px rgba(0,0,0,.08); overflow:hidden; min-width:0; }
    .rp-card-title { padding:10px 12px; border-bottom:1px solid #e1e4e8; font-size:14px; font-weight:700; color:#0c4778; background:#fbfdff; }
    .rp-card-content { padding:12px; }
    .rp-tabs { display:flex; border:1px solid #c4d5e6; border-radius:3px; overflow:hidden; margin-bottom:12px; }
    .rp-tab { flex:1; border:0; padding:9px 6px; background:#e9f2fb; color:#0c4778; cursor:pointer; font-weight:700; font-size:13px; }
    .rp-tab-active { background:#0072bc; color:#fff; }
    .rp-label { display:block; font-size:12px; font-weight:700; color:#4a5c6e; margin-bottom:5px; }
    .rp-input { width:100%; box-sizing:border-box; border:1px solid #b7c5d3; border-radius:3px; padding:10px; font-size:14px; background:#fff; min-width:0; }
    .rp-hint { font-size:12px; color:#687888; margin-top:6px; line-height:1.35; }
    .rp-actions { display:flex; gap:8px; margin-top:12px; }
    .rp-btn { border:1px solid #005b96; background:#0072bc; color:#fff; padding:9px 12px; border-radius:3px; font-weight:700; cursor:pointer; flex:1; }
    .rp-btn-secondary { background:#fff; color:#0c4778; border-color:#b7c5d3; }
    .rp-result { font-size:13px; line-height:1.45; min-height:78px; }
    .rp-muted { color:#687888; }
    .rp-result-row { display:grid; grid-template-columns:82px minmax(0,1fr); gap:8px; padding:5px 0; border-bottom:1px solid #edf0f2; min-width:0; }
    .rp-result-row b { color:#4b5f72; }
    .rp-result-row span { min-width:0; overflow-wrap:anywhere; }
    .rp-status { margin-top:10px; font-size:13px; color:#5d6d7c; min-height:18px; }
  `;

  const tabApn = el("button", { className: "rp-tab rp-tab-active", type: "button", text: "APN" });
  const tabAddress = el("button", { className: "rp-tab", type: "button", text: "Address" });
  const label = el("label", { className: "rp-label", text: "Enter APN" });
  const input = el("input", { className: "rp-input", type: "text", placeholder: "Example: 0171...", list: "rp-suggestions", ariaLabel: "Parcel search" });
  const datalist = el("datalist");
  datalist.id = "rp-suggestions";
  const hint = el("div", { className: "rp-hint", text: "Start typing for suggestions. Searches match partial APNs and addresses." });
  const status = el("div", { className: "rp-status" });
  const resultBox = el("div", { className: "rp-result" });
  const searchBtn = el("button", { className: "rp-btn", type: "button", text: "Search" });
  const clearBtn = el("button", { className: "rp-btn rp-btn-secondary", type: "button", text: "Clear" });
  let mode = "APN";
  let suggestTimer = null;

  const panel = el("div", { className: "rp-panel" }, [
    el("div", { className: "rp-card" }, [
      el("div", { className: "rp-card-title", text: "Search by parcel or address" }),
      el("div", { className: "rp-card-content" }, [
        el("div", { className: "rp-tabs" }, [tabApn, tabAddress]),
        label, input, datalist, hint,
        el("div", { className: "rp-actions" }, [searchBtn, clearBtn]),
        status
      ])
    ]),
    el("div", { className: "rp-card" }, [
      el("div", { className: "rp-card-title", text: "Parcel details" }),
      el("div", { className: "rp-card-content" }, [resultBox])
    ])
  ]);
  panelMount.replaceChildren(style, panel);

  function setMode(next) {
    mode = next;
    tabApn.className = next === "APN" ? "rp-tab rp-tab-active" : "rp-tab";
    tabAddress.className = next === "Address" ? "rp-tab rp-tab-active" : "rp-tab";
    label.textContent = next === "APN" ? "Enter APN" : "Enter address";
    input.placeholder = next === "APN" ? "Example: 0171..." : "Example: 380 New York St";
    input.value = "";
    datalist.replaceChildren();
    status.textContent = "";
  }
  function escSql(value) { return String(value).replaceAll("'", "''"); }
  function fieldForMode() { return mode === "APN" ? "APN" : "Address"; }

  async function suggest() {
    const value = input.value.trim();
    datalist.replaceChildren();
    if (value.length < 2) return;
    const field = fieldForMode();
    try {
      const q = layer.createQuery();
      q.where = `${field} LIKE '%${escSql(value)}%'`;
      q.outFields = ["APN", "Address"];
      q.returnGeometry = false;
      q.num = 8;
      const res = await layer.queryFeatures(q);
      for (const feature of res.features || []) {
        const option = document.createElement("option");
        const apn = feature.attributes?.APN ?? "";
        const addr = feature.attributes?.Address ?? "";
        option.value = mode === "APN" ? String(apn) : String(addr);
        option.label = `${apn} ${addr}`.trim();
        datalist.appendChild(option);
      }
    } catch (error) { app.reportError(error); }
  }

  function renderResult(attrs) {
    resultBox.replaceChildren();
    if (!attrs) {
      resultBox.appendChild(el("div", { className: "rp-muted", text: "Search for a parcel to view APN, address, zoning, and hazard details here." }));
      return;
    }
    for (const [name, value] of [["APN", attrs.APN], ["Address", attrs.Address], ["Use code", attrs.RedlandsUseCode], ["Land use", attrs.LANDUSE], ["Zoning", attrs.Zoning], ["Flood zone", attrs.FloodZone], ["Fire hazard", attrs.FireHazard]]) {
      resultBox.appendChild(el("div", { className: "rp-result-row" }, [el("b", { text: name }), el("span", { text: value == null || value === "" ? "—" : String(value) })]));
    }
  }

  async function runSearch() {
    const value = input.value.trim();
    if (!value) { status.textContent = "Enter an APN or address first."; return; }
    const field = fieldForMode();
    status.textContent = "Searching…";
    try {
      const q = layer.createQuery();
      q.where = `${field} LIKE '%${escSql(value)}%'`;
      q.outFields = ["APN", "Address", "RedlandsUseCode", "LANDUSE", "Zoning", "FloodZone", "FireHazard"];
      q.returnGeometry = true;
      q.num = 1;
      const res = await layer.queryFeatures(q);
      const feature = res.features?.[0];
      if (!feature) { clearHighlight(); renderResult(null); status.textContent = "No matching parcel found."; return; }
      renderResult(feature.attributes);
      await highlightParcel(feature);
      status.textContent = "Parcel found and highlighted on the map.";
      if (feature.geometry) await app.view.goTo({ target: feature.geometry, zoom: 19 });
    } catch (error) { status.textContent = "Search failed. Try another value."; app.reportError(error); }
  }

  renderResult(null);
  for (const [target, type, handler] of [[tabApn, "click", () => setMode("APN")], [tabAddress, "click", () => setMode("Address")], [searchBtn, "click", runSearch], [clearBtn, "click", () => { input.value = ""; datalist.replaceChildren(); status.textContent = ""; clearHighlight(); renderResult(null); }], [input, "keydown", (event) => { if (event.key === "Enter") runSearch(); }], [input, "input", () => { window.clearTimeout(suggestTimer); suggestTimer = window.setTimeout(suggest, 250); }]]) {
    target.addEventListener(type, handler);
    cleanups.push(() => target.removeEventListener(type, handler));
  }
  app.onCleanup(() => { window.clearTimeout(suggestTimer); clearHighlight(); for (const cleanup of cleanups) cleanup(); panelMount.replaceChildren(); });
}