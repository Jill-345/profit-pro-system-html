/* ==========================================================================
   DRR Bakery — bread pictures (shared)
   Used by: breads.html (Our Breads) and inventory.html (Bread Stock).

   Finds the picture that goes with a bread NAME. The name does not have to be
   exact: "Ube Loaf", "ube loaf", "Cheese Bread" and "Ube Loaf (big)" all work.

   PICTURES, in this order:
   1. A photo an Admin chose with "Change photo" on the Our Breads page.
   2. A photo you added to the project:  breads/<name>.jpg  (.png / .webp too).
   3. A drawn picture (built in here) so there is never an empty space.

   To teach it a new bread, add a line to BREADS below.
   ========================================================================== */
(function () {
  "use strict";

  var PHOTO_KEY = "drrBreadPhotos";
  var EXTS = ["jpg", "png", "webp"];

  var BREADS = [
    { name: "Spanish Bread",   slug: "spanish-bread",   group: "Bread",            shape: "roll",   c: ["#D9923F", "#B5701F", "#F2C778"], note: "Soft rolled bread with a buttery, sugary filling" },
    { name: "Cheesebread",     slug: "cheesebread",     group: "Bread",            shape: "roll",   c: ["#E5A94F", "#C4852B", "#FBE27A"], note: "Soft roll topped with melted cheese" },
    { name: "Chocoroll",       slug: "chocoroll",       group: "Bread",            shape: "swirl",  c: ["#6B3B22", "#4A2615", "#D9923F"], note: "Chocolate-filled swirl roll" },
    { name: "Pande Coco",      slug: "pande-coco",      group: "Bread",            shape: "round",  c: ["#D9923F", "#B5701F", "#FFF7E6"], note: "Sweet round bread with coconut filling" },
    { name: "Mojacko",         slug: "mojacko",         group: "Bread",            shape: "round",  c: ["#C98A4B", "#9F6429", "#F5E3C3"], note: "Soft, chewy bread with a sweet center" },
    { name: "Ube Loaf",        slug: "ube-loaf",        group: "Bread",            shape: "loaf",   c: ["#8E5BB5", "#6C3C94", "#C9A6E4"], note: "Purple yam loaf, soft and lightly sweet" },
    { name: "Ensaymada",       slug: "ensaymada",       group: "Bread",            shape: "swirl",  c: ["#EBB45E", "#C98A2C", "#FFFFFF"], note: "Buttery coiled bread with sugar and cheese" },
    { name: "Crinkles",        slug: "crinkles",        group: "Cookies & Sweets", shape: "cookie", c: ["#4A2A1C", "#2F170D", "#FFFFFF"], note: "Chocolate cookie rolled in powdered sugar" },
    { name: "Pande Hopia",     slug: "pande-hopia",     group: "Bread",            shape: "roll",   c: ["#D49A52", "#AA7330", "#F2D8A6"], note: "Soft bread with a mung bean hopia filling" },
    { name: "Ham and Cheese",  slug: "ham-and-cheese",  group: "Bread",            shape: "roll",   c: ["#D9923F", "#B5701F", "#F6A8A0"], note: "Soft roll with ham and cheese inside" },
    { name: "Cookies",         slug: "cookies",         group: "Cookies & Sweets", shape: "cookie", c: ["#D9A55B", "#B27A2C", "#5A3320"], note: "Freshly baked cookies" },
    { name: "Kalihim",         slug: "kalihim",         group: "Pastry",           shape: "flat",   c: ["#E2B66A", "#BC8A3A", "#F7E2B0"], note: "Flaky baked pastry" },
    { name: "Eggpie",          slug: "eggpie",          group: "Pastry",           shape: "pie",    c: ["#D9A55B", "#B27A2C", "#F4C93D"], note: "Creamy egg custard in a baked crust" },
    { name: "Hopia",           slug: "hopia",           group: "Pastry",           shape: "flat",   c: ["#E5C58B", "#C29A55", "#FBEED2"], note: "Flaky round pastry with a sweet filling" },
    { name: "Brownies",        slug: "brownies",        group: "Cookies & Sweets", shape: "bar",    c: ["#5A3320", "#3A1F12", "#8B5A3C"], note: "Fudgy chocolate squares" },
    { name: "Kababayan",       slug: "kababayan",       group: "Cookies & Sweets", shape: "cup",    c: ["#E8B65C", "#C28A2D", "#F7DB93"], note: "Small, soft sweet muffin with a golden top" },
    { name: "Torta",           slug: "torta",           group: "Cookies & Sweets", shape: "slice",  c: ["#F0D08A", "#CFA553", "#FFF6DA"], note: "Light, fluffy sponge cake" }
  ];


  function getPhotos() {
    try { return JSON.parse(localStorage.getItem(PHOTO_KEY)) || {}; } catch (e) { return {}; }
  }
  function savePhoto(slug, dataUrl) {
    var all = getPhotos();
    if (dataUrl) all[slug] = dataUrl; else delete all[slug];
    try { localStorage.setItem(PHOTO_KEY, JSON.stringify(all)); return true; }
    catch (e) { return false; }   // storage full
  }

  /* ---------- drawn pictures ---------- */
  function drawing(b) {
    var base = b.c[0], dark = b.c[1], top = b.c[2], g = "";
    var shadow = '<ellipse cx="100" cy="124" rx="62" ry="9" fill="#3E2723" opacity="0.14"/>';
    switch (b.shape) {
      case "loaf":
        g = '<path d="M34 112V80c0-22 20-36 66-36s66 14 66 36v32c0 4-3 7-7 7H41c-4 0-7-3-7-7Z" fill="' + base + '"/>' +
            '<path d="M34 86c0-22 20-36 66-36s66 14 66 36c-12-12-34-16-66-16s-54 4-66 16Z" fill="' + top + '" opacity="0.55"/>' +
            '<path d="M62 62l10 22M92 58l10 24M122 62l10 22" stroke="' + dark + '" stroke-width="5" stroke-linecap="round" opacity="0.6"/>';
        break;
      case "round":
        g = '<circle cx="100" cy="82" r="46" fill="' + base + '"/>' +
            '<path d="M58 70a46 46 0 0 1 84 0c-12-10-28-12-42-12s-30 2-42 12Z" fill="' + top + '" opacity="0.7"/>' +
            '<path d="M70 90c10 8 50 8 60 0" stroke="' + dark + '" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.5"/>';
        break;
      case "swirl":
        g = '<ellipse cx="100" cy="94" rx="56" ry="26" fill="' + dark + '"/>' +
            '<ellipse cx="100" cy="84" rx="56" ry="28" fill="' + base + '"/>' +
            '<path d="M100 84m-40 0a40 20 0 1 1 80 0a28 14 0 1 1-56 0a16 8 0 1 1 32 0" stroke="' + top + '" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.85"/>';
        break;
      case "cookie":
        g = '<circle cx="100" cy="82" r="48" fill="' + base + '"/>' +
            '<circle cx="100" cy="82" r="48" fill="none" stroke="' + dark + '" stroke-width="4" opacity="0.5"/>' +
            '<path d="M70 60l16 10M118 56l-8 18M138 84l-20 4M64 92l20 8M104 108l4-18M90 80l12 2" stroke="' + top + '" stroke-width="5" stroke-linecap="round" opacity="0.9"/>' +
            '<circle cx="82" cy="66" r="4.5" fill="' + top + '"/><circle cx="124" cy="72" r="4.5" fill="' + top + '"/><circle cx="110" cy="98" r="4.5" fill="' + top + '"/><circle cx="76" cy="96" r="4.5" fill="' + top + '"/>';
        break;
      case "pie":
        g = '<ellipse cx="100" cy="96" rx="62" ry="22" fill="' + dark + '"/>' +
            '<ellipse cx="100" cy="86" rx="62" ry="24" fill="' + base + '"/>' +
            '<ellipse cx="100" cy="86" rx="46" ry="15" fill="' + top + '"/>' +
            '<path d="M42 84c4-2 6-2 10 0s6 2 10 0M138 84c4-2 6-2 10 0s6 2 10 0" stroke="' + dark + '" stroke-width="3" fill="none" opacity="0.4"/>';
        break;
      case "flat":
        g = '<ellipse cx="100" cy="92" rx="58" ry="24" fill="' + dark + '"/>' +
            '<ellipse cx="100" cy="84" rx="58" ry="26" fill="' + base + '"/>' +
            '<ellipse cx="100" cy="84" rx="40" ry="16" fill="none" stroke="' + top + '" stroke-width="4" opacity="0.8"/>' +
            '<ellipse cx="100" cy="84" rx="20" ry="8" fill="none" stroke="' + top + '" stroke-width="4" opacity="0.8"/>';
        break;
      case "bar":
        g = '<path d="M40 76l60-24 60 24v28l-60 24-60-24Z" fill="' + dark + '"/>' +
            '<path d="M40 76l60-24 60 24-60 24Z" fill="' + base + '"/>' +
            '<path d="M70 72l30-12M100 84l36-14M64 84l24-10" stroke="' + top + '" stroke-width="5" stroke-linecap="round" opacity="0.8"/>';
        break;
      case "cup":
        g = '<path d="M56 94h88l-10 26H66Z" fill="' + dark + '"/>' +
            '<path d="M60 94c-8-8-4-40 40-40s48 32 40 40Z" fill="' + base + '"/>' +
            '<path d="M76 74c8-8 40-8 48 0" stroke="' + top + '" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.9"/>' +
            '<path d="M70 98l6 18M90 98l2 20M110 98l-2 20M130 98l-6 18" stroke="' + base + '" stroke-width="3" opacity="0.5"/>';
        break;
      case "slice":
        g = '<path d="M36 112V84l64-38 64 38v28Z" fill="' + dark + '"/>' +
            '<path d="M36 84l64-38 64 38-64 20Z" fill="' + top + '"/>' +
            '<path d="M36 100h128" stroke="' + base + '" stroke-width="10" opacity="0.8"/>' +
            '<path d="M36 100l64 20 64-20" fill="none" stroke="' + dark + '" stroke-width="2" opacity="0.4"/>';
        break;
      default: /* roll */
        g = '<ellipse cx="100" cy="86" rx="64" ry="32" fill="' + base + '"/>' +
            '<ellipse cx="100" cy="76" rx="56" ry="20" fill="' + top + '" opacity="0.65"/>' +
            '<path d="M60 68l12 40M86 62l10 46M114 62l-10 46M140 68l-12 40" stroke="' + dark + '" stroke-width="4" stroke-linecap="round" opacity="0.55"/>';
    }
    return '<svg class="bread-art" viewBox="0 0 200 150" role="img" aria-label="Drawing of ' + b.name + '" xmlns="http://www.w3.org/2000/svg">' +
           '<rect width="200" height="150" fill="#F6EFE2"/>' + shadow + g + '</svg>';
  }


  /* ---------- matching a name to a bread ---------- */
  // Other ways people spell a bread -> the bread they mean.
  var ALIASES = {
    "pandecoco": "pande-coco", "pandecoconut": "pande-coco", "pandecoco": "pande-coco",
    "cheeserolls": "cheesebread", "cheeseroll": "cheesebread",
    "hamcheese": "ham-and-cheese", "hamandcheeseroll": "ham-and-cheese",
    "egg-pie": "eggpie", "eggpies": "eggpie",
    "ubebread": "ube-loaf", "ubeloaves": "ube-loaf",
    "chocolaterolls": "chocoroll", "chocolateroll": "chocoroll",
    "spanishbreads": "spanish-bread",
    "crinkle": "crinkles", "brownie": "brownies", "cookie": "cookies"
  };
  var GENERIC = { name: "Bread", slug: "", group: "Bread", shape: "roll", c: ["#D9A55B", "#B27A2C", "#F2D8A6"], note: "" };

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

  function bySlug(slug) {
    for (var i = 0; i < BREADS.length; i++) if (BREADS[i].slug === slug) return BREADS[i];
    return null;
  }

  function find(name) {
    var n = norm(name);
    if (!n) return GENERIC;
    var i, k;
    for (i = 0; i < BREADS.length; i++) if (norm(BREADS[i].name) === n) return BREADS[i];          // exact
    if (ALIASES[n] && bySlug(ALIASES[n])) return bySlug(ALIASES[n]);                              // spelling variant
    var best = null, bestLen = 0;                                                                  // contains, longest wins
    for (i = 0; i < BREADS.length; i++) {
      k = norm(BREADS[i].name);
      if (n.indexOf(k) !== -1 && k.length > bestLen) { best = BREADS[i]; bestLen = k.length; }
    }
    if (best) return best;
    for (k in ALIASES) if (n.indexOf(k) !== -1 && bySlug(ALIASES[k])) return bySlug(ALIASES[k]);
    return GENERIC;
  }

  /* ---------- showing a picture for a name ---------- */
  function showPhoto(frame, b, url) {
    var img = new Image();
    img.className = "bread-photo";
    img.alt = b.name;
    img.onload = function () { frame.innerHTML = ""; frame.appendChild(img); };
    img.src = url;
  }

  // Looks for breads/<slug>.jpg / .png / .webp; keeps the drawing if none exist.
  function tryProjectPhoto(frame, b) {
    if (!b.slug) return;
    var i = 0;
    (function next() {
      if (i >= EXTS.length) return;
      var url = "breads/" + b.slug + "." + EXTS[i++];
      var img = new Image();
      img.onload = function () { if (!getPhotos()[b.slug]) showPhoto(frame, b, url); };
      img.onerror = next;
      img.src = url;
    })();
  }

  // Fills `frame` with the best picture for this bread name.
  function fill(frame, name) {
    var b = find(name);
    frame.innerHTML = drawing(name ? { name: name, shape: b.shape, c: b.c } : b);
    var saved = b.slug && getPhotos()[b.slug];
    if (saved) showPhoto(frame, b, saved); else tryProjectPhoto(frame, b);
    return b;
  }

  window.DRRBreadPics = {
    list: BREADS, find: find, fill: fill, drawing: drawing,
    getPhotos: getPhotos, savePhoto: savePhoto, showPhoto: showPhoto, tryProjectPhoto: tryProjectPhoto
  };
})();