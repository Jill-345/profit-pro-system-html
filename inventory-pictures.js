/* ==========================================================================
   DRR Bakery — pictures on the Inventory page (inventory.html > Bread Stock)

   1. "Add bread inventory": when you pick a bread, its picture shows up.
   2. "Today's Bread Stock" table: every bread gets a small picture beside its name.

   The picture is chosen from the bread's NAME (see bread-pictures.js), so a new
   bread shows the right picture without any extra step.
   This file does not change script.js - it only watches the page.
   ========================================================================== */
(function () {
  "use strict";
  var P = window.DRRBreadPics;
  if (!P) return;

  /* ---------- 1. picture in the add form ---------- */
  var select = document.getElementById("bs-bread-item");
  var frame = document.getElementById("bs-pic-frame");
  var label = document.getElementById("bs-pic-name");
  var row = document.getElementById("bs-pic-row");

  function selectedName() {
    if (!select || select.selectedIndex < 0 || !select.value) return "";
    return select.options[select.selectedIndex].textContent.trim();
  }

  function updateFormPicture() {
    if (!frame) return;
    var name = selectedName();
    row.hidden = !name;
    if (!name) { frame.innerHTML = ""; label.textContent = ""; return; }
    if (frame.getAttribute("data-for") === name) return;   // already showing it
    frame.setAttribute("data-for", name);
    P.fill(frame, name);
    label.textContent = name;
  }

  if (select) {
    select.addEventListener("change", updateFormPicture);
    // The list is filled in by script.js when the form opens (no "change" event), so watch it.
    new MutationObserver(function () { frame.removeAttribute("data-for"); updateFormPicture(); })
      .observe(select, { childList: true });
    updateFormPicture();
  }

  /* ---------- 2. thumbnails in the Bread Stock table ---------- */
  var body = document.getElementById("bread-stock-body");

  function decorateRows() {
    if (!body) return;
    body.querySelectorAll("tr").forEach(function (tr) {
      var cell = tr.firstElementChild;
      if (!cell || cell.colSpan > 1 || cell.querySelector(".bs-name-cell")) return;
      var name = cell.textContent.trim();
      if (!name) return;
      var thumb = document.createElement("span");
      thumb.className = "bs-thumb";
      P.fill(thumb, name);
      var text = document.createElement("span");
      text.className = "bs-thumb-name";
      text.textContent = name;
      var wrap = document.createElement("div");
      wrap.className = "bs-name-cell";
      wrap.appendChild(thumb);
      wrap.appendChild(text);
      cell.textContent = "";
      cell.appendChild(wrap);
    });
  }

  if (body) {
    var busy = false;
    new MutationObserver(function () {
      if (busy) return;
      busy = true;               // our own changes below must not trigger us again
      decorateRows();
      setTimeout(function () { busy = false; }, 0);
    }).observe(body, { childList: true });
    decorateRows();
  }
})();