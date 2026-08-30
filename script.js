/* ==========================================================================
   DRR Bakery — Shared Script
   Auth pages (index/signup/forgot-password) + App pages
   (dashboard/recipes/recipe-form/recipe-view/inventory/admin/
    invite-account/edit-account/profile/record-sale/analytics)

   NOTE: There is no real server here. This uses the browser's own storage
   (localStorage/sessionStorage) to stand in for a backend, so the whole
   sign up -> log in -> dashboard -> recipes/inventory/admin/analytics flow
   genuinely works end to end in the browser. To go live for real customers,
   these storage calls should be replaced with calls to a real server/API.
   ========================================================================== */

(function () {
  "use strict";

  var USERS_KEY = "drrBakeryUsers";
  var REMEMBER_KEY = "drrBakeryRememberedEmail";
  var SESSION_KEY = "drrBakerySession";
  var DATA_KEY = "drrBakeryData";
  var DATA_VERSION = 3; // bump this to force everyone's saved data back to a blank state

  var ROLES = ["Super Admin", "Admin", "Staff"];

  // Which roles may open each page. Pages not listed are open to any logged-in role.
  var ROUTE_ROLES = {
    "admin.html": ["Super Admin"],
    "invite-account.html": ["Super Admin"],
    "edit-account.html": ["Super Admin"],
    "analytics.html": ["Admin", "Super Admin"],
    "recipe-form.html": ["Admin", "Super Admin"]
  };

  var GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

  /* =======================================================================
     Users / auth storage helpers
     ======================================================================= */

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function findUserByEmail(email) {
    var users = getUsers();
    var target = email.trim().toLowerCase();
    for (var i = 0; i < users.length; i++) {
      if (users[i].email === target) return users[i];
    }
    return null;
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
    catch (e) { return null; }
  }

  function getCurrentRole() {
    var s = getSession();
    return s && s.role ? s.role : null;
  }

  function findAccountByEmail(data, email) {
    var target = (email || "").trim().toLowerCase();
    return data.accounts.find(function (a) { return a.email.trim().toLowerCase() === target; }) || null;
  }

  function currentUserName() {
    var s = getSession();
    return s && s.firstName ? s.firstName : "Guest";
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function isValidPassword(value) {
    var hasLetter = /[A-Za-z]/.test(value);
    var hasNumber = /[0-9]/.test(value);
    var hasSymbol = /[^A-Za-z0-9]/.test(value);
    return value.length >= 8 && hasLetter && hasNumber && hasSymbol;
  }

  function setFieldError(inputId, message) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var errorEl = document.getElementById(inputId + "-error");
    var controlEl = input.closest(".field-control");
    if (controlEl) controlEl.classList.add("has-error");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add("is-visible");
    }
  }

  function clearFieldError(inputId) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var errorEl = document.getElementById(inputId + "-error");
    var controlEl = input.closest(".field-control");
    if (controlEl) controlEl.classList.remove("has-error");
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.remove("is-visible");
    }
  }

  function clearAllFieldErrors(form) {
    form.querySelectorAll(".field-error").forEach(function (el) {
      el.classList.remove("is-visible");
      el.textContent = "";
    });
    form.querySelectorAll(".field-control.has-error").forEach(function (el) {
      el.classList.remove("has-error");
    });
  }

  function showAlert(alertEl, type, message) {
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.classList.remove("form-alert-error", "form-alert-success");
    alertEl.classList.add(type === "success" ? "form-alert-success" : "form-alert-error");
    alertEl.classList.add("is-visible");
  }

  function hideAlert(alertEl) {
    if (!alertEl) return;
    alertEl.classList.remove("is-visible");
  }

  function initPasswordToggles() {
    document.querySelectorAll(".password-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = document.getElementById(btn.getAttribute("data-toggle-target"));
        if (!input) return;
        var isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
      });
    });
  }

  /* =======================================================================
     Sign Up page
     ======================================================================= */

  function initSignupForm() {
    var form = document.getElementById("signup-form");
    if (!form) return;
    var alertEl = document.getElementById("signup-alert");
    var headingEl = document.getElementById("signup-heading");
    var subheadingEl = document.getElementById("signup-subheading");
    var blockedEl = document.getElementById("signup-blocked");
    var formWrap = document.getElementById("signup-form-wrap");
    var emailInput = document.getElementById("email");

    var params = new URLSearchParams(window.location.search);
    var inviteId = params.get("invite");
    var invitedRecord = null;

    function showBlocked(message, heading) {
      if (formWrap) formWrap.style.display = "none";
      if (subheadingEl) subheadingEl.style.display = "none";
      if (blockedEl) {
        blockedEl.classList.add("is-visible");
        blockedEl.textContent = message;
      }
      if (headingEl) headingEl.textContent = heading;
    }

    async function setup() {
      if (inviteId) {
        var inviteResult = await supabaseClient.rpc("get_invite", { invite_id: inviteId });
        var record = inviteResult.data && inviteResult.data[0];
        if (inviteResult.error || !record || record.status !== "Pending") {
          showBlocked("This invite link is invalid or has already been used. Ask your Super Admin to send a new one.", "Invite Not Found");
          return;
        }
        invitedRecord = record;
        if (headingEl) headingEl.textContent = "Complete Your Account";
        if (subheadingEl) subheadingEl.textContent = "You're joining DRR Bakery as " + record.role + ". Set your password to finish.";
        var nameParts = record.full_name.split(" ");
        document.getElementById("first-name").value = nameParts[0] || "";
        document.getElementById("last-name").value = nameParts.slice(1).join(" ");
        emailInput.value = record.email;
        emailInput.setAttribute("disabled", "disabled");
      } else {
        var countResult = await supabaseClient.rpc("profiles_count");
        var isBootstrap = countResult.data === 0;
        if (isBootstrap) {
          if (headingEl) headingEl.textContent = "Set Up Your Bakery";
          if (subheadingEl) subheadingEl.textContent = "Create the first account \u2014 you'll be the Super Admin (Owner).";
        } else {
          showBlocked("This bakery already has an account set up. Ask your Super Admin to send you an invite link to join.", "Invite Needed");
        }
      }
    }

    setup();

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      hideAlert(alertEl);
      clearAllFieldErrors(form);

      var firstName = document.getElementById("first-name").value.trim();
      var lastName = document.getElementById("last-name").value.trim();
      var email = invitedRecord ? invitedRecord.email : document.getElementById("email").value.trim();
      var password = document.getElementById("password").value;
      var hasError = false;

      if (!firstName) { setFieldError("first-name", "First name is required."); hasError = true; }
      if (!lastName) { setFieldError("last-name", "Last name is required."); hasError = true; }
      if (!invitedRecord) {
        if (!email) {
          setFieldError("email", "Email is required."); hasError = true;
        } else if (!isValidEmail(email)) {
          setFieldError("email", "Enter a valid email address."); hasError = true;
        }
      }
      if (!password) {
        setFieldError("password", "Password is required."); hasError = true;
      } else if (!isValidPassword(password)) {
        setFieldError("password", "Use at least 8 characters, with a letter, a number, and a symbol."); hasError = true;
      }
      if (hasError) return;

      var submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      var signUpResult = await supabaseClient.auth.signUp({ email: email, password: password });
      if (signUpResult.error) {
        submitBtn.disabled = false;
        showAlert(alertEl, "error", signUpResult.error.message || "Couldn't create that account.");
        return;
      }

      var newUserId = signUpResult.data.user && signUpResult.data.user.id;
      var role = invitedRecord ? invitedRecord.role : "Super Admin";
      var fullName = (firstName + " " + lastName).trim();

      var profileResult = await supabaseClient.from("profiles").insert({
        id: newUserId, full_name: fullName, email: email.toLowerCase(), role: role, status: "Active"
      });
      if (profileResult.error) {
        submitBtn.disabled = false;
        showAlert(alertEl, "error", "Account created, but the profile couldn't be saved: " + profileResult.error.message);
        return;
      }

      if (invitedRecord) {
        await supabaseClient.from("invites").update({ status: "Accepted" }).eq("id", invitedRecord.id);
      }
      await supabaseClient.from("activity_log").insert({
        user_id: newUserId,
        action: invitedRecord ? "Accepted invite (" + role + ")" : "Created the Super Admin account"
      });

      showAlert(alertEl, "success", "Account created! Redirecting you to log in\u2026");
      form.reset();
      await supabaseClient.auth.signOut();
      setTimeout(function () { window.location.href = "index.html"; }, 1200);
    });
  }

  /* =======================================================================
     Log In page
     ======================================================================= */

  function initLoginForm() {
    var form = document.getElementById("login-form");
    if (!form) return;
    var alertEl = document.getElementById("login-alert");
    var emailInput = document.getElementById("email");
    var rememberInput = document.getElementById("remember");

    var remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered && emailInput) {
      emailInput.value = remembered;
      if (rememberInput) rememberInput.checked = true;
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      hideAlert(alertEl);
      clearAllFieldErrors(form);

      var email = emailInput.value.trim();
      var password = document.getElementById("password").value;
      var hasError = false;

      if (!email) {
        setFieldError("email", "Email is required."); hasError = true;
      } else if (!isValidEmail(email)) {
        setFieldError("email", "Enter a valid email address."); hasError = true;
      }
      if (!password) { setFieldError("password", "Password is required."); hasError = true; }
      if (hasError) return;

      var submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      var signInResult = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
      if (signInResult.error) {
        submitBtn.disabled = false;
        showAlert(alertEl, "error", "Incorrect email or password. Please try again.");
        return;
      }

      var userId = signInResult.data.user.id;
      var profileResult = await supabaseClient.from("profiles").select("*").eq("id", userId).maybeSingle();
      var profile = profileResult.data;

      if (!profile) {
        submitBtn.disabled = false;
        showAlert(alertEl, "error", "Your account isn't fully set up. Contact your Super Admin.");
        await supabaseClient.auth.signOut();
        return;
      }
      if (profile.status !== "Active") {
        submitBtn.disabled = false;
        showAlert(alertEl, "error", "Your account is " + profile.status.toLowerCase() + ". Contact your Super Admin.");
        await supabaseClient.auth.signOut();
        return;
      }

      if (rememberInput && rememberInput.checked) {
        localStorage.setItem(REMEMBER_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      var firstName = profile.full_name.split(" ")[0] || profile.full_name;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ firstName: firstName, email: profile.email, role: profile.role }));
      showAlert(alertEl, "success", "Welcome back, " + firstName + "! Redirecting\u2026");
      setTimeout(function () { window.location.href = "dashboard.html"; }, 900);
    });
  }

  /* =======================================================================
     Google Sign-In (login + signup pages)
     ======================================================================= */

  function handleGoogleProfile(profile) {
    // NOTE: this custom Google Identity Services flow never creates a real
    // Supabase Auth session, so it can no longer pass your Row Level Security
    // checks. Proper Google sign-in with Supabase uses its own built-in OAuth
    // provider instead (supabaseClient.auth.signInWithOAuth) — ask to set that
    // up next if you want a working Google button.
    alert("Google sign-in needs to be reconnected to Supabase's own login system. Ask to set this up as the next step.");
  }

  function initGoogleSignIn() {
    var googleBtn = document.querySelector(".btn-google");
    if (!googleBtn) return;
    var clientReady = typeof google !== "undefined" && google.accounts && google.accounts.oauth2;
    var tokenClient = null;

    if (clientReady) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        callback: function (tokenResponse) {
          if (!tokenResponse || !tokenResponse.access_token) return;
          fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: "Bearer " + tokenResponse.access_token }
          })
            .then(function (res) { return res.json(); })
            .then(function (profile) { handleGoogleProfile(profile); })
            .catch(function () { alert("Couldn't complete Google sign-in. Please try again."); });
        }
      });
    }

    googleBtn.addEventListener("click", function () {
      if (GOOGLE_CLIENT_ID.indexOf("YOUR_GOOGLE_CLIENT_ID") === 0) {
        alert("Google sign-in needs one more setup step: add a real Google OAuth Client ID in script.js (look for GOOGLE_CLIENT_ID near the top).");
        return;
      }
      if (!clientReady || !tokenClient) {
        alert("Google's sign-in library didn't load. Check your internet connection and try again.");
        return;
      }
      tokenClient.requestAccessToken();
    });
  }

  /* =======================================================================
     Forgot Password page
     ======================================================================= */

  function initForgotPasswordForm() {
    var form = document.getElementById("forgot-password-form");
    if (!form) return;
    var alertEl = document.getElementById("forgot-password-alert");
    var submitBtn = form.querySelector("button[type='submit']");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      hideAlert(alertEl);
      clearAllFieldErrors(form);
      var email = document.getElementById("email").value.trim();

      if (!email) { setFieldError("email", "Email is required."); return; }
      if (!isValidEmail(email)) { setFieldError("email", "Enter a valid email address."); return; }

      var originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending\u2026";

      var basePath = window.location.pathname.replace(/[^/]*$/, "");
      var redirectTo = window.location.origin + basePath + "index.html";

      await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });

      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      showAlert(alertEl, "success", "If an account exists for " + email + ", a reset link is on its way.");
      form.reset();
    });
  }

  /* =======================================================================
     App data layer — shared across every app page
     ======================================================================= */

  function todayLabel() {
    return new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function buildRecipe(opts) {
    var totalBatchCost = opts.ingredients.reduce(function (sum, i) { return sum + i.lineCost; }, 0);
    return {
      id: opts.id || uid("rec"),
      name: opts.name,
      category: opts.category,
      baseBatchSize: opts.baseBatchSize,
      portionsPerPiece: opts.portionsPerPiece || 1,
      notes: opts.notes || "",
      ingredients: opts.ingredients,
      totalBatchCost: totalBatchCost,
      costPerPiece: opts.baseBatchSize > 0 ? totalBatchCost / opts.baseBatchSize : 0,
      sellingPrice: opts.sellingPrice || 0,
      savedAt: opts.savedAt || todayLabel()
    };
  }

  function seedData() {
    return {
      ingredients: [],
      breadStock: [],
      recipes: [],
      accounts: [],
      activityLog: [],
      sales: [],
      breadStats: {},
      settings: { bakeryName: "DRR Bakery", currency: "PHP", targetFoodCostPct: 30, businessHours: "" }
    };
  }

  function getData() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(DATA_KEY)); } catch (e) { raw = null; }
    if (!raw || raw._version !== DATA_VERSION) {
      var seeded = seedData();
      seeded._version = DATA_VERSION;
      localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
      return seeded;
    }
    // Defensive migration for data saved by earlier versions of this app.
    if (!raw.ingredients) raw.ingredients = [];
    if (!raw.recipes) raw.recipes = [];
    if (!raw.accounts) raw.accounts = [];
    if (!raw.activityLog) raw.activityLog = [];
    if (!raw.sales) raw.sales = [];
    if (!raw.breadStats) raw.breadStats = {};
    if (!raw.settings) raw.settings = { bakeryName: "DRR Bakery", currency: "PHP", targetFoodCostPct: 30, businessHours: "" };
    if (!raw.breadStock || !raw.breadStock.length || typeof raw.breadStock[0].baked === "undefined") {
      raw.breadStock = seedData().breadStock;
    }
    return raw;
  }

  function saveData(data) {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }

  function logActivity(data, action) {
    data.activityLog.unshift({ date: todayLabel(), user: currentUserName(), action: action });
  }

  /* ---- toast (shared across app pages) ---- */
  function toast(msg) {
    var el = document.getElementById("app-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("is-visible"); }, 2400);
  }

  var FLASH_KEY = "drrBakeryFlash";

  async function logActivitySupa(action) {
    var userResult = await supabaseClient.auth.getUser();
    var userId = userResult.data && userResult.data.user && userResult.data.user.id;
    await supabaseClient.from("activity_log").insert({ user_id: userId, action: action });
  }

  function setFlash(msg) {
    sessionStorage.setItem(FLASH_KEY, msg);
  }

  function consumeFlash() {
    var msg = sessionStorage.getItem(FLASH_KEY);
    if (msg) {
      sessionStorage.removeItem(FLASH_KEY);
      toast(msg);
    }
  }

  /* ---- shared header: login guard + account dropdown ---- */
  function currentPageFile() {
    return window.location.pathname.split("/").pop() || "dashboard.html";
  }

  function filterNavForRole(role) {
    var navLinks = document.querySelectorAll(".app-nav a");
    if (!navLinks.length) return;

    navLinks.forEach(function (a) {
      var href = a.getAttribute("href");

      if (role === "Staff") {
        if (href === "recipes.html") a.textContent = "Recipes";
        if (href === "analytics.html") {
          a.textContent = "Transaction";
          a.setAttribute("href", "record-sale.html");
          if (currentPageFile() === "record-sale.html") a.classList.add("active");
        }
        if (href === "admin.html") a.closest("li").remove();
      } else if (role === "Admin") {
        if (href === "admin.html") a.closest("li").remove();
      }
      // Super Admin sees the full nav as-is.
    });
  }

  async function initAppChrome() {
    var avatarBtn = document.getElementById("avatar-btn");
    if (!avatarBtn) return;

    // Check the REAL Supabase session (persists across tabs/refreshes),
    // and refresh our lightweight sessionStorage mirror from it.
    var sessionResult = await supabaseClient.auth.getSession();
    var supaSession = sessionResult.data && sessionResult.data.session;
    if (!supaSession) {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = "index.html";
      return false;
    }

    var profileResult = await supabaseClient.from("profiles").select("*").eq("id", supaSession.user.id).maybeSingle();
    var profile = profileResult.data;
    if (!profile || profile.status !== "Active") {
      await supabaseClient.auth.signOut();
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = "index.html";
      return false;
    }

    var firstName = profile.full_name.split(" ")[0] || profile.full_name;
    var session = { firstName: firstName, email: profile.email, role: profile.role };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // Enforce which roles may open this page.
    var page = currentPageFile();
    var allowedRoles = ROUTE_ROLES[page];
    if (allowedRoles && allowedRoles.indexOf(session.role) === -1) {
      setFlash("You don't have access to that page.");
      window.location.href = "dashboard.html";
      return false;
    }

    filterNavForRole(session.role);

    var menu = document.createElement("div");
    menu.className = "avatar-menu";
    menu.id = "avatar-menu";
    menu.innerHTML =
      '<p class="avatar-menu-email">' + session.email + '</p>' +
      '<p class="avatar-menu-role">' + (session.role || "") + '</p>' +
      '<a href="profile.html" class="avatar-menu-link">Profile</a>' +
      '<button type="button" class="avatar-menu-link avatar-menu-logout" id="avatar-logout-btn">Logout</button>';
    document.body.appendChild(menu);

    avatarBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      menu.classList.toggle("is-open");
    });
    document.addEventListener("click", function (event) {
      if (!menu.contains(event.target) && event.target !== avatarBtn) {
        menu.classList.remove("is-open");
      }
    });

    document.getElementById("avatar-logout-btn").addEventListener("click", async function () {
      sessionStorage.removeItem(SESSION_KEY);
      await supabaseClient.auth.signOut();
      window.location.href = "index.html";
    });

    consumeFlash();
    return true;
  }

  /* =======================================================================
     Dashboard page
     ======================================================================= */

  function computeAverageFoodCostPct(data) {
    if (!data.recipes.length) return 0;
    var total = 0, count = 0;
    data.recipes.forEach(function (r) {
      if (r.sellingPrice > 0) {
        total += (r.costPerPiece / r.sellingPrice) * 100;
        count++;
      }
    });
    return count ? total / count : 0;
  }

  function computeIngredientAlerts(data) {
    return data.ingredients.filter(function (i) {
      return i.baseline > 0 && Math.abs(i.costPerUnit - i.baseline) / i.baseline >= 0.05;
    }).length;
  }

  function computeTodayProfit(data) {
    var today = todayLabel();
    return data.sales.filter(function (s) { return s.date === today; })
      .reduce(function (sum, s) { return sum + s.grossProfit; }, 0);
  }

  function initDashboardStats() {
    var el = document.getElementById("stat-recipes");
    if (!el) return;
    var data = getData();
    document.getElementById("stat-recipes").textContent = data.recipes.length;
    document.getElementById("stat-foodcost").textContent = computeAverageFoodCostPct(data).toFixed(1) + "%";
    document.getElementById("stat-profit").textContent = "\u20B1 " + computeTodayProfit(data).toLocaleString(undefined, { maximumFractionDigits: 0 });
    document.getElementById("stat-alerts").textContent = computeIngredientAlerts(data);
  }

  function initMonthlySalesChart() {
    var body = document.getElementById("bar-chart-body");
    if (!body) return;

    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var current = [3200,2800,7600,6100,5400,4800,5200,3600,2900,3300,4100,4700];
    var past    = [2600,2400,6000,7100,4700,3900,4300,3100,2500,2700,3500,4000];
    var maxVal = 10000;
    var showCurrent = true, showPast = true;

    function render() {
      body.innerHTML = "";
      months.forEach(function (m, i) {
        var row = document.createElement("div");
        row.className = "bar-row";
        var track = document.createElement("div");
        track.className = "bar-track";
        if (showCurrent) {
          var barC = document.createElement("div");
          barC.className = "bar dark";
          barC.style.width = Math.max(2, (current[i] / maxVal) * 100) + "%";
          track.appendChild(barC);
        }
        if (showPast) {
          var barP = document.createElement("div");
          barP.className = "bar light";
          barP.style.width = Math.max(2, (past[i] / maxVal) * 100) + "%";
          track.appendChild(barP);
        }
        row.innerHTML = '<div class="month-lbl">' + m + '</div>';
        row.appendChild(track);
        body.appendChild(row);
      });
      var axis = document.getElementById("bar-axis-labels");
      axis.innerHTML = "";
      for (var v = 0; v <= maxVal; v += 1000) {
        var s = document.createElement("span");
        s.textContent = "\u20B1" + (v / 1000) + "K";
        axis.appendChild(s);
      }
    }

    document.getElementById("toggle-current").addEventListener("click", function () {
      showCurrent = !showCurrent;
      this.classList.toggle("dim", !showCurrent);
      render();
    });
    document.getElementById("toggle-past").addEventListener("click", function () {
      showPast = !showPast;
      this.classList.toggle("dim", !showPast);
      render();
    });

    render();
  }

  function initTopBreadDonut() {
    var svg = document.getElementById("donut-svg");
    if (!svg) return;

    var breadData = [
      { name: "Pandesal", value: 1200000, pct: "+8.2%", up: true, color: "#3E2723" },
      { name: "Ensaymada", value: 800000, pct: "+7%", up: true, color: "#A5511F" },
      { name: "Spanish Bread", value: 645000, pct: "+2.5%", up: true, color: "#C1662F" },
      { name: "Cheese Bread", value: 590000, pct: "-6.5%", up: false, color: "#8B7355" },
      { name: "Monay", value: 342000, pct: "+1.7%", up: true, color: "#E8DCC8" }
    ];

    var svgNS = "http://www.w3.org/2000/svg";
    var cx = 75, cy = 75, rOuter = 68, rInner = 42;
    var total = breadData.reduce(function (s, d) { return s + d.value; }, 0);
    var startAngle = -90;

    function polarToXY(r, angleDeg) {
      var rad = (angleDeg - 90) * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    breadData.forEach(function (d) {
      var sweep = (d.value / total) * 360;
      var endAngle = startAngle + sweep;
      var largeArc = sweep > 180 ? 1 : 0;
      var p1 = polarToXY(rOuter, startAngle);
      var p2 = polarToXY(rOuter, endAngle);
      var p3 = polarToXY(rInner, endAngle);
      var p4 = polarToXY(rInner, startAngle);
      var pathData = ["M", p1.x, p1.y, "A", rOuter, rOuter, 0, largeArc, 1, p2.x, p2.y,
        "L", p3.x, p3.y, "A", rInner, rInner, 0, largeArc, 0, p4.x, p4.y, "Z"].join(" ");
      var path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", pathData);
      path.setAttribute("fill", d.color);
      svg.appendChild(path);
      startAngle = endAngle;
    });

    var legend = document.getElementById("donut-legend");
    legend.innerHTML = "";
    breadData.forEach(function (d) {
      var li = document.createElement("li");
      li.innerHTML = '<span class="dot" style="background:' + d.color + '"></span>' +
        '<span class="name">' + d.name + '</span>' +
        '<span class="amt">\u20B1' + (d.value / 1000).toFixed(0) + 'K</span>' +
        '<span class="pill ' + (d.up ? "" : "down") + '">' + d.pct + '</span>';
      legend.appendChild(li);
    });
  }

  function initDashboardPage() {
    if (!document.getElementById("stat-recipes")) return;

    var role = getCurrentRole();
    if (role !== "Admin" && role !== "Super Admin") {
      var newRecipeTile = document.querySelector('.action-btn[href="recipe-form.html"]');
      if (newRecipeTile) newRecipeTile.style.display = "none";
    }
    if (role === "Staff") {
      var addIngredientTile = document.querySelector('.action-btn[href="inventory.html?add=1"]');
      if (addIngredientTile) addIngredientTile.style.display = "none";
    }
    if (role !== "Super Admin") {
      var manageAccountsTile = document.querySelector('.action-btn[href="admin.html"]');
      if (manageAccountsTile) manageAccountsTile.style.display = "none";
    }

    initDashboardStats();
    initMonthlySalesChart();
    initTopBreadDonut();
  }

  /* =======================================================================
     Recipes & Costing — list page (recipes.html)
     ======================================================================= */

  function initRecipesListPage() {
    var tbody = document.getElementById("recipes-list-body");
    if (!tbody) return;

    var data = getData();
    var searchInput = document.getElementById("recipe-search");
    var activeCategory = "All";

    if (getCurrentRole() === "Staff") {
      var addRecipeBtn = document.querySelector('.recipes-toolbar a[href="recipe-form.html"]');
      if (addRecipeBtn) addRecipeBtn.style.display = "none";
    }

    function render() {
      var query = (searchInput.value || "").trim().toLowerCase();
      var rows = data.recipes.filter(function (r) {
        var matchesCategory = activeCategory === "All" || r.category === activeCategory;
        var matchesQuery = !query || r.name.toLowerCase().indexOf(query) !== -1;
        return matchesCategory && matchesQuery;
      });
      tbody.innerHTML = "";
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-note">No recipes match yet. Try a different search, or add a new bread recipe.</td></tr>';
        return;
      }
      rows.forEach(function (r) {
        var margin = r.sellingPrice > 0 ? ((r.sellingPrice - r.costPerPiece) / r.sellingPrice) * 100 : 0;
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + r.name + "</td>" +
          "<td>" + r.category + "</td>" +
          "<td>" + r.baseBatchSize + " pcs</td>" +
          "<td>\u20B1" + r.costPerPiece.toFixed(2) + "</td>" +
          "<td>\u20B1" + r.sellingPrice.toFixed(2) + "</td>" +
          "<td>" + margin.toFixed(0) + "%</td>" +
          '<td><a href="recipe-view.html?id=' + r.id + '" class="row-action">view</a></td>';
        tbody.appendChild(tr);
      });
    }

    searchInput.addEventListener("input", render);
    document.querySelectorAll("#recipe-category-filters .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.querySelectorAll("#recipe-category-filters .chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        activeCategory = chip.getAttribute("data-category");
        render();
      });
    });

    render();
  }

  /* =======================================================================
     Recipes & Costing — create/edit form (recipe-form.html)
     ======================================================================= */

  function initRecipeFormPage() {
    var tbody = document.getElementById("recipe-ingredients-body");
    if (!tbody) return;

    var data = getData();
    var lineItems = [];
    var scaleFactor = 1;

    var params = new URLSearchParams(window.location.search);
    var editId = params.get("id");
    var editingRecipe = editId ? data.recipes.find(function (r) { return r.id === editId; }) : null;

    var nameInput = document.getElementById("input-recipe-name");
    var categorySelect = document.getElementById("input-category");
    var baseBatchInput = document.getElementById("input-base-batch");
    var portionsInput = document.getElementById("input-portions-per-piece");
    var notesInput = document.getElementById("input-notes");
    var ingredientSelect = document.getElementById("select-ingredient");
    var qtyInput = document.getElementById("input-ing-qty");
    var targetFoodCostInput = document.getElementById("input-target-foodcost");
    var sellingPriceInput = document.getElementById("input-selling-price");
    var saveBtn = document.getElementById("save-recipe-btn");

    if (editingRecipe) {
      document.getElementById("recipe-form-heading").textContent = "Edit Bread Recipe";
      document.getElementById("recipe-id").value = editingRecipe.id;
      nameInput.value = editingRecipe.name;
      categorySelect.value = editingRecipe.category;
      baseBatchInput.value = editingRecipe.baseBatchSize;
      portionsInput.value = editingRecipe.portionsPerPiece || 1;
      notesInput.value = editingRecipe.notes || "";
      sellingPriceInput.value = editingRecipe.sellingPrice || "";
      lineItems = editingRecipe.ingredients.map(function (i) { return Object.assign({}, i); });
      saveBtn.textContent = "Update recipe";
    }

    function populateIngredientSelect() {
      ingredientSelect.innerHTML = "";
      data.ingredients.forEach(function (ing) {
        var opt = document.createElement("option");
        opt.value = ing.id;
        opt.textContent = ing.name + " (\u20B1" + ing.costPerUnit.toFixed(3) + "/" + ing.unit + ")";
        ingredientSelect.appendChild(opt);
      });
    }

    function renderIngredientRows() {
      tbody.innerHTML = "";
      if (!lineItems.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-note">No ingredients added yet — pick one below and set a quantity.</td></tr>';
      } else {
        lineItems.forEach(function (item, idx) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + item.name + "</td>" +
            "<td>" + item.category + "</td>" +
            "<td>" + item.qty + " " + item.unit + "</td>" +
            "<td>\u20B1" + item.costPerUnit.toFixed(3) + "</td>" +
            "<td>\u20B1" + item.lineCost.toFixed(2) + "</td>" +
            '<td><button class="btn-link-remove" data-remove="' + idx + '">Remove</button></td>';
          tbody.appendChild(tr);
        });
      }
      tbody.querySelectorAll("[data-remove]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          lineItems.splice(parseInt(btn.getAttribute("data-remove"), 10), 1);
          renderIngredientRows();
          recompute();
        });
      });
    }

    document.getElementById("add-ingredient-line").addEventListener("click", function () {
      var ing = data.ingredients.find(function (i) { return i.id === ingredientSelect.value; });
      var qty = parseFloat(qtyInput.value);
      if (!ing || !qty || qty <= 0) { toast("Pick an ingredient and enter a quantity."); return; }
      lineItems.push({
        ingredientId: ing.id, name: ing.name, category: ing.category,
        unit: ing.unit, costPerUnit: ing.costPerUnit, qty: qty, lineCost: ing.costPerUnit * qty
      });
      qtyInput.value = "";
      renderIngredientRows();
      recompute();
    });

    function totalBatchCostRaw() {
      return lineItems.reduce(function (sum, i) { return sum + i.lineCost; }, 0);
    }

    function recompute() {
      var totalCost = totalBatchCostRaw() * scaleFactor;
      var baseBatch = parseFloat(baseBatchInput.value) || 0;
      var costPerPiece = baseBatch > 0 ? totalCost / (baseBatch * scaleFactor) : 0;

      document.getElementById("total-batch-cost").textContent = "\u20B1" + totalCost.toFixed(2);
      document.getElementById("cost-per-piece").textContent = "\u20B1" + costPerPiece.toFixed(2);
      document.getElementById("pricing-total-batch-cost").textContent = "\u20B1" + totalCost.toFixed(2);
      document.getElementById("pricing-cost-per-piece").textContent = "\u20B1" + costPerPiece.toFixed(2);

      var targetPct = parseFloat(targetFoodCostInput.value);
      var suggested = (targetPct && targetPct > 0) ? costPerPiece / (targetPct / 100) : 0;
      document.getElementById("suggested-selling-price").textContent = "\u20B1" + suggested.toFixed(2);

      renderLossCheck(costPerPiece, targetPct || 0, suggested);
      return { totalCost: totalCost, costPerPiece: costPerPiece, suggested: suggested };
    }

    function renderLossCheck(costPerPiece, targetPct, suggested) {
      var lossBody = document.getElementById("loss-check-body");
      var sellingPrice = parseFloat(sellingPriceInput.value) || suggested;
      var rows = [];
      if (costPerPiece > 0) {
        var lowPrice = costPerPiece * 1.1;
        rows.push({ price: lowPrice, cost: costPerPiece });
        if (sellingPrice > 0) rows.push({ price: sellingPrice, cost: costPerPiece });
      }
      lossBody.innerHTML = "";
      if (!rows.length) {
        lossBody.innerHTML = '<tr><td colspan="3" class="empty-note">Add ingredients to see a loss check.</td></tr>';
        return;
      }
      rows.forEach(function (r) {
        var pct = r.price > 0 ? (r.cost / r.price) * 100 : 0;
        var isLoss = targetPct > 0 ? pct > targetPct + 10 : pct > 45;
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>\u20B1" + r.price.toFixed(2) + "</td>" +
          "<td>" + pct.toFixed(1) + "%</td>" +
          '<td><span class="status-text ' + (isLoss ? "bad" : "good") + '">' + (isLoss ? "Loss Risk" : "Meets Target") + "</span></td>";
        lossBody.appendChild(tr);
      });
    }

    document.querySelectorAll(".chip[data-scale]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.querySelectorAll(".chip[data-scale]").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        scaleFactor = parseFloat(chip.getAttribute("data-scale"));
        recompute();
      });
    });

    [baseBatchInput, targetFoodCostInput, sellingPriceInput].forEach(function (input) {
      input.addEventListener("input", recompute);
    });

    saveBtn.addEventListener("click", function () {
      var name = nameInput.value.trim();
      var category = categorySelect.value;
      var baseBatch = parseFloat(baseBatchInput.value) || 0;
      var portions = parseFloat(portionsInput.value) || 1;

      if (!name) { toast("Enter a bread item name."); return; }
      if (!lineItems.length) { toast("Add at least one ingredient first."); return; }
      if (!baseBatch) { toast("Enter a base batch size (yield)."); return; }

      var totals = recompute();
      var recipeData = buildRecipe({
        id: editingRecipe ? editingRecipe.id : null,
        name: name,
        category: category,
        baseBatchSize: baseBatch,
        portionsPerPiece: portions,
        notes: notesInput.value.trim(),
        ingredients: lineItems,
        sellingPrice: parseFloat(sellingPriceInput.value) || totals.suggested,
        savedAt: editingRecipe ? editingRecipe.savedAt : todayLabel()
      });

      if (editingRecipe) {
        var idx = data.recipes.findIndex(function (r) { return r.id === editingRecipe.id; });
        data.recipes[idx] = recipeData;
        logActivity(data, "Updated recipe - " + recipeData.name);
        saveData(data);
        toast("Recipe updated!");
        setTimeout(function () { window.location.href = "recipe-view.html?id=" + recipeData.id; }, 700);
      } else {
        data.recipes.push(recipeData);
        logActivity(data, "Saved recipe - " + recipeData.name);
        saveData(data);
        toast("Recipe saved!");
        setTimeout(function () { window.location.href = "recipes.html"; }, 700);
      }
    });

    populateIngredientSelect();
    renderIngredientRows();
    recompute();
  }

  /* =======================================================================
     Recipes & Costing — read-only view (recipe-view.html)
     ======================================================================= */

  function initRecipeViewPage() {
    var heading = document.getElementById("view-recipe-name");
    if (!heading) return;

    var data = getData();
    var id = new URLSearchParams(window.location.search).get("id");
    var recipe = data.recipes.find(function (r) { return r.id === id; });

    if (!recipe) {
      document.querySelector(".app-main").innerHTML = '<p class="empty-note">Recipe not found. <a href="recipes.html">Back to Recipes &amp; Costing</a></p>';
      return;
    }

    heading.textContent = recipe.name;
    document.getElementById("view-batch-size").value = recipe.baseBatchSize + " pcs";
    document.getElementById("view-category").value = recipe.category;
    document.getElementById("view-base-batch").value = recipe.baseBatchSize + " pcs";
    document.getElementById("view-portions").value = recipe.portionsPerPiece || 1;
    document.getElementById("view-notes").value = recipe.notes || "(No notes added.)";

    var ingBody = document.getElementById("view-ingredients-body");
    ingBody.innerHTML = "";
    recipe.ingredients.forEach(function (item) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + item.name + "</td><td>" + item.category + "</td><td>\u20B1" + item.costPerUnit.toFixed(3) + "</td><td>\u20B1" + item.lineCost.toFixed(2) + "</td>";
      ingBody.appendChild(tr);
    });

    document.getElementById("view-total-batch-cost").textContent = "\u20B1" + recipe.totalBatchCost.toFixed(2);
    document.getElementById("view-cost-per-piece").textContent = "\u20B1" + recipe.costPerPiece.toFixed(2);
    document.getElementById("view-yield-pct").textContent = "100%";

    var editBtn = document.getElementById("edit-recipe-btn");
    if (getCurrentRole() === "Staff") {
      editBtn.style.display = "none";
    } else {
      editBtn.addEventListener("click", function () {
        window.location.href = "recipe-form.html?id=" + recipe.id;
      });
    }
  }

  /* =======================================================================
     Inventory page
     ======================================================================= */

  function initInventoryPage() {
    var body = document.getElementById("ingredient-stock-body");
    if (!body) return;

    var data = getData();
    var role = getCurrentRole();

    if (role === "Staff") {
      var rawTabBtn = document.querySelector('[data-tab="tab-raw-ingredients"]');
      if (rawTabBtn) rawTabBtn.style.display = "none";
    }

    /* ---- Raw ingredients tab ---- */
    function renderIngredientTable() {
      body.innerHTML = "";
      if (!data.ingredients.length) {
        body.innerHTML = '<tr><td colspan="7" class="empty-note">No raw ingredients yet.</td></tr>';
        return;
      }
      data.ingredients.forEach(function (ing) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + ing.name + "</td>" +
          "<td>" + ing.category + "</td>" +
          "<td>" + ing.unit + "</td>" +
          "<td>\u20B1" + ing.costPerUnit.toFixed(3) + "</td>" +
          "<td>" + ing.stockQty.toLocaleString() + " " + ing.unit + "</td>" +
          "<td>" + ing.lastUpdated + "</td>" +
          '<td><a href="#" class="row-action" data-edit="' + ing.id + '">Edit</a></td>';
        body.appendChild(tr);
      });
      body.querySelectorAll("[data-edit]").forEach(function (link) {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          toggleEditRow(link.getAttribute("data-edit"));
        });
      });
    }

    function toggleEditRow(id) {
      var ing = data.ingredients.find(function (i) { return i.id === id; });
      if (!ing) return;
      var rows = body.querySelectorAll("tr");
      rows.forEach(function (tr) {
        if (tr.children[0] && tr.children[0].textContent === ing.name) {
          tr.innerHTML =
            '<td>' + ing.name + '</td>' +
            '<td>' + ing.category + '</td>' +
            '<td>' + ing.unit + '</td>' +
            '<td><input type="number" step="0.001" id="edit-cost-' + ing.id + '" value="' + ing.costPerUnit + '"></td>' +
            '<td><input type="number" step="1" id="edit-stock-' + ing.id + '" value="' + ing.stockQty + '"></td>' +
            '<td>' + ing.lastUpdated + '</td>' +
            '<td><a href="#" class="row-action" data-save="' + ing.id + '">Save</a></td>';
          tr.querySelector("[data-save]").addEventListener("click", function (e) {
            e.preventDefault();
            var newCost = parseFloat(document.getElementById("edit-cost-" + ing.id).value);
            var newStock = parseFloat(document.getElementById("edit-stock-" + ing.id).value);
            if (!isNaN(newCost)) ing.costPerUnit = newCost;
            if (!isNaN(newStock)) ing.stockQty = newStock;
            ing.lastUpdated = todayLabel();
            logActivity(data, "Updated ingredient - " + ing.name);
            saveData(data);
            renderIngredientTable();
            toast(ing.name + " updated.");
          });
        }
      });
    }

    var addBtn = document.getElementById("show-add-ingredient");
    var addForm = document.getElementById("add-ingredient-form");
    addBtn.addEventListener("click", function () {
      addForm.classList.toggle("is-visible");
      if (addForm.classList.contains("is-visible")) addForm.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    var qtyInput = document.getElementById("ing-qty-purchased");
    var priceInput = document.getElementById("ing-total-price");
    var costPreview = document.getElementById("ing-cost-preview");

    function updateCostPreview() {
      var qty = parseFloat(qtyInput.value);
      var price = parseFloat(priceInput.value);
      var unit = document.getElementById("ing-unit").value || "unit";
      if (qty > 0 && price >= 0) {
        costPreview.textContent = "\u20B1" + (price / qty).toFixed(3) + " / " + unit;
      } else {
        costPreview.textContent = "\u20B1 0 / " + unit;
      }
    }
    [qtyInput, priceInput, document.getElementById("ing-unit")].forEach(function (el) {
      el.addEventListener("input", updateCostPreview);
      el.addEventListener("change", updateCostPreview);
    });

    document.getElementById("save-ingredient-btn").addEventListener("click", function () {
      var name = document.getElementById("ing-name").value.trim();
      var category = document.getElementById("ing-category").value.trim();
      var unit = document.getElementById("ing-unit").value;
      var qty = parseFloat(qtyInput.value);
      var totalPrice = parseFloat(priceInput.value);
      var startStock = parseFloat(document.getElementById("ing-start-stock").value) || qty || 0;

      if (!name || !qty || qty <= 0 || isNaN(totalPrice)) {
        toast("Fill in ingredient name, quantity purchased, and total price paid.");
        return;
      }
      var costPerUnit = totalPrice / qty;
      var newIng = {
        id: uid("ing"), name: name, category: category || "Uncategorized", unit: unit,
        costPerUnit: costPerUnit, baseline: costPerUnit, stockQty: startStock, lastUpdated: todayLabel()
      };
      data.ingredients.push(newIng);
      logActivity(data, "Added raw ingredient - " + name);
      saveData(data);

      ["ing-name","ing-category","ing-qty-purchased","ing-total-price","ing-supplier","ing-start-stock","ing-low-stock"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = "";
      });
      updateCostPreview();
      renderIngredientTable();
      addForm.classList.remove("is-visible");
      toast('"' + name + '" added to raw ingredient stock.');
    });

    /* ---- Bread Stock tab ---- */
    var breadBody = document.getElementById("bread-stock-body");

    function renderBreadStock() {
      breadBody.innerHTML = "";
      if (!data.breadStock.length) {
        breadBody.innerHTML = '<tr><td colspan="5" class="empty-note">No bread stock logged yet.</td></tr>';
        return;
      }
      data.breadStock.forEach(function (b) {
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + b.name + "</td><td>" + b.baked + " pcs</td><td>" + b.sold + " pcs</td><td>" + b.remaining + " pcs</td>" +
          '<td><a href="#" class="row-action" data-bs-edit="' + b.id + '">Edit</a></td>';
        breadBody.appendChild(tr);
      });
      breadBody.querySelectorAll("[data-bs-edit]").forEach(function (link) {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          toggleEditBreadStockRow(link.getAttribute("data-bs-edit"));
        });
      });
    }

    function toggleEditBreadStockRow(id) {
      var b = data.breadStock.find(function (x) { return x.id === id; });
      if (!b) return;
      var rows = breadBody.querySelectorAll("tr");
      rows.forEach(function (tr) {
        if (tr.children[0] && tr.children[0].textContent === b.name) {
          tr.innerHTML =
            "<td>" + b.name + "</td>" +
            '<td><input type="number" id="edit-baked-' + b.id + '" value="' + b.baked + '"></td>' +
            '<td><input type="number" id="edit-sold-' + b.id + '" value="' + b.sold + '"></td>' +
            "<td>" + b.remaining + " pcs</td>" +
            '<td><a href="#" class="row-action" data-bs-save="' + b.id + '">Save</a></td>';
          tr.querySelector("[data-bs-save]").addEventListener("click", function (e) {
            e.preventDefault();
            var newBaked = parseFloat(document.getElementById("edit-baked-" + b.id).value);
            var newSold = parseFloat(document.getElementById("edit-sold-" + b.id).value);
            if (!isNaN(newBaked)) b.baked = newBaked;
            if (!isNaN(newSold)) b.sold = newSold;
            b.remaining = Math.max(0, b.baked - b.sold);
            b.lastUpdated = todayLabel();
            logActivity(data, "Updated bread stock - " + b.name);
            saveData(data);
            renderBreadStock();
            toast(b.name + " stock updated.");
          });
        }
      });
    }

    var showAddBreadBtn = document.getElementById("show-add-bread-stock");
    var addBreadForm = document.getElementById("add-bread-stock-form");
    var bsSelect = document.getElementById("bs-bread-item");
    var bsPrice = document.getElementById("bs-selling-price");
    var bsQty = document.getElementById("bs-qty-baked");
    var bsDate = document.getElementById("bs-date-baked");
    var bsIngredientsBody = document.getElementById("bs-ingredients-used-body");

    function populateBreadItemSelect() {
      bsSelect.innerHTML = "";
      if (!data.recipes.length) {
        bsSelect.innerHTML = '<option value="">No recipes yet — add one first</option>';
        return;
      }
      data.recipes.forEach(function (r) {
        var opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name;
        bsSelect.appendChild(opt);
      });
    }

    function updateBreadStockPreview() {
      var recipe = data.recipes.find(function (r) { return r.id === bsSelect.value; });
      bsPrice.value = recipe ? "\u20B1" + recipe.sellingPrice.toFixed(2) : "\u20B10.00";
      bsDate.value = todayLabel();

      var qty = parseFloat(bsQty.value) || 0;
      bsIngredientsBody.innerHTML = "";
      if (!recipe || !qty) {
        bsIngredientsBody.innerHTML = '<tr><td colspan="2" class="empty-note">Pick a bread item and enter quantity baked to preview ingredient usage.</td></tr>';
        return;
      }
      var scale = qty / recipe.baseBatchSize;
      recipe.ingredients.forEach(function (item) {
        var usedQty = item.qty * scale;
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + item.name + "</td><td>" + usedQty.toFixed(1) + " " + item.unit + "</td>";
        bsIngredientsBody.appendChild(tr);
      });
    }

    showAddBreadBtn.addEventListener("click", function () {
      addBreadForm.classList.toggle("is-visible");
      if (addBreadForm.classList.contains("is-visible")) {
        populateBreadItemSelect();
        updateBreadStockPreview();
        addBreadForm.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    bsSelect.addEventListener("change", updateBreadStockPreview);
    bsQty.addEventListener("input", updateBreadStockPreview);

    document.getElementById("save-bread-stock-btn").addEventListener("click", function () {
      var recipe = data.recipes.find(function (r) { return r.id === bsSelect.value; });
      var qty = parseFloat(bsQty.value);
      if (!recipe) { toast("Add a recipe first, then log bread inventory for it."); return; }
      if (!qty || qty <= 0) { toast("Enter a quantity baked."); return; }

      var scale = qty / recipe.baseBatchSize;
      recipe.ingredients.forEach(function (item) {
        var ing = data.ingredients.find(function (i) { return i.id === item.ingredientId; });
        var usedQty = item.qty * scale;
        if (ing) {
          ing.stockQty = Math.max(0, ing.stockQty - usedQty);
          ing.lastUpdated = todayLabel();
        }
      });

      var existing = data.breadStock.find(function (b) { return b.name === recipe.name; });
      if (existing) {
        existing.baked += qty;
        existing.remaining = Math.max(0, existing.baked - existing.sold);
        existing.lastUpdated = todayLabel();
      } else {
        data.breadStock.push({ id: uid("bs"), name: recipe.name, baked: qty, sold: 0, remaining: qty, lastUpdated: todayLabel() });
      }

      logActivity(data, "Added bread inventory- " + recipe.name + " +" + qty);
      saveData(data);

      bsQty.value = "";
      updateBreadStockPreview();
      renderBreadStock();
      renderIngredientTable();
      addBreadForm.classList.remove("is-visible");
      toast(recipe.name + " inventory updated (+" + qty + " pcs).");
    });

    /* Tabs */
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
        document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
        btn.classList.add("active");
        document.getElementById(btn.getAttribute("data-tab")).classList.add("active");
      });
    });

    renderIngredientTable();
    renderBreadStock();
    updateCostPreview();
    populateBreadItemSelect();
    updateBreadStockPreview();

    if (role !== "Staff" && window.location.search.indexOf("add=1") !== -1) {
      document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
      document.querySelector('[data-tab="tab-raw-ingredients"]').classList.add("active");
      document.getElementById("tab-raw-ingredients").classList.add("active");
      addForm.classList.add("is-visible");
    }
  }

  /* =======================================================================
     Admin — accounts list (admin.html)
     ======================================================================= */

  function initAdminPage() {
    var body = document.getElementById("accounts-body");
    if (!body) return;

    async function renderAccounts() {
      var result = await supabaseClient.from("profiles").select("*").order("full_name");
      if (result.error) {
        console.error("renderAccounts error:", result.error);
        body.innerHTML = '<tr><td colspan="5" class="empty-note">Couldn\'t load accounts: ' + result.error.message + '</td></tr>';
        return;
      }
      var accounts = result.data || [];
      body.innerHTML = "";
      if (!accounts.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty-note">No accounts yet.</td></tr>';
        return;
      }
      accounts.forEach(function (acc) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + acc.full_name + "</td>" +
          "<td>" + acc.role + "</td>" +
          "<td>" + acc.email + "</td>" +
          '<td><span class="status-pill">' + acc.status + '</span></td>' +
          '<td><a href="edit-account.html?id=' + acc.id + '" class="row-action">Edit</a></td>';
        body.appendChild(tr);
      });
    }

    async function renderActivity() {
      var logBody = document.getElementById("activity-log-body");
      var result = await supabaseClient
        .from("activity_log")
        .select("action, created_at, profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      var entries = result.data || [];
      logBody.innerHTML = "";
      if (!entries.length) {
        logBody.innerHTML = '<tr><td colspan="3" class="empty-note">No activity yet.</td></tr>';
        return;
      }
      entries.forEach(function (entry) {
        var tr = document.createElement("tr");
        var dateLabel = new Date(entry.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
        var userName = entry.profiles ? entry.profiles.full_name : "Unknown";
        tr.innerHTML = "<td>" + dateLabel + "</td><td>" + userName + "</td><td>" + entry.action + "</td>";
        logBody.appendChild(tr);
      });
    }

    renderAccounts();
    renderActivity();
  }

  /* =======================================================================
     Admin — invite account (invite-account.html)
     ======================================================================= */

  function initInviteAccountPage() {
    var sendBtn = document.getElementById("send-invite-btn");
    if (!sendBtn) return;
    var selectedRole = "Staff";
    var formSection = document.getElementById("invite-form-section");
    var resultSection = document.getElementById("invite-result-section");
    var linkInput = document.getElementById("invite-link-input");

    document.querySelectorAll("#invite-role-toggle .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.querySelectorAll("#invite-role-toggle .chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        selectedRole = chip.getAttribute("data-role");
      });
    });

    sendBtn.addEventListener("click", async function () {
      var name = document.getElementById("invite-name").value.trim();
      var email = document.getElementById("invite-email").value.trim();
      if (!name || !isValidEmail(email)) { toast("Enter a name and a valid email."); return; }

      sendBtn.disabled = true;

      var existingProfile = await supabaseClient.from("profiles").select("id").ilike("email", email).maybeSingle();
      if (existingProfile.data) {
        sendBtn.disabled = false;
        toast("An account with this email already exists.");
        return;
      }
      var existingInvite = await supabaseClient.from("invites").select("id").ilike("email", email).eq("status", "Pending").maybeSingle();
      if (existingInvite.data) {
        sendBtn.disabled = false;
        toast("This email already has a pending invite.");
        return;
      }

      var insertResult = await supabaseClient.from("invites").insert({
        email: email, full_name: name, role: selectedRole, status: "Pending"
      }).select().single();

      sendBtn.disabled = false;

      if (insertResult.error) {
        toast("Couldn't create the invite: " + insertResult.error.message);
        return;
      }

      await logActivitySupa("Invited account - " + name + " (" + selectedRole + ")");

      var basePath = window.location.pathname.replace(/[^/]*$/, "");
      var link = window.location.origin + basePath + "signup.html?invite=" + insertResult.data.id;

      if (formSection) formSection.style.display = "none";
      if (resultSection) resultSection.classList.add("is-visible");
      if (linkInput) linkInput.value = link;

      toast(name + " invited as " + selectedRole + ". Share the link below with them.");
    });

    var copyBtn = document.getElementById("copy-invite-link-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        linkInput.select();
        linkInput.setSelectionRange(0, 99999);
        navigator.clipboard && navigator.clipboard.writeText(linkInput.value).then(function () {
          toast("Invite link copied!");
        }).catch(function () {
          toast("Couldn't copy automatically \u2014 select and copy the link manually.");
        });
      });
    }
  }

  /* =======================================================================
     Admin — edit account (edit-account.html)
     ======================================================================= */

  function initEditAccountPage() {
    var nameInput = document.getElementById("edit-account-name");
    if (!nameInput) return;

    var id = new URLSearchParams(window.location.search).get("id");

    function setRoleUI(role) {
      document.querySelectorAll("#edit-role-toggle .chip").forEach(function (c) {
        c.classList.toggle("active", c.getAttribute("data-role") === role);
      });
    }
    function setStatusUI(status) {
      document.querySelectorAll("#edit-status-toggle .chip").forEach(function (c) {
        c.classList.toggle("active", c.getAttribute("data-status") === status);
      });
    }

    async function load() {
      var result = await supabaseClient.from("profiles").select("*").eq("id", id).maybeSingle();
      var acc = result.data;
      if (!acc) {
        document.querySelector(".app-main").innerHTML = '<p class="empty-note">Account not found. <a href="admin.html">Back to Admin</a></p>';
        return;
      }

      document.getElementById("edit-account-id").value = acc.id;
      nameInput.value = acc.full_name;
      document.getElementById("edit-account-email").value = acc.email;
      setRoleUI(acc.role);
      setStatusUI(acc.status === "Active" ? "Active" : "Inactive");

      document.querySelectorAll("#edit-role-toggle .chip").forEach(function (chip) {
        chip.addEventListener("click", async function () {
          var role = chip.getAttribute("data-role");
          var updateResult = await supabaseClient.from("profiles").update({ role: role }).eq("id", acc.id);
          if (updateResult.error) { toast("Couldn't update role: " + updateResult.error.message); return; }
          acc.role = role;
          setRoleUI(role);
          await logActivitySupa("Updated account role - " + acc.full_name + " (" + role + ")");
          toast(acc.full_name + "'s role set to " + role + ".");
        });
      });

      document.querySelectorAll("#edit-status-toggle .chip").forEach(function (chip) {
        chip.addEventListener("click", async function () {
          var status = chip.getAttribute("data-status") === "Active" ? "Active" : "Inactive";
          var updateResult = await supabaseClient.from("profiles").update({ status: status }).eq("id", acc.id);
          if (updateResult.error) { toast("Couldn't update status: " + updateResult.error.message); return; }
          acc.status = status;
          setStatusUI(status);
          await logActivitySupa("Updated account status - " + acc.full_name + " (" + status + ")");
          toast(acc.full_name + "'s status set to " + status + ".");
        });
      });

      document.getElementById("deactivate-account-btn").addEventListener("click", async function () {
        var updateResult = await supabaseClient.from("profiles").update({ status: "Inactive" }).eq("id", acc.id);
        if (updateResult.error) { toast("Couldn't deactivate: " + updateResult.error.message); return; }
        acc.status = "Inactive";
        setStatusUI("Inactive");
        await logActivitySupa("Deactivated account - " + acc.full_name);
        toast(acc.full_name + " has been deactivated.");
      });

      document.getElementById("delete-account-btn").addEventListener("click", async function () {
        if (!confirm("Delete " + acc.full_name + "'s account? This can't be undone.")) return;
        var deleteResult = await supabaseClient.from("profiles").delete().eq("id", acc.id);
        if (deleteResult.error) { toast("Couldn't delete: " + deleteResult.error.message); return; }
        await logActivitySupa("Deleted account - " + acc.full_name);
        toast(acc.full_name + "'s account was deleted.");
        setTimeout(function () { window.location.href = "admin.html"; }, 600);
      });
    }

    load();
  }

  /* =======================================================================
     Profile / business settings page (profile.html)
     ======================================================================= */

  function initProfilePage() {
    var nameInput = document.getElementById("profile-name");
    if (!nameInput) return;

    var session = getSession();
    if (!session) { window.location.href = "index.html"; return; }

    var businessSection = document.getElementById("business-settings-section");
    if (session.role !== "Super Admin" && businessSection) {
      businessSection.style.display = "none";
    }

    async function load() {
      var profileResult = await supabaseClient.from("profiles").select("*").eq("email", session.email).maybeSingle();
      var profile = profileResult.data;

      nameInput.value = profile ? profile.full_name : session.firstName;
      document.getElementById("profile-email").value = session.email;
      document.getElementById("profile-role").value = profile ? profile.role : "Staff";

      if (session.role === "Super Admin") {
        var settingsResult = await supabaseClient.from("business_settings").select("*").eq("id", 1).maybeSingle();
        var settings = settingsResult.data || {};
        document.getElementById("business-name").value = settings.bakery_name || "DRR Bakery";
        document.getElementById("business-currency").value = settings.currency || "PHP";
        document.getElementById("business-target-foodcost").value = settings.target_food_cost_pct || "";
        document.getElementById("business-hours").value = settings.business_hours || "";
      }
    }

    document.getElementById("save-profile-btn").addEventListener("click", async function () {
      var fullName = nameInput.value.trim();
      var newPassword = document.getElementById("profile-password").value;
      var saveBtn = document.getElementById("save-profile-btn");
      saveBtn.disabled = true;

      if (newPassword) {
        if (!isValidPassword(newPassword)) {
          saveBtn.disabled = false;
          toast("New password needs 8+ characters with a letter, number, and symbol.");
          return;
        }
        var pwResult = await supabaseClient.auth.updateUser({ password: newPassword });
        if (pwResult.error) {
          saveBtn.disabled = false;
          toast("Couldn't update password: " + pwResult.error.message);
          return;
        }
      }

      var nameResult = await supabaseClient.from("profiles").update({ full_name: fullName }).eq("email", session.email);
      if (nameResult.error) {
        saveBtn.disabled = false;
        toast("Couldn't save profile: " + nameResult.error.message);
        return;
      }

      session.firstName = fullName.split(" ")[0] || fullName;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

      if (session.role === "Super Admin") {
        await supabaseClient.from("business_settings").update({
          bakery_name: document.getElementById("business-name").value.trim(),
          currency: document.getElementById("business-currency").value,
          target_food_cost_pct: parseFloat(document.getElementById("business-target-foodcost").value) || 0,
          business_hours: document.getElementById("business-hours").value.trim()
        }).eq("id", 1);
        await logActivitySupa("Updated profile & business settings");
      } else {
        await logActivitySupa("Updated profile");
      }

      saveBtn.disabled = false;
      document.getElementById("profile-password").value = "";
      toast("Changes saved.");
    });

    load();
  }

  /* =======================================================================
     Record Sale page (record-sale.html)
     ======================================================================= */

  function initRecordSalePage() {
    var select = document.getElementById("sale-bread-item");
    if (!select) return;

    var data = getData();
    var qtyInput = document.getElementById("sale-qty");
    var priceInput = document.getElementById("sale-price");
    var totalInput = document.getElementById("sale-total");

    function populate() {
      select.innerHTML = "";
      if (!data.recipes.length) {
        select.innerHTML = '<option value="">Add a recipe first</option>';
        return;
      }
      data.recipes.forEach(function (r) {
        var opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name;
        select.appendChild(opt);
      });
      onRecipeChange();
    }

    function onRecipeChange() {
      var recipe = data.recipes.find(function (r) { return r.id === select.value; });
      priceInput.value = recipe ? recipe.sellingPrice : "";
      recompute();
    }

    function recompute() {
      var qty = parseFloat(qtyInput.value) || 0;
      var price = parseFloat(priceInput.value) || 0;
      totalInput.value = "\u20B1" + (qty * price).toFixed(2);
    }

    select.addEventListener("change", onRecipeChange);
    qtyInput.addEventListener("input", recompute);
    priceInput.addEventListener("input", recompute);

    document.getElementById("save-sale-btn").addEventListener("click", function () {
      var recipe = data.recipes.find(function (r) { return r.id === select.value; });
      var qty = parseFloat(qtyInput.value);
      var price = parseFloat(priceInput.value);

      if (!recipe) { toast("Add a recipe first."); return; }
      if (!qty || qty <= 0) { toast("Enter a quantity sold."); return; }
      if (!price || price < 0) { toast("Enter a price."); return; }

      var revenue = qty * price;
      var foodCost = qty * recipe.costPerPiece;
      var grossProfit = revenue - foodCost;

      data.sales.push({ date: todayLabel(), item: recipe.name, revenue: revenue, foodCost: foodCost, grossProfit: grossProfit });

      if (!data.breadStats[recipe.name]) data.breadStats[recipe.name] = { sold: 0 };
      data.breadStats[recipe.name].sold += qty;

      var stockEntry = data.breadStock.find(function (b) { return b.name === recipe.name; });
      if (stockEntry) {
        stockEntry.sold += qty;
        stockEntry.remaining = Math.max(0, stockEntry.baked - stockEntry.sold);
        stockEntry.lastUpdated = todayLabel();
      }

      logActivity(data, "Recorded sale - " + recipe.name + " x" + qty);
      saveData(data);

      qtyInput.value = "";
      recompute();
      toast("Sale recorded: " + qty + " " + recipe.name + " for \u20B1" + revenue.toFixed(2) + ".");
    });

    populate();
  }

  /* =======================================================================
     Analytics page
     ======================================================================= */

  function initAnalyticsPage() {
    var el = document.getElementById("stat-total-sales");
    if (!el) return;
    var data = getData();

    function renderTotals() {
      var totalSales = data.sales.reduce(function (s, x) { return s + x.revenue; }, 0);
      var totalCost = data.sales.reduce(function (s, x) { return s + x.foodCost; }, 0);
      var gross = totalSales - totalCost;
      document.getElementById("stat-total-sales").textContent = "\u20B1 " + totalSales.toFixed(0);
      document.getElementById("stat-total-cost").textContent = "\u20B1 " + totalCost.toFixed(0);
      document.getElementById("stat-gross-profit").textContent = "\u20B1 " + gross.toFixed(0);
      document.getElementById("stat-net-profit").textContent = "\u20B1 " + gross.toFixed(0);
    }

    function renderBestLowest() {
      var stats = data.breadStats;
      var names = Object.keys(stats);
      var bestName = "Pandesal", bestQty = 180, lowName = "Spanish Bread", lowQty = 10;
      if (names.length) {
        names.sort(function (a, b) { return stats[b].sold - stats[a].sold; });
        bestName = names[0]; bestQty = stats[bestName].sold;
        names.sort(function (a, b) { return stats[a].sold - stats[b].sold; });
        lowName = names[0]; lowQty = stats[lowName].sold;
      }
      document.getElementById("best-selling-text").textContent = bestName + " \u2014 " + bestQty + " pcs sold";
      document.getElementById("lowest-selling-text").textContent = lowName + " \u2014 " + lowQty + " pcs sold";
    }

    function renderRanking() {
      var tbody = document.getElementById("ranking-body");
      tbody.innerHTML = "";
      var rows = data.recipes.length ? data.recipes.map(function (r) {
        var profit = (r.sellingPrice || 0) - r.costPerPiece;
        var margin = r.sellingPrice ? (profit / r.sellingPrice) * 100 : 0;
        return { name: r.name, cost: r.costPerPiece, price: r.sellingPrice || 0, profit: profit, margin: margin };
      }) : [
        { name: "Pandesal", cost: 2.00, price: 5.00, profit: 3.00, margin: 64 },
        { name: "Spanish Bread", cost: 2.50, price: 6.00, profit: 3.50, margin: 62.5 },
        { name: "Ensaymada", cost: 6.00, price: 10.00, profit: 4.00, margin: 56 }
      ];
      rows.forEach(function (r, i) {
        var tr = document.createElement("tr");
        var status = r.margin >= 50 ? '<span class="status-text good">High Profit</span>' : '<span class="status-text bad">Low Profit</span>';
        tr.innerHTML =
          "<td>" + (i + 1) + "</td><td>" + r.name + "</td>" +
          "<td>\u20B1" + r.cost.toFixed(2) + "</td><td>\u20B1" + r.price.toFixed(2) + "</td>" +
          "<td>\u20B1" + r.profit.toFixed(2) + "</td><td>" + r.margin.toFixed(1) + "%</td><td>" + status + "</td>";
        tbody.appendChild(tr);
      });
    }

    function populateBreadItemSelect() {
      var select = document.getElementById("forecast-bread-item");
      select.innerHTML = "";
      var items = data.recipes.length ? data.recipes.map(function (r) { return { name: r.name, price: r.sellingPrice || 0 }; })
        : [{ name: "Pandesal", price: 5 }, { name: "Spanish Bread", price: 6 }, { name: "Ensaymada", price: 10 }];
      items.forEach(function (it) {
        var opt = document.createElement("option");
        opt.value = it.name;
        opt.dataset.price = it.price;
        opt.textContent = it.name;
        select.appendChild(opt);
      });
      if (items.length) document.getElementById("forecast-price").value = items[0].price;
    }

    document.getElementById("forecast-bread-item").addEventListener("change", function () {
      var opt = this.options[this.selectedIndex];
      document.getElementById("forecast-price").value = opt.dataset.price || 0;
      recomputeForecast();
    });

    function recomputeForecast() {
      var pcs = parseFloat(document.getElementById("forecast-pcs").value) || 0;
      var price = parseFloat(document.getElementById("forecast-price").value) || 0;
      var wastePct = parseFloat(document.getElementById("forecast-waste-pct").value) || 0;
      var wastePcs = Math.round(pcs * (wastePct / 100));
      document.getElementById("forecast-waste-pcs-label").textContent = wastePct + "% (" + wastePcs + "pcs)";

      var recipeMatch = data.recipes.find(function (r) { return r.name === document.getElementById("forecast-bread-item").value; });
      var unitCost = recipeMatch ? recipeMatch.costPerPiece : (price * 0.4);

      var sellablePcs = Math.max(0, pcs - wastePcs);
      var revenue = sellablePcs * price;
      var foodCost = pcs * unitCost;
      var grossProfit = revenue - foodCost;
      var margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      document.getElementById("forecast-revenue").textContent = "\u20B1 " + revenue.toFixed(0);
      document.getElementById("forecast-foodcost").textContent = "\u20B1 " + foodCost.toFixed(0);
      document.getElementById("forecast-grossprofit").textContent = "\u20B1 " + grossProfit.toFixed(0);
      document.getElementById("forecast-margin").textContent = margin.toFixed(0) + "%";

      return { revenue: revenue, foodCost: foodCost, grossProfit: grossProfit, sellablePcs: sellablePcs, pcs: pcs };
    }

    ["forecast-pcs","forecast-price","forecast-waste-pct"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", recomputeForecast);
    });

    document.getElementById("save-forecast-btn").addEventListener("click", function () {
      var name = document.getElementById("forecast-bread-item").value;
      var result = recomputeForecast();
      if (!result.pcs) { toast("Enter expected pieces to bake & sell."); return; }

      data.sales.push({ date: todayLabel(), item: name, revenue: result.revenue, foodCost: result.foodCost, grossProfit: result.grossProfit });
      if (!data.breadStats[name]) data.breadStats[name] = { sold: 0 };
      data.breadStats[name].sold += result.sellablePcs;
      logActivity(data, "Saved forecast - " + name + " (" + result.pcs + " pcs)");
      saveData(data);

      renderTotals();
      renderBestLowest();
      toast("Forecast saved for " + name + ".");
    });

    document.getElementById("print-report-btn").addEventListener("click", function () { window.print(); });

    populateBreadItemSelect();
    recomputeForecast();
    renderTotals();
    renderBestLowest();
    renderRanking();
  }

  /* =======================================================================
     Init
     ======================================================================= */

  document.addEventListener("DOMContentLoaded", async function () {
    initPasswordToggles();
    initSignupForm();
    initLoginForm();
    initForgotPasswordForm();
    initGoogleSignIn();

    var chromeOk = await initAppChrome();
    if (chromeOk === false) return;

    initDashboardPage();
    initRecipesListPage();
    initRecipeFormPage();
    initRecipeViewPage();
    initInventoryPage();
    initAdminPage();
    initInviteAccountPage();
    initEditAccountPage();
    initProfilePage();
    initRecordSalePage();
    initAnalyticsPage();
  });
})();