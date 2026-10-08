/* ==========================================================================
   DRR Bakery — Shared Script
   Auth pages (index/signup/forgot-password) + App pages
   (dashboard/recipes/recipe-form/recipe-view/inventory/admin/
    invite-account/edit-account/profile/record-sale/analytics)

   NOTE: Data is stored in Supabase (see supabase-schema.sql). This file
   expects a Supabase client named `supabaseClient`. If your page already
   creates one (e.g. in supabase-config.js loaded BEFORE this file), that
   one is used. Otherwise fill in the two values in the bootstrap below.
   ========================================================================== */

/* Load the brand fonts without blocking the first paint (the old CSS @import
   made the browser show a blank page until Google Fonts answered). */
(function () {
  if (document.getElementById("drr-fonts")) return;
  var l = document.createElement("link");
  l.id = "drr-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Caprasimo&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(l);
})();

/* --------------------------------------------------------------------------
   Supabase bootstrap — only creates the client if one doesn't already exist.
   Load the Supabase library BEFORE this file:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   -------------------------------------------------------------------------- */
(function () {
  if (typeof supabaseClient !== "undefined") return; // already created elsewhere
  var url = "YOUR_SUPABASE_URL";           // e.g. https://xxxx.supabase.co
  var key = "YOUR_SUPABASE_ANON_KEY";      // the public anon key
  if (url.indexOf("YOUR_") === 0 || key.indexOf("YOUR_") === 0) {
    console.error("script.js: supabaseClient is not defined. Fill in the URL and anon key at the top of script.js, or load your config file before it.");
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("script.js: the Supabase library must be loaded before script.js.");
    return;
  }
  window.supabaseClient = window.supabase.createClient(url, key);
})();


(function () {
  "use strict";

  var USERS_KEY = "drrBakeryUsers";
  var REMEMBER_KEY = "drrBakeryRememberedEmail";
  var SESSION_KEY = "drrBakerySession";

  // Phone number shown in the footer of every page. Change it here (and only here).
  var CONTACT_PHONE = "+63 000 000 0000";

  var ROLES = ["Super Admin", "Admin", "Staff"];

  // Which roles may open each page. Pages not listed are open to any logged-in role.
  var ROUTE_ROLES = {
    "admin.html": ["Super Admin"],
    "invite-account.html": ["Super Admin"],
    "create-account.html": ["Super Admin"],
    "edit-account.html": ["Super Admin"],
    "analytics.html": ["Admin", "Super Admin"],
    "recipe-form.html": ["Admin", "Super Admin"]
  };

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

  /* ---- Names: first / middle / last ----
     Profiles keep a combined full_name (used everywhere for display) and, once
     supabase-name-fields.sql has been run, separate first_name / middle_name /
     last_name columns. Older accounts without those columns are split by
     position: first word = first name, last word = last name, the rest = middle. */
  function splitFullName(full) {
    var p = String(full || "").trim().split(/\s+/).filter(Boolean);
    if (p.length <= 1) return { first: p[0] || "", middle: "", last: "" };
    return { first: p[0], middle: p.slice(1, -1).join(" "), last: p[p.length - 1] };
  }
  function nameOf(rec) {
    if (rec && (rec.first_name || rec.last_name)) {
      return { first: rec.first_name || "", middle: rec.middle_name || "", last: rec.last_name || "" };
    }
    return splitFullName(rec && rec.full_name);
  }
  function joinName(first, middle, last) {
    return [first, middle, last].map(function (x) { return String(x || "").trim(); }).filter(Boolean).join(" ");
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
    catch (e) { return null; }
  }

  function getCurrentRole() {
    var s = getSession();
    return s && s.role ? s.role : null;
  }

  function currentUserName() {
    var s = getSession();
    return s && s.firstName ? s.firstName : "Guest";
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function isValidPassword(value) {
    var hasLower = /[a-z]/.test(value);
    var hasUpper = /[A-Z]/.test(value);
    var hasNumber = /[0-9]/.test(value);
    var hasSymbol = /[^A-Za-z0-9]/.test(value);
    return value.length >= 8 && hasLower && hasUpper && hasNumber && hasSymbol;
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
    var setupMode = params.get("setup") === "1";   // arrived from the emailed confirmation link
    var confirmedSession = null;

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
      if (setupMode) {
        // They clicked the confirmation email: Supabase has already confirmed the
        // email and signed them in. All that's left is their name + a password.
        var sess = await getSessionResilient();
        var smeta = (sess && sess.user && sess.user.user_metadata) || {};
        if (!sess) {
          showBlocked("This confirmation link has expired or was already used. If you already finished signing up, log in. Otherwise ask your Super Admin to send a new invite.", "Link Expired");
          return;
        }
        if (smeta.account_setup_done === true) { window.location.href = "dashboard.html"; return; }
        confirmedSession = sess;
        if (headingEl) headingEl.textContent = "Email Confirmed";
        if (subheadingEl) subheadingEl.textContent = "Welcome to DRR Bakery! Add your name and choose a password to finish creating your account.";
        emailInput.value = sess.user.email || "";
        emailInput.setAttribute("disabled", "disabled");
        var submitLabel = form.querySelector("button[type='submit']");
        if (submitLabel) submitLabel.textContent = "Finish Sign Up";
        return;
      }
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
        var invitedName = nameOf(record);
        document.getElementById("first-name").value = invitedName.first;
        var midInput = document.getElementById("middle-name");
        if (midInput) midInput.value = invitedName.middle;
        document.getElementById("last-name").value = invitedName.last;
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
      var middleName = (document.getElementById("middle-name") || { value: "" }).value.trim();
      var lastName = document.getElementById("last-name").value.trim();
      var email = invitedRecord ? invitedRecord.email : document.getElementById("email").value.trim();
      var password = document.getElementById("password").value;
      var hasError = false;

      if (!firstName) { setFieldError("first-name", "First name is required."); hasError = true; }
      if (!lastName) { setFieldError("last-name", "Last name is required."); hasError = true; }
      if (!invitedRecord && !confirmedSession) {
        if (!email) {
          setFieldError("email", "Email is required."); hasError = true;
        } else if (!isValidEmail(email)) {
          setFieldError("email", "Enter a valid email address."); hasError = true;
        }
      }
      if (!password) {
        setFieldError("password", "Password is required."); hasError = true;
      } else if (!isValidPassword(password)) {
        setFieldError("password", "Use at least 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol."); hasError = true;
      }
      if (hasError) return;

      var submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;

      var fullName = joinName(firstName, middleName, lastName);

      if (confirmedSession) {
        // Email already confirmed: set the password, save the name, go to the app.
        var upd = await supabaseClient.auth.updateUser({
          password: password,
          data: { full_name: fullName, first_name: firstName, middle_name: middleName, last_name: lastName, account_setup_done: true }
        });
        if (upd.error) {
          submitBtn.disabled = false;
          showAlert(alertEl, "error", upd.error.message || "Couldn't save your password.");
          return;
        }
        var saved = await supabaseClient.rpc("complete_account_setup", { p_first: firstName, p_middle: middleName, p_last: lastName });
        if (saved.error) {
          // Fallback if the SQL helper hasn't been installed: update the profile row directly.
          saved = await supabaseClient.from("profiles").update({ full_name: fullName, first_name: firstName, middle_name: middleName, last_name: lastName }).eq("id", confirmedSession.user.id);
          if (saved.error) {
            saved = await supabaseClient.from("profiles").update({ full_name: fullName }).eq("id", confirmedSession.user.id);
          }
        }
        sessionStorage.removeItem(SESSION_KEY);
        setFlash("Welcome to DRR Bakery, " + firstName + "!");
        showAlert(alertEl, "success", "All set! Taking you to DRR Bakery\u2026");
        setTimeout(function () { window.location.href = "dashboard.html"; }, 900);
        return;
      }

      // The profile row, role, invite status and activity log entry are now
      // created server-side by the handle_new_user trigger (see fix-signup.sql),
      // because with email confirmation ON there is no session after signUp,
      // so the browser can't insert into profiles itself.
      var signUpResult = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { full_name: fullName, first_name: firstName, middle_name: middleName, last_name: lastName },
          emailRedirectTo: window.location.origin + window.location.pathname.replace(/[^\/]*$/, "") + "index.html"
        }
      });
      if (signUpResult.error) {
        submitBtn.disabled = false;
        showAlert(alertEl, "error", signUpResult.error.message || "Couldn't create that account.");
        return;
      }

      form.reset();
      if (signUpResult.data.session) {
        // Email confirmation is OFF: user is already signed in.
        await supabaseClient.auth.signOut();
        showAlert(alertEl, "success", "Account created! Redirecting you to log in\u2026");
      } else {
        showAlert(alertEl, "success", "Account created! Check your email and click the confirmation link, then log in.");
      }
      setTimeout(function () { window.location.href = "index.html"; }, 3000);
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

    // Only offer "Sign Up" while there is no account yet (first-time setup)
    var signupPrompt = document.getElementById("signup-prompt");
    if (signupPrompt) {
      supabaseClient.rpc("profiles_count").then(function (res) {
        if (!res.error && res.data === 0) signupPrompt.style.display = "";
      });
    }

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

      var firstName = nameOf(profile).first || profile.full_name;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ firstName: firstName, email: profile.email, role: profile.role }));
      showAlert(alertEl, "success", "Welcome back, " + firstName + "! Redirecting\u2026");
      setTimeout(function () { window.location.href = "dashboard.html"; }, 900);
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
      var redirectTo = window.location.origin + basePath + "reset-password.html";

      await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });

      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      showAlert(alertEl, "success", "If an account exists for " + email + ", a reset link is on its way.");
      form.reset();
    });
  }

    /* =======================================================================
     Set New Password page (reset-password.html) — where the link from the
     reset email actually lands. Supabase's client auto-detects the
     access_token in the URL and fires a PASSWORD_RECOVERY auth event once
     it's parsed the session from that link.
     ======================================================================= */

  function initResetPasswordForm() {
    var form = document.getElementById("reset-password-form");
    if (!form) return;

    var alertEl = document.getElementById("reset-alert");
    var headingEl = document.getElementById("reset-heading");
    var subheadingEl = document.getElementById("reset-subheading");
    var submitBtn = document.getElementById("reset-submit-btn");
    var sessionReady = false;

    function showInvalidLink() {
      if (headingEl) headingEl.textContent = "Link Invalid or Expired";
      if (subheadingEl) subheadingEl.textContent = "This reset link didn't work — it may have already been used, or it's expired. Request a new one from the login page.";
      form.style.display = "none";
    }

    // Case 1: Supabase already finished parsing the link by the time this runs.
    supabaseClient.auth.getSession().then(function (result) {
      if (result.data && result.data.session) sessionReady = true;
      else if (window.location.hash.indexOf("type=recovery") === -1) {
        // No token in the URL at all and no session — this page was opened directly.
        setTimeout(function () { if (!sessionReady) showInvalidLink(); }, 1500);
      }
    });

    // Case 2: the PASSWORD_RECOVERY event fires once Supabase parses the link.
    supabaseClient.auth.onAuthStateChange(function (event) {
      if (event === "PASSWORD_RECOVERY") sessionReady = true;
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      hideAlert(alertEl);
      clearAllFieldErrors(form);

      var newPassword = document.getElementById("new-password").value;
      var confirmPassword = document.getElementById("confirm-password").value;
      var hasError = false;

      if (!newPassword) {
        setFieldError("new-password", "Password is required."); hasError = true;
      } else if (!isValidPassword(newPassword)) {
        setFieldError("new-password", "Use at least 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol."); hasError = true;
      }
      if (!confirmPassword) {
        setFieldError("confirm-password", "Please confirm your new password."); hasError = true;
      } else if (newPassword && confirmPassword !== newPassword) {
        setFieldError("confirm-password", "Passwords don't match."); hasError = true;
      }
      if (hasError) return;

      var sessionCheck = await supabaseClient.auth.getSession();
      if (!sessionCheck.data || !sessionCheck.data.session) {
        showAlert(alertEl, "error", "This link is invalid or has expired. Go back and request a new one.");
        return;
      }

      submitBtn.disabled = true;
      var updateResult = await supabaseClient.auth.updateUser({ password: newPassword });

      if (updateResult.error) {
        submitBtn.disabled = false;
        showAlert(alertEl, "error", updateResult.error.message || "Couldn't update your password. Try again.");
        return;
      }

      showAlert(alertEl, "success", "Password updated! Redirecting you to log in…");
      form.reset();
      await supabaseClient.auth.signOut();
      setTimeout(function () { window.location.href = "index.html"; }, 1500);
    });
  }


  /* =======================================================================
     App data layer — shared across every app page
     Business data (ingredients, recipes, bread inventory, sales, forecasts)
     lives in real Supabase tables — see supabase-schema.sql. Every browser,
     every account, every device reads and writes the same shared data.
     ======================================================================= */

  function todayLabel() {
    return new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function currentUserId() {
    var s = getSession();
    return s && s.id ? s.id : null;
  }

  /* ---- toast (shared across app pages) ---- */
  var pageIsUnloading = false;
  window.addEventListener("pagehide", function () { pageIsUnloading = true; });
  window.addEventListener("beforeunload", function () { pageIsUnloading = true; });
  window.addEventListener("pageshow", function () { pageIsUnloading = false; });
  // Requests cancelled by a refresh are expected - don't surface them as errors.
  window.addEventListener("unhandledrejection", function (e) { if (pageIsUnloading) e.preventDefault(); });

  function toast(msg) {
    if (pageIsUnloading) return;
    var el = document.getElementById("app-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("is-visible"); }, 2400);
  }

  function escAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  var FLASH_KEY = "drrBakeryFlash";

  async function logActivitySupa(action) {
    var userId = currentUserId();
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

  /* ---- Ingredients ---- */

  // The only categories a raw ingredient can belong to (used by the dropdowns).
  var INGREDIENT_CATEGORIES = [
    "Flour & Grains",
    "Sugars & Sweeteners",
    "Fats & Oils",
    "Dairy & Liquids",
    "Eggs",
    "Yeast & Baking Soda",
    "Flavorings & Spices",
    "Add-ins & Toppings"
  ];

  // Builds <option> tags. If an older ingredient has a category that is not in the
  // list, it is kept as an extra option so editing it never silently changes it.
  function categoryOptionsHtml(selected, withPlaceholder) {
    // The placeholder is only the prompt shown before choosing - it is hidden from the dropdown list itself.
    var html = withPlaceholder ? '<option value="" disabled selected hidden>Select category</option>' : "";
    var list = INGREDIENT_CATEGORIES.slice();
    if (selected && list.indexOf(selected) === -1) list.push(selected);
    list.forEach(function (c) {
      html += '<option value="' + escAttr(c) + '"' + (c === selected ? " selected" : "") + ">" + escAttr(c) + "</option>";
    });
    return html;
  }

  // Units that can be converted into each other: weight (g, kg), volume (ml, L) and count (pc).
  var UNIT_FAMILY = { g: ["w", 1], kg: ["w", 1000], ml: ["v", 1], L: ["v", 1000], pc: ["c", 1] };

  // How many "to" units are in one "from" unit (e.g. kg -> g = 1000). Returns null if they can't be converted (e.g. kg -> ml).
  function unitFactor(from, to) {
    var a = UNIT_FAMILY[from], b = UNIT_FAMILY[to];
    if (!a || !b || a[0] !== b[0]) return null;
    return a[1] / b[1];
  }

  function unitOptionsHtml(selected) {
    return ["g", "kg", "ml", "L", "pc"].map(function (u) {
      return '<option value="' + u + '"' + (u === selected ? " selected" : "") + ">" + u + "</option>";
    }).join("");
  }

  // Cost per unit can be a fraction of a peso (e.g. flour is about P0.05/g), so never round it to 2 decimals.
  // Money & percentage display: always exactly 2 decimals (centavos), never rounded to whole pesos.
  // Calculations keep full precision; only what is SHOWN (or stored as a sale amount) is rounded to the centavo.
  function r2(n) { return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100; }
  function peso(n) { return "\u20B1" + r2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct2(n) { return r2(n).toFixed(2) + "%"; }
  // Ingredient cost the way a bakery lists it: per kg, per liter or per piece (stored per g / ml / pc).
  function fmtCostPer(cost, unit) {
    var c = Number(cost) || 0, u = unit;
    if (unit === "g") { c *= 1000; u = "kg"; }
    else if (unit === "ml") { c *= 1000; u = "L"; }
    return peso(c) + " / " + u;
  }

  // Stops tiny floating-point leftovers (e.g. 22999.999999997) from being stored as stock.
  function round4(n) { return Math.round((Number(n) || 0) * 10000) / 10000; }

  // Quantity for display: up to 2 decimals, no trailing zeros (2.46 stays 2.46, 16 stays 16).
  function fmtQty(n) { return Number(Number(n).toFixed(2)).toLocaleString(undefined, { maximumFractionDigits: 2 }); }

  function fmtUnitCost(n) {
    var v = Number(n) || 0;
    return v >= 1 ? v.toFixed(2) : v.toFixed(4);
  }

  // Ingredient prices changed -> keep every recipe that uses it in sync (line costs, batch cost, cost per piece).
  async function recalcRecipesForIngredient(ingredientId, newCostPerUnit) {
    try {
      var linesRes = await supabaseClient.from("recipe_ingredients").select("id, recipe_id, quantity").eq("ingredient_id", ingredientId);
      var lines = linesRes.data || [];
      if (!lines.length) return;
      for (var i = 0; i < lines.length; i++) {
        await supabaseClient.from("recipe_ingredients").update({ line_cost: lines[i].quantity * newCostPerUnit }).eq("id", lines[i].id);
      }
      var recipeIds = lines.map(function (l) { return l.recipe_id; }).filter(function (v, idx, a) { return a.indexOf(v) === idx; });
      for (var r = 0; r < recipeIds.length; r++) {
        var rid = recipeIds[r];
        var allLines = await supabaseClient.from("recipe_ingredients").select("line_cost").eq("recipe_id", rid);
        var recRes = await supabaseClient.from("recipes").select("base_batch_size").eq("id", rid).maybeSingle();
        var total = (allLines.data || []).reduce(function (sum, l) { return sum + (l.line_cost || 0); }, 0);
        var base = recRes.data ? recRes.data.base_batch_size : 0;
        await supabaseClient.from("recipes").update({
          total_batch_cost: total,
          cost_per_piece: base > 0 ? total / base : 0,
          updated_at: new Date().toISOString()
        }).eq("id", rid);
      }
    } catch (e) { /* recipe costs will refresh next time the recipe is saved */ }
  }

  async function fetchIngredients() {
    var result = await supabaseClient.from("ingredients").select("*").order("name");
    return result.data || [];
  }

  async function insertIngredient(fields) {
    fields.updated_by = currentUserId();
    return await supabaseClient.from("ingredients").insert(fields).select().single();
  }

  async function updateIngredient(id, fields) {
    fields.updated_by = currentUserId();
    fields.updated_at = new Date().toISOString();
    return await supabaseClient.from("ingredients").update(fields).eq("id", id);
  }

  /* ---- Recipes (+ their ingredient line items) ---- */

  // Recipe costs must always follow today's inventory prices. This re-prices every recipe line
  // (quantity x current cost per unit) and updates batch cost / cost per piece wherever they differ.
  var recipeSyncPromise = null;
  async function syncAllRecipeCosts() {
    try {
      var ingRes = await supabaseClient.from("ingredients").select("id, cost_per_unit");
      var lineRes = await supabaseClient.from("recipe_ingredients").select("id, recipe_id, ingredient_id, quantity, line_cost");
      var recRes = await supabaseClient.from("recipes").select("id, base_batch_size, total_batch_cost, cost_per_piece");
      var cost = {};
      (ingRes.data || []).forEach(function (i) { cost[i.id] = Number(i.cost_per_unit) || 0; });
      var totals = {};
      var lines = lineRes.data || [];
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        var expected = cost[l.ingredient_id] != null ? l.quantity * cost[l.ingredient_id] : l.line_cost;
        totals[l.recipe_id] = (totals[l.recipe_id] || 0) + expected;
        if (cost[l.ingredient_id] != null && Math.abs((l.line_cost || 0) - expected) > 1e-6) {
          await supabaseClient.from("recipe_ingredients").update({ line_cost: expected }).eq("id", l.id);
        }
      }
      var recipes = recRes.data || [];
      for (var r = 0; r < recipes.length; r++) {
        var rec = recipes[r];
        if (totals[rec.id] == null) continue;
        var total = totals[rec.id];
        var cpp = rec.base_batch_size > 0 ? total / rec.base_batch_size : 0;
        if (Math.abs((rec.total_batch_cost || 0) - total) > 1e-6 || Math.abs((rec.cost_per_piece || 0) - cpp) > 1e-6) {
          await supabaseClient.from("recipes").update({ total_batch_cost: total, cost_per_piece: cpp, updated_at: new Date().toISOString() }).eq("id", rec.id);
        }
      }
    } catch (e) { /* not allowed or offline: pages still show correct live costs where they re-price lines */ }
  }
  function ensureRecipeCostsSynced() {
    if (getCurrentRole() === "Staff") return Promise.resolve();
    if (!recipeSyncPromise) recipeSyncPromise = syncAllRecipeCosts();
    return recipeSyncPromise;
  }

  async function fetchRecipes() {
    await ensureRecipeCostsSynced();
    var result = await supabaseClient.from("recipes").select("*").order("name");
    return result.data || [];
  }

  async function fetchRecipeWithIngredients(id) {
    await ensureRecipeCostsSynced();
    var recipeResult = await supabaseClient.from("recipes").select("*").eq("id", id).maybeSingle();
    if (!recipeResult.data) return null;
    var lineResult = await supabaseClient
      .from("recipe_ingredients")
      .select("*, ingredients(name, category, unit, cost_per_unit, stock_qty)")
      .eq("recipe_id", id);
    var lines = (lineResult.data || []).map(function (row) {
      return {
        id: row.id,
        ingredientId: row.ingredient_id,
        name: row.ingredients ? row.ingredients.name : "(deleted ingredient)",
        category: row.ingredients ? row.ingredients.category : "",
        unit: row.unit,
        qty: row.quantity,
        // Always priced at the ingredient's CURRENT inventory cost (falls back to the saved cost if it was deleted).
        lineCost: row.ingredients && row.ingredients.cost_per_unit != null ? row.quantity * row.ingredients.cost_per_unit : row.line_cost,
        stock: row.ingredients ? row.ingredients.stock_qty : null
      };
    });
    return { recipe: recipeResult.data, lineItems: lines };
  }

  async function saveRecipe(recipeFields, lineItems, existingId) {
    var payload = {
      name: recipeFields.name,
      category: recipeFields.category,
      base_batch_size: recipeFields.baseBatchSize,
      portions_per_piece: recipeFields.portionsPerPiece,
      preparation_notes: recipeFields.notes,
      total_batch_cost: recipeFields.totalBatchCost,
      cost_per_piece: recipeFields.costPerPiece,
      target_food_cost_pct: recipeFields.targetFoodCostPct,
      suggested_selling_price: recipeFields.suggestedSellingPrice,
      selling_price: recipeFields.sellingPrice,
      updated_at: new Date().toISOString()
    };

    var recipeId = existingId;
    if (existingId) {
      var updateResult = await supabaseClient.from("recipes").update(payload).eq("id", existingId);
      if (updateResult.error) return { error: updateResult.error };
      await supabaseClient.from("recipe_ingredients").delete().eq("recipe_id", existingId);
    } else {
      payload.created_by = currentUserId();
      var insertResult = await supabaseClient.from("recipes").insert(payload).select().single();
      if (insertResult.error) return { error: insertResult.error };
      recipeId = insertResult.data.id;
    }

    var rows = lineItems.map(function (item) {
      return {
        recipe_id: recipeId,
        ingredient_id: item.ingredientId,
        quantity: item.qty,
        unit: item.unit,
        line_cost: item.lineCost
      };
    });
    if (rows.length) {
      var lineInsert = await supabaseClient.from("recipe_ingredients").insert(rows);
      if (lineInsert.error) return { error: lineInsert.error };
    }

    return { data: { id: recipeId } };
  }

  /* ---- Bread inventory (production batches) ---- */

  async function fetchBreadInventory() {
    var result = await supabaseClient
      .from("bread_inventory")
      .select("*, recipes(name, selling_price)")
      .order("date_baked", { ascending: false });
    return result.data || [];
  }

  async function insertBreadBatch(recipeId, qtyBaked, consumedIngredients, batchName) {
    var batchResult = await supabaseClient.from("bread_inventory").insert({
      recipe_id: recipeId,
      quantity_baked: qtyBaked,
      quantity_sold: 0,
      batch: batchName || null,
      date_baked: new Date().toISOString().slice(0, 10),
      logged_by: currentUserId()
    }).select().single();
    if (batchResult.error) return batchResult;

    for (var i = 0; i < consumedIngredients.length; i++) {
      var c = consumedIngredients[i];
      await supabaseClient.from("ingredients")
        .update({ stock_qty: round4(Math.max(0, c.newStockQty)), updated_at: new Date().toISOString() })
        .eq("id", c.ingredientId);
    }
    return batchResult;
  }

  async function updateBreadBatchSold(batchId, newQtySold) {
    return await supabaseClient.from("bread_inventory")
      .update({ quantity_sold: newQtySold, updated_at: new Date().toISOString() })
      .eq("id", batchId);
  }

  /* ---- Sales ---- */

  function dateRangeStartISO(rangeKey) {
    var now = new Date();
    var start = new Date(now);
    if (rangeKey === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (rangeKey === "7days") {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (rangeKey === "30days") {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else {
      return null; // "all"
    }
    return start.toISOString();
  }

  async function fetchSales(rangeKey) {
    var query = supabaseClient.from("sales").select("*, recipes(name)").order("sale_datetime", { ascending: false });
    var startISO = dateRangeStartISO(rangeKey || "today");
    if (startISO) query = query.gte("sale_datetime", startISO);
    var result = await query;
    return result.data || [];
  }

  async function insertSale(recipeId, breadInventoryId, qty, unitPrice, foodCostPerUnit) {
    unitPrice = r2(unitPrice);                 // prices are in centavos
    var totalAmount = r2(qty * unitPrice);     // a receipt total is to the centavo
    var foodCost = qty * foodCostPerUnit;
    var grossProfit = totalAmount - foodCost;
    return await supabaseClient.from("sales").insert({
      recipe_id: recipeId,
      bread_inventory_id: breadInventoryId,
      quantity: qty,
      unit_price: unitPrice,
      total_amount: totalAmount,
      food_cost: foodCost,
      gross_profit: grossProfit,
      logged_by: currentUserId()
    }).select().single();
  }

  /* ---- Profit forecasts (hypothetical — kept separate from real sales) ---- */

  async function insertForecast(recipeId, expectedUnits, wastePct, revenue, foodCost, grossProfit, marginPct) {
    return await supabaseClient.from("profit_forecast").insert({
      recipe_id: recipeId,
      expected_units: expectedUnits,
      expected_waste_pct: wastePct,
      expected_revenue: revenue,
      expected_food_cost: foodCost,
      expected_gross_profit: grossProfit,
      expected_margin_pct: marginPct,
      created_by: currentUserId()
    });
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

  // Header navigation guard: stops rapid / repeated clicks from re-triggering
  // navigation (which caused reloads and flicker). Clicking the page you are
  // already on does nothing; once a navigation has started, further clicks
  // on any nav link are ignored.
  function initNavClickGuard() {
    var navigating = false;
    var links = document.querySelectorAll(".app-nav a");
    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        var href = a.getAttribute("href");
        var plainClick = !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1);
        if (!plainClick) return; // let "open in new tab" work normally
        if (navigating || href === currentPageFile()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        navigating = true;
        links.forEach(function (l) { l.classList.remove("nav-pending"); });
        a.classList.add("nav-pending");
      });
    });
    // If the page is restored from the back/forward cache, allow clicking again.
    window.addEventListener("pageshow", function (e) { if (e.persisted) navigating = false; });
  }

  // Reading the Supabase session can briefly come back empty (or throw) when a
  // page is refreshed many times in a row, because the previous page load may
  // still be holding the auth lock. Retry a few times before treating the user
  // as logged out, so quick refreshes never kick someone to the login page.
  async function getSessionResilient() {
    var attempts = 4;
    for (var i = 0; i < attempts; i++) {
      try {
        var res = await supabaseClient.auth.getSession();
        if (res && res.data && res.data.session) return res.data.session;
      } catch (e) { /* retry */ }
      if (i < attempts - 1) await new Promise(function (r) { setTimeout(r, 120 * (i + 1)); });
    }
    return null;
  }

  async function initAppChrome() {
    var avatarBtn = document.getElementById("avatar-btn");
    if (!avatarBtn) return;

    // Check the REAL Supabase session (persists across tabs/refreshes),
    // and refresh our lightweight sessionStorage mirror from it.
    var supaSession = await getSessionResilient();
    if (!supaSession) {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = "index.html";
      return false;
    }

    // Someone who clicked an invite email but hasn't added their name/password yet
    // must finish sign-up first.
    var meta = (supaSession.user && supaSession.user.user_metadata) || {};
    if (meta.account_setup_done === false) {
      window.location.href = "signup.html?setup=1";
      return false;
    }

    // Fast path: if this tab already knows who is logged in, render immediately
    // from that and double-check the profile in the background. This removes one
    // network round-trip from every page load / refresh.
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (e) { cached = null; }
    var profilePromise = supabaseClient.from("profiles").select("*").eq("id", supaSession.user.id).maybeSingle();
    var profile;
    if (cached && cached.id === supaSession.user.id && cached.role && (cached.fullName || cached.firstName)) {
      profile = { full_name: cached.fullName || cached.firstName, email: cached.email, role: cached.role, status: "Active" };
      profilePromise.then(async function (r) {
        if (pageIsUnloading || !r || r.error) return;       // network hiccup: keep going
        var p = r.data;
        if (!p || p.status !== "Active") {
          await supabaseClient.auth.signOut();
          sessionStorage.removeItem(SESSION_KEY);
          window.location.href = "index.html";
        } else if (p.role !== cached.role || p.full_name !== profile.full_name) {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: supaSession.user.id, firstName: nameOf(p).first || p.full_name, fullName: p.full_name, email: p.email, role: p.role }));
          window.location.reload();
        }
      }).catch(function () {});
    } else {
      profile = (await profilePromise).data;
      if (!profile || profile.status !== "Active") {
        await supabaseClient.auth.signOut();
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = "index.html";
        return false;
      }
    }

    var firstName = nameOf(profile).first || profile.full_name;
    var session = { id: supaSession.user.id, firstName: firstName, fullName: profile.full_name, email: profile.email, role: profile.role };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // Enforce which roles may open this page — with one narrow exception:
    // if the whole system currently has ZERO Super Admins (e.g. the sole
    // Super Admin's row was removed outside the app), an Admin is allowed
    // onto the account-management pages just long enough to promote
    // someone back into that role. The moment a Super Admin exists again,
    // this exception stops applying.
    var page = currentPageFile();
    var allowedRoles = ROUTE_ROLES[page];
    var recoveryPages = ["admin.html", "edit-account.html", "invite-account.html"];
    var isAllowed = !allowedRoles || allowedRoles.indexOf(session.role) !== -1;

    if (!isAllowed && session.role === "Admin" && recoveryPages.indexOf(page) !== -1) {
      var superAdminCheck = await supabaseClient.from("profiles").select("id").eq("role", "Super Admin").limit(1);
      if (!superAdminCheck.data || !superAdminCheck.data.length) {
        isAllowed = true; // recovery mode: no Super Admin exists anywhere right now
      }
    }

    if (!isAllowed) {
      setFlash("You don't have access to that page.");
      window.location.href = "dashboard.html";
      return false;
    }

    filterNavForRole(session.role);
    initNavClickGuard();

    var headerEl = document.querySelector(".app-header");
    var navEl = headerEl && headerEl.querySelector("nav");
    if (headerEl && navEl && !document.getElementById("nav-toggle")) {
      var toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.id = "nav-toggle";
      toggleBtn.className = "nav-toggle";
      toggleBtn.setAttribute("aria-label", "Open menu");
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      avatarBtn.insertAdjacentElement("afterend", toggleBtn);
      toggleBtn.addEventListener("click", function () {
        var open = headerEl.classList.toggle("nav-open");
        toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
        toggleBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      });
    }

    var menu = document.createElement("div");
    menu.className = "avatar-menu";
    menu.id = "avatar-menu";
    menu.innerHTML =
      '<p class="avatar-menu-name">' + escAttr(session.fullName || session.firstName) + '</p>' +
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
    initAiChatWidget();
    return true;
  }

  /* =======================================================================
     AI Assistant — floating chat widget (site-wide)
     Rule-based insights generated live from your real Supabase data —
     no external AI API is called, so this works fully offline of any key.
     ======================================================================= */

  var RESTRICTED_REPLY = "Sorry, you don't have permission to access pricing or profitability information.";

  // Fetches role-shaped data from the backend. This is the ONLY place the
  // chat gets its numbers from — the Postgres function get_ai_chat_context()
  // checks the caller's real role server-side and simply never includes
  // cost/price/revenue/profit fields for Staff, no matter what's asked.
  async function fetchAiChatContext() {
    var result = await supabaseClient.rpc("get_ai_chat_context");
    return result.data || { role: getCurrentRole(), is_privileged: false, recipes: [], ingredients: [], sales: [], low_stock: [], target_food_cost_pct: 30 };
  }

  // Turns the raw context into ranked, ready-to-quote facts. Every number
  // in the eventual chat reply traces back to something in this object.
  function analyzeContext(ctx) {
    var isPrivileged = !!ctx.is_privileged;

    var qtyByRecipe = {};
    var revenueByRecipe = {};
    ctx.sales.forEach(function (s) {
      qtyByRecipe[s.recipe_name] = (qtyByRecipe[s.recipe_name] || 0) + s.quantity;
      if (isPrivileged) revenueByRecipe[s.recipe_name] = (revenueByRecipe[s.recipe_name] || 0) + s.total_amount;
    });
    var soldNames = Object.keys(qtyByRecipe);

    var unsold = ctx.recipes.filter(function (r) { return soldNames.indexOf(r.name) === -1; });

    var topSellerByQty = null;
    if (soldNames.length) {
      soldNames.sort(function (a, b) { return qtyByRecipe[b] - qtyByRecipe[a]; });
      topSellerByQty = { name: soldNames[0], qty: qtyByRecipe[soldNames[0]] };
    }

    var margins = [];
    if (isPrivileged) {
      ctx.recipes.forEach(function (r) {
        if (r.selling_price > 0) {
          margins.push({
            name: r.name,
            margin: ((r.selling_price - r.cost_per_piece) / r.selling_price) * 100,
            cost: r.cost_per_piece,
            price: r.selling_price
          });
        }
      });
      margins.sort(function (a, b) { return b.margin - a.margin; });
    }

    var highCostIngredients = [];
    if (isPrivileged) {
      highCostIngredients = ctx.ingredients
        .filter(function (i) { return i.baseline_cost_per_unit > 0; })
        .map(function (i) { return { name: i.name, delta: ((i.cost_per_unit - i.baseline_cost_per_unit) / i.baseline_cost_per_unit) * 100, cost: i.cost_per_unit }; })
        .filter(function (i) { return i.delta > 5; })
        .sort(function (a, b) { return b.delta - a.delta; });
    }

    return {
      role: ctx.role, isPrivileged: isPrivileged, margins: margins, unsold: unsold,
      topSellerByQty: topSellerByQty, revenueByRecipe: revenueByRecipe, qtyByRecipe: qtyByRecipe,
      highCostIngredients: highCostIngredients, lowStock: ctx.low_stock || [], targetPct: ctx.target_food_cost_pct || 30,
      hasAnyRecipes: ctx.recipes.length > 0, hasAnySales: ctx.sales.length > 0
    };
  }

  // ---- Recommendation Engine: each fn below explains WHY, grounded in a.* figures ----

  function recIncreaseProfit(a) {
    if (!a.margins.length) return "I don't have enough recipe pricing data yet to ground a recommendation \u2014 add selling prices to your recipes first.";
    var parts = [];
    var best = a.margins[0];
    parts.push("focus more on " + best.name + ", which has your best margin right now at " + r2(best.margin) + "%");
    var weak = a.margins.filter(function (m) { return m.margin < 40; });
    if (weak.length) parts.push("review pricing on " + weak.slice(0, 2).map(function (m) { return m.name + " (" + r2(m.margin) + "% margin)"; }).join(" and "));
    if (a.highCostIngredients.length) parts.push("keep an eye on " + a.highCostIngredients[0].name + ", which has risen " + r2(a.highCostIngredients[0].delta) + "% in cost since it was first logged");
    return "Based on the current product and profitability data, I'd " + parts.join("; also ") + ". That combination \u2014 leaning on your strongest margins while fixing your weakest \u2014 is usually the fastest way to move overall profit.";
  }

  function recBestMargin(a) {
    if (!a.margins.length) return "No recipes have both a cost and a selling price set yet, so I can't calculate margins.";
    var best = a.margins[0];
    return best.name + " has your best profit margin right now, at " + r2(best.margin) + "% (\u20B1" + (best.price - best.cost).toFixed(2) + " profit per piece, selling at \u20B1" + best.price.toFixed(2) + "). Worth prioritizing in promotions or batch size.";
  }

  function recWorstMargin(a) {
    if (!a.margins.length) return "No recipes have both a cost and a selling price set yet, so I can't calculate margins.";
    var worst = a.margins[a.margins.length - 1];
    return worst.name + " has your thinnest margin at " + r2(worst.margin) + "% \u2014 costing \u20B1" + worst.cost.toFixed(2) + " against a \u20B1" + worst.price.toFixed(2) + " selling price. Consider raising its price or trimming its ingredient cost.";
  }

  function recReduceCosts(a) {
    if (!a.highCostIngredients.length) return "None of your ingredients have moved more than 5% above their originally logged cost \u2014 nothing stands out as a cost driver right now.";
    var top = a.highCostIngredients.slice(0, 3);
    return "Since being added, " + top.map(function (i) { return i.name + " (+" + r2(i.delta) + "%)"; }).join(", ") + " " + (top.length > 1 ? "have" : "has") + " gone up the most in cost. Those are the ingredients most worth negotiating with suppliers on, or swapping recipes to use less of.";
  }

  function recImprovePricing(a) {
    if (!a.margins.length) return "I don't have pricing data to compare against your " + a.targetPct + "% target food cost yet.";
    var offTarget = a.margins.filter(function (m) {
      var costPct = m.price > 0 ? (m.cost / m.price) * 100 : 0;
      return Math.abs(costPct - a.targetPct) > 10;
    });
    if (!offTarget.length) return "Your pricing is holding close to your " + a.targetPct + "% target food cost across the board \u2014 nothing urgent to change.";
    return offTarget.slice(0, 3).map(function (m) {
      var costPct = (m.cost / m.price) * 100;
      return m.name + " is running " + r2(costPct) + "% food cost against your " + a.targetPct + "% target";
    }).join("; ") + ". Adjusting those prices (or the recipes behind them) would bring them back in line.";
  }

  function recNotPerforming(a) {
    var msgs = [];
    if (a.unsold.length) msgs.push(a.unsold.slice(0, 3).map(function (r) { return r.name; }).join(", ") + " " + (a.unsold.length === 1 ? "hasn't" : "haven't") + " sold at all yet");
    if (a.isPrivileged && a.margins.length) {
      var low = a.margins.filter(function (m) { return m.margin < 30; });
      if (low.length) msgs.push(low.slice(0, 2).map(function (m) { return m.name; }).join(", ") + " " + (low.length === 1 ? "is" : "are") + " selling but at a thin margin (under 30%)");
    }
    if (!msgs.length) return "Nothing stands out as underperforming right now \u2014 every recipe has sold, and margins look reasonable.";
    return msgs.join(", and ") + ". " + (a.isPrivileged ? "Worth a promo push, a smaller test batch, or a price/recipe review." : "");
  }

  function recRemoveProducts(a) {
    if (!a.isPrivileged) return null; // handled by restriction check before this is called
    var candidates = a.margins.filter(function (m) {
      var unsoldMatch = a.unsold.some(function (u) { return u.name === m.name; });
      return m.margin < 25 || unsoldMatch;
    });
    if (!candidates.length) return "Nothing looks like a clear candidate to drop \u2014 everything is either selling or holding a reasonable margin.";
    return candidates.slice(0, 3).map(function (m) { return m.name; }).join(", ") + " " + (candidates.length === 1 ? "stands out" : "stand out") + " as worth reconsidering \u2014 low margin and/or no sales yet. Before cutting them, try a price adjustment or a smaller batch size first.";
  }

  function recPrioritize(a) {
    var parts = [];
    if (a.topSellerByQty) parts.push(a.topSellerByQty.name + " is your top seller by volume (" + a.topSellerByQty.qty + " pcs)");
    if (a.isPrivileged && a.margins.length) parts.push(a.margins[0].name + " has your best margin (" + r2(a.margins[0].margin) + "%)");
    if (!parts.length) return "Not enough sales data yet to prioritize by \u2014 record a few sales first.";
    return "I'd prioritize based on: " + parts.join(", and ") + ". " + (a.topSellerByQty && a.isPrivileged && a.margins.length && a.topSellerByQty.name !== a.margins[0].name ? "If those are two different items, that's worth noting \u2014 your most popular item isn't your most profitable one." : "");
  }

  var INTENTS = [
    // ---- Safe for every role (no cost/price/revenue/profit involved) ----
    { pattern: /low.?stock|restock|running out/i, restricted: false, handler: function (a) {
      return a.lowStock.length
        ? "These are running low: " + a.lowStock.map(function (i) { return i.name + " (" + i.stock_qty + " " + i.unit + " left)"; }).join(", ") + "."
        : "Nothing's below its low-stock threshold right now \u2014 you're good.";
    }},
    { pattern: /best.?sell|top.?sell|most popular|most sold/i, restricted: false, handler: function (a) {
      if (!a.topSellerByQty) return "No sales recorded yet, so nothing to rank.";
      var extra = a.isPrivileged && a.revenueByRecipe[a.topSellerByQty.name] ? " (\u20B1" + r2(a.revenueByRecipe[a.topSellerByQty.name]) + " in revenue)" : "";
      return a.topSellerByQty.name + " is your best seller so far, with " + a.topSellerByQty.qty + " pcs sold" + extra + ".";
    }},
    { pattern: /unsold|no sales|haven'?t sold/i, restricted: false, handler: function (a) {
      return a.unsold.length
        ? a.unsold.map(function (r) { return r.name; }).join(", ") + " " + (a.unsold.length === 1 ? "hasn't" : "haven't") + " sold at all yet."
        : "Every recipe has sold at least once \u2014 nice.";
    }},
    { pattern: /^(hi|hello|hey)\b/i, restricted: false, handler: function (a) {
      return a.isPrivileged
        ? "Hey! I can help with stock, sales, pricing, margins, or recommendations \u2014 what do you want to check?"
        : "Hey! I can help with stock levels and best sellers \u2014 what do you want to check?";
    }},
    { pattern: /help|what can you|what do you do/i, restricted: false, handler: function (a) {
      return a.isPrivileged
        ? "Ask me things like \"how's my pricing?\", \"what's our best margin?\", \"which ingredients cost the most?\", or \"what do you suggest to increase profit?\" \u2014 I pull straight from your live recipes, ingredients, and sales."
        : "Ask me about stock levels, low-stock alerts, or best sellers. Pricing and profit details are limited to Admin and Super Admin accounts.";
    }},

    // ---- Restricted: profit, margin, pricing, cost, revenue, recommendations ----
    { pattern: /increase.*profit|higher profit|profit higher|improve.*profit|profitability|recommend.*(improv|business)/i, restricted: true, handler: recIncreaseProfit },
    { pattern: /best.*margin|highest.*margin/i, restricted: true, handler: recBestMargin },
    { pattern: /worst.*margin|lowest.*margin|low.*margin/i, restricted: true, handler: recWorstMargin },
    { pattern: /reduce.*cost|lower.*cost|cutting.*cost|costing.*(most|much)|expensive ingredient/i, restricted: true, handler: recReduceCosts },
    { pattern: /improve.*pricing|pricing.*improve|how.*price/i, restricted: true, handler: recImprovePricing },
    { pattern: /not performing|underperform|performing well/i, restricted: true, handler: recNotPerforming },
    { pattern: /remov\w*|discontinue|drop.*product|chang(e|ing).*product/i, restricted: true, handler: recRemoveProducts },
    { pattern: /prioritize|focus on selling|promote more|should we (focus|sell)/i, restricted: true, handler: recPrioritize },
    { pattern: /margin/i, restricted: true, handler: recBestMargin },
    { pattern: /profit|price|pricing|cost|revenue|expensive/i, restricted: true, handler: function (a) { return recImprovePricing(a); } }
  ];

  function classifyAndAnswer(userText, a) {
    var q = userText.trim();
    for (var i = 0; i < INTENTS.length; i++) {
      var intent = INTENTS[i];
      if (intent.pattern.test(q)) {
        if (intent.restricted && !a.isPrivileged) return RESTRICTED_REPLY;
        var result = intent.handler(a);
        if (result) return result;
      }
    }
    // Fallback: general/off-topic question this rule-based assistant can't ground in data.
    return a.isPrivileged
      ? "I'm focused on your bakery's own data \u2014 recipes, pricing, sales, and stock. Try asking about margins, best sellers, low stock, or how to improve profit."
      : "I'm focused on your bakery's own data \u2014 stock levels and best sellers. Try asking about those.";
  }

  function initAiChatWidget() {
    if (document.getElementById("ai-chat-fab")) return; // already initialized (shouldn't happen, but just in case)

    var fab = document.createElement("button");
    fab.type = "button";
    fab.id = "ai-chat-fab";
    fab.className = "ai-chat-fab";
    fab.setAttribute("aria-label", "Open bakery assistant chat");
    fab.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 6.5V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="3" r="1.3" fill="currentColor"/><rect x="4" y="6.5" width="16" height="12.5" rx="3.5" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="12" r="1.7" fill="currentColor"/><circle cx="15" cy="12" r="1.7" fill="currentColor"/><path d="M9.5 15.9h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M2 11v4M22 11v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="ai-chat-badge"></span>';
    document.body.appendChild(fab);

    var panel = document.createElement("div");
    panel.id = "ai-chat-panel";
    panel.className = "ai-chat-panel";
    panel.innerHTML =
      '<div class="ai-chat-header">' +
        '<div class="ai-chat-avatar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 6.5V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="3" r="1.3" fill="currentColor"/><rect x="4" y="6.5" width="16" height="12.5" rx="3.5" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="12" r="1.7" fill="currentColor"/><circle cx="15" cy="12" r="1.7" fill="currentColor"/><path d="M9.5 15.9h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M2 11v4M22 11v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>' +
        '<div class="ai-chat-header-text">' +
          '<p class="ai-chat-title">Bakery Assistant</p>' +
          '<p class="ai-chat-subtitle"><span class="dot"></span>Reads your live data</p>' +
        '</div>' +
        '<button type="button" class="ai-chat-close" id="ai-chat-close" aria-label="Close chat">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="ai-chat-messages" id="ai-chat-messages"></div>' +
      '<div class="ai-chat-quick-replies" id="ai-chat-quick-replies"></div>' +
      '<div class="ai-chat-input-row">' +
        '<input type="text" id="ai-chat-input" placeholder="Ask about stock, sales, pricing\u2026" autocomplete="off">' +
        '<button type="button" id="ai-chat-send" aria-label="Send">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 11l18-8-8 18-2.5-7.5L3 11Z" fill="currentColor"/></svg>' +
        '</button>' +
      '</div>';
    document.body.appendChild(panel);

    var messagesEl = document.getElementById("ai-chat-messages");
    var quickRepliesEl = document.getElementById("ai-chat-quick-replies");
    var inputEl = document.getElementById("ai-chat-input");
    var hasGreeted = false;
    var lastContext = null;

    function addMessage(text, who) {
      var msg = document.createElement("div");
      msg.className = "ai-chat-msg " + who;
      msg.textContent = text;
      messagesEl.appendChild(msg);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function showTyping() {
      var typing = document.createElement("div");
      typing.className = "ai-chat-typing";
      typing.id = "ai-chat-typing-indicator";
      typing.innerHTML = "<span></span><span></span><span></span>";
      messagesEl.appendChild(typing);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function hideTyping() {
      var typing = document.getElementById("ai-chat-typing-indicator");
      if (typing) typing.remove();
    }

    function setQuickReplies(labels) {
      quickRepliesEl.innerHTML = "";
      labels.forEach(function (label) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.addEventListener("click", function () { handleUserMessage(label); });
        quickRepliesEl.appendChild(btn);
      });
    }

    async function getAnalysis() {
      if (lastContext) return lastContext;
      var ctx = await fetchAiChatContext();
      lastContext = analyzeContext(ctx);
      return lastContext;
    }

    async function botReply(userText) {
      showTyping();
      var a = await getAnalysis();
      var reply = classifyAndAnswer(userText, a);

      setTimeout(function () {
        hideTyping();
        addMessage(reply, "bot");
      }, 450);
    }

    function handleUserMessage(text) {
      text = (text || "").trim();
      if (!text) return;
      addMessage(text, "user");
      inputEl.value = "";
      botReply(text);
    }

    document.getElementById("ai-chat-send").addEventListener("click", function () { handleUserMessage(inputEl.value); });
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") handleUserMessage(inputEl.value);
    });

    async function openPanel() {
      panel.classList.add("is-open");
      inputEl.focus();
      if (!hasGreeted) {
        hasGreeted = true;
        showTyping();
        var a = await getAnalysis();
        setTimeout(function () {
          hideTyping();
          var name = currentUserName();
          var openingLine = a.isPrivileged
            ? recIncreaseProfit(a)
            : (a.lowStock.length
                ? "These are running low: " + a.lowStock.map(function (i) { return i.name; }).join(", ") + "."
                : (a.topSellerByQty ? a.topSellerByQty.name + " is your best seller so far, with " + a.topSellerByQty.qty + " pcs sold." : "Nothing urgent to flag right now."));

          addMessage("Hi " + name + "! " + (a.isPrivileged ? "Here's a quick read on things:" : "Here's what I can tell you right now:"), "bot");
          addMessage(openingLine, "bot");

          if (a.isPrivileged) {
            setQuickReplies(["Best margin?", "What's costing us the most?", "Any unsold items?", "How's my pricing?"]);
          } else {
            setQuickReplies(["Low stock?", "Best seller?", "Any unsold items?"]);
          }
        }, 500);
      }
    }

    fab.addEventListener("click", function () {
      var isOpen = panel.classList.contains("is-open");
      if (isOpen) { panel.classList.remove("is-open"); }
      else { openPanel(); }
    });
    document.getElementById("ai-chat-close").addEventListener("click", function () {
      panel.classList.remove("is-open");
    });
  }

  /* =======================================================================
     Dashboard page
     ======================================================================= */

  function computeAverageFoodCostPct(recipes) {
    if (!recipes.length) return 0;
    var total = 0, count = 0;
    recipes.forEach(function (r) {
      if (r.selling_price > 0) {
        total += (r.cost_per_piece / r.selling_price) * 100;
        count++;
      }
    });
    return count ? total / count : 0;
  }

  function computeIngredientAlerts(ingredients) {
    return ingredients.filter(function (i) {
      return i.baseline_cost_per_unit > 0 &&
        Math.abs(i.cost_per_unit - i.baseline_cost_per_unit) / i.baseline_cost_per_unit >= 0.05;
    }).length;
  }

  function computeLowStockCount(ingredients) {
    return ingredients.filter(function (i) {
      return i.low_stock_threshold != null && i.stock_qty <= i.low_stock_threshold;
    }).length;
  }

  async function renderAdminDashboard() {
    var recipes = await fetchRecipes();
    var ingredients = await fetchIngredients();
    var todaySales = await fetchSales("today");

    document.getElementById("stat-recipes").textContent = recipes.length;
    document.getElementById("stat-foodcost").textContent = pct2(computeAverageFoodCostPct(recipes));
    var todayProfit = todaySales.reduce(function (sum, s) { return sum + s.gross_profit; }, 0);
    document.getElementById("stat-profit").textContent = peso(todayProfit);
    document.getElementById("stat-alerts").textContent = computeIngredientAlerts(ingredients);

    await renderMonthlySalesChart();
    await renderTopBreadDonut();
  }

  /* ---- Money axes for charts: ₱1K, ₱2K, ₱5K, ₱10K ... ----
     Picks a "nice" step (1, 2 or 5 x 10^n, never below 1K) so the top of the axis
     is at least floorMax and grows automatically when sales are bigger. */
  function axisScale(top, floorMax, ticks, startPow) {
    var need = Math.max(top || 0, floorMax || 0, 1);
    var mult = [1, 2, 5];
    for (var p = (startPow == null ? 3 : startPow); p < 12; p++) {
      for (var k = 0; k < mult.length; k++) {
        var step = mult[k] * Math.pow(10, p);
        if (step * ticks >= need) return { step: step, max: step * ticks };
      }
    }
    var big = Math.pow(10, 12);
    return { step: big, max: big * ticks };
  }
  function fmtAxisPeso(n) {
    if (!n) return "\u20B10";
    if (n >= 1000000) return "\u20B1" + +(n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return "\u20B1" + +(n / 1000).toFixed(1) + "K";
    return "\u20B1" + n;
  }

  async function renderMonthlySalesChart() {
    var body = document.getElementById("bar-chart-body");
    if (!body) return;

    var now = new Date();
    var currentYear = now.getFullYear();
    var startOfLastYear = new Date(currentYear - 1, 0, 1).toISOString();
    var result = await supabaseClient.from("sales").select("total_amount, sale_datetime").gte("sale_datetime", startOfLastYear);
    var rows = result.data || [];

    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var current = new Array(12).fill(0);
    var past = new Array(12).fill(0);

    rows.forEach(function (r) {
      var d = new Date(r.sale_datetime);
      var m = d.getMonth();
      if (d.getFullYear() === currentYear) current[m] += r.total_amount;
      else if (d.getFullYear() === currentYear - 1) past[m] += r.total_amount;
    });

    // Axis starts at a readable scale (₱0 - ₱10K in ₱2K steps) and grows with sales.
    var dashScale = axisScale(Math.max.apply(null, current.concat(past)), 10000, 5);
    var maxVal = dashScale.max;
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
      for (var v = 0; v <= maxVal; v += dashScale.step) {
        var s = document.createElement("span");
        s.textContent = fmtAxisPeso(v);
        axis.appendChild(s);
      }
    }

    var noSalesYet = !rows.length;
    if (noSalesYet) {
      body.innerHTML = '<p class="empty-note">No sales recorded yet \u2014 this chart will fill in as sales come through Record Sale.</p>';
      document.getElementById("bar-axis-labels").innerHTML = "";
      return;
    }

    document.getElementById("toggle-current").onclick = function () {
      showCurrent = !showCurrent;
      this.classList.toggle("dim", !showCurrent);
      render();
    };
    document.getElementById("toggle-past").onclick = function () {
      showPast = !showPast;
      this.classList.toggle("dim", !showPast);
      render();
    };

    render();
  }

  async function renderTopBreadDonut() {
    var svg = document.getElementById("donut-svg");
    if (!svg) return;

    var result = await supabaseClient.from("sales").select("total_amount, recipes(id, name)");
    var rows = result.data || [];

    var totals = {};
    rows.forEach(function (r) {
      var name = r.recipes ? r.recipes.name : "Unknown";
      totals[name] = (totals[name] || 0) + r.total_amount;
    });

    var palette = ["#3E2723", "#A5511F", "#C1662F", "#8B7355", "#E8DCC8"];
    var breadData = Object.keys(totals)
      .map(function (name) { return { name: name, value: totals[name] }; })
      .sort(function (a, b) { return b.value - a.value; })
      .slice(0, 5)
      .map(function (d, i) { return { name: d.name, value: d.value, color: palette[i] || "#C1662F" }; });

    var legend = document.getElementById("donut-legend");
    svg.innerHTML = "";
    legend.innerHTML = "";

    if (!breadData.length) {
      legend.innerHTML = '<p class="empty-note">No sales recorded yet.</p>';
      return;
    }

    var svgNS = "http://www.w3.org/2000/svg";
    var cx = 75, cy = 75, rOuter = 68, rInner = 42;
    var total = breadData.reduce(function (s, d) { return s + d.value; }, 0);
    var startAngle = -90;

    function polarToXY(r, angleDeg) {
      var rad = (angleDeg - 90) * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    breadData.forEach(function (d) {
      var sweep = total > 0 ? (d.value / total) * 360 : 0;
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

    breadData.forEach(function (d) {
      var pctOfTotal = total > 0 ? (d.value / total) * 100 : 0;
      var li = document.createElement("li");
      li.innerHTML = '<span class="dot" style="background:' + d.color + '"></span>' +
        '<span class="name">' + d.name + '</span>' +
        '<span class="amt">' + peso(d.value) + '</span>' +
        '<span class="pill">' + pct2(pctOfTotal) + '</span>';
      legend.appendChild(li);
    });
  }

  async function renderStaffDashboard() {
    var wrap = document.getElementById("staff-dashboard");
    var adminWrap = document.getElementById("admin-dashboard-sections");
    if (adminWrap) adminWrap.style.display = "none";
    if (!wrap) return;
    wrap.style.display = "";

    var myId = currentUserId();
    var todaySales = await fetchSales("today"); // RLS already scopes Staff to their own rows
    var mySales = todaySales.filter(function (s) { return s.logged_by === myId; });

    var totalRevenue = mySales.reduce(function (sum, s) { return sum + s.total_amount; }, 0);
    var itemsSold = mySales.reduce(function (sum, s) { return sum + s.quantity; }, 0);

    var ingredients = await fetchIngredients().catch(function () { return []; });
    var lowStockCount = computeLowStockCount(ingredients);

    document.getElementById("staff-stat-sales").textContent = peso(totalRevenue);
    document.getElementById("staff-stat-items").textContent = itemsSold;
    document.getElementById("staff-stat-lowstock").textContent = lowStockCount;

    var listEl = document.getElementById("staff-recent-sales");
    listEl.innerHTML = "";
    if (!mySales.length) {
      listEl.innerHTML = '<li class="empty-note">No sales logged yet today.</li>';
      return;
    }
    mySales.forEach(function (s) {
      var li = document.createElement("li");
      var time = new Date(s.sale_datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      li.innerHTML = "<span>" + time + " \u2014 " + (s.recipes ? s.recipes.name : "Item") + " x" + s.quantity + "</span><span>" + peso(s.total_amount) + "</span>";
      listEl.appendChild(li);
    });
  }

  async function initDashboardPage() {
    if (!document.getElementById("stat-recipes")) return;

    var role = getCurrentRole();

    if (role === "Staff") {
      await renderStaffDashboard();
      return;
    }

    if (role !== "Super Admin") {
      var manageAccountsTile = document.querySelector('.action-btn[href="admin.html"]');
      if (manageAccountsTile) manageAccountsTile.style.display = "none";
    }

    await renderAdminDashboard();
  }

  /* =======================================================================
     Recipes & Costing — list page (recipes.html)
     ======================================================================= */

  async function initRecipesListPage() {
    var tbody = document.getElementById("recipes-list-body");
    if (!tbody) return;

    var searchInput = document.getElementById("recipe-search");
    var activeCategory = "All";
    var allRecipes = await fetchRecipes();

    if (getCurrentRole() === "Staff") {
      var addRecipeBtn = document.querySelector('.recipes-toolbar a[href="recipe-form.html"]');
      if (addRecipeBtn) addRecipeBtn.style.display = "none";
    }

    function render() {
      var query = (searchInput.value || "").trim().toLowerCase();
      var rows = allRecipes.filter(function (r) {
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
        var margin = r.selling_price > 0 ? ((r.selling_price - r.cost_per_piece) / r.selling_price) * 100 : 0;
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + r.name + "</td>" +
          "<td>" + (r.category || "") + "</td>" +
          "<td>" + r.base_batch_size + " pcs</td>" +
          "<td>" + peso(r.cost_per_piece) + "</td>" +
          "<td>" + peso(r.selling_price) + "</td>" +
          "<td>" + pct2(margin) + "</td>" +
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

  async function initRecipeFormPage() {
    var body = document.getElementById("recipe-ingredients-body");
    if (!body) return;

    var allIngredients = await fetchIngredients();
    var lineItems = [];
    var scaleFactor = 1;
    var editingId = new URLSearchParams(window.location.search).get("id");
    var editingRecipe = null;

    if (editingId) {
      ["recipe-back-btn", "recipe-cancel-btn"].forEach(function (btnId) {
        var el = document.getElementById(btnId);
        if (el) el.setAttribute("href", "recipe-view.html?id=" + encodeURIComponent(editingId));
      });
    }

    var ingredientSelect = document.getElementById("select-ingredient");
    var qtyInput = document.getElementById("input-ing-qty");
    var baseBatchInput = document.getElementById("input-base-batch");
    var portionsInput = document.getElementById("input-portions-per-piece");
    var categoryInput = document.getElementById("input-category");
    var notesInput = document.getElementById("input-notes");
    var targetFoodCostInput = document.getElementById("input-target-foodcost");
    var sellingPriceInput = document.getElementById("input-selling-price");

    function populateIngredientSelect() {
      ingredientSelect.innerHTML = "";
      if (!allIngredients.length) {
        ingredientSelect.innerHTML = '<option value="">No ingredients in inventory yet</option>';
        return;
      }
      allIngredients.forEach(function (ing) {
        var opt = document.createElement("option");
        opt.value = ing.id;
        opt.textContent = ing.name + " \u2014 " + fmtCostPer(ing.cost_per_unit, ing.unit).replace(" / ", "/") + " \u00B7 " + fmtQty(ing.stock_qty) + " " + ing.unit + " in stock";
        ingredientSelect.appendChild(opt);
      });
    }

    // Quantity can be typed in g or kg (ml or L), whatever is handy; it is converted to the inventory unit.
    var ingUnitSelect = document.getElementById("input-ing-unit");
    var pickHint = document.getElementById("ing-pick-hint");
    function refreshPicker() {
      var ing = allIngredients.find(function (i) { return i.id === ingredientSelect.value; });
      if (!ing) { ingUnitSelect.innerHTML = ""; pickHint.textContent = ""; return; }
      var choices = (ing.unit === "g" || ing.unit === "kg") ? ["g", "kg"] : (ing.unit === "ml" || ing.unit === "L") ? ["ml", "L"] : [ing.unit];
      ingUnitSelect.innerHTML = choices.map(function (u) { return '<option value="' + u + '"' + (u === ing.unit ? " selected" : "") + ">" + u + "</option>"; }).join("");
      pickHint.textContent = "In stock: " + fmtQty(ing.stock_qty) + " " + ing.unit + "  \u00B7  " + fmtCostPer(ing.cost_per_unit, ing.unit);
    }
    ingredientSelect.addEventListener("change", refreshPicker);

    function renderIngredientRows() {
      var tbody = document.getElementById("recipe-ingredients-body");
      tbody.innerHTML = "";
      if (!lineItems.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-note">No ingredients added yet \u2014 pick one below and set a quantity.</td></tr>';
      } else {
        lineItems.forEach(function (item, idx) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + item.name + "</td>" +
            "<td>" + item.category + "</td>" +
            "<td>" + fmtQty(item.qty) + " " + item.unit + "</td>" +
            "<td>" + fmtCostPer(item.lineCost / item.qty, item.unit) + "</td>" +
            "<td>" + peso(item.lineCost) + "</td>" +
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
      var ing = allIngredients.find(function (i) { return i.id === ingredientSelect.value; });
      var qty = parseFloat(qtyInput.value);
      if (!ing || !qty || qty <= 0) { toast("Pick an ingredient and enter a quantity."); return; }
      var qtyFactor = unitFactor(ingUnitSelect.value || ing.unit, ing.unit);
      if (qtyFactor === null) { toast("That unit doesn't match " + ing.name + " (" + ing.unit + ")."); return; }
      var qtyBase = round4(qty * qtyFactor); // quantity in the inventory unit
      var sameLine = lineItems.find(function (l) { return l.ingredientId === ing.id; });
      if (sameLine) {
        // Same ingredient twice in one recipe = one line with the combined quantity.
        sameLine.qty = round4(sameLine.qty + qtyBase);
        sameLine.lineCost = ing.cost_per_unit * sameLine.qty;
      } else {
        lineItems.push({
          ingredientId: ing.id, name: ing.name, category: ing.category || "",
          unit: ing.unit, qty: qtyBase, lineCost: ing.cost_per_unit * qtyBase
        });
      }
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

      document.getElementById("total-batch-cost").textContent = peso(totalCost);
      document.getElementById("cost-per-piece").textContent = peso(costPerPiece);
      document.getElementById("pricing-total-batch-cost").textContent = peso(totalCost);
      document.getElementById("pricing-cost-per-piece").textContent = peso(costPerPiece);

      var targetPct = parseFloat(targetFoodCostInput.value);
      var suggested = (targetPct && targetPct > 0) ? costPerPiece / (targetPct / 100) : 0;
      document.getElementById("suggested-selling-price").textContent = peso(suggested);

      renderLossCheck(costPerPiece, targetPct || 0, suggested);
      return { totalCost: totalCost, baseTotalCost: totalBatchCostRaw(), costPerPiece: costPerPiece, suggested: suggested };
    }

    function renderLossCheck(costPerPiece, targetPct, suggested) {
      var tbody = document.getElementById("loss-check-body");
      var sellingPrice = parseFloat(sellingPriceInput.value) || suggested;
      var rows = [];
      if (costPerPiece > 0) {
        var lowPrice = costPerPiece * 1.1;
        rows.push({ price: lowPrice, cost: costPerPiece });
        if (sellingPrice > 0) rows.push({ price: sellingPrice, cost: costPerPiece });
      }
      tbody.innerHTML = "";
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-note">Add ingredients to see a loss check.</td></tr>';
        return;
      }
      rows.forEach(function (r) {
        var pct = r.price > 0 ? (r.cost / r.price) * 100 : 0;
        var isLoss = targetPct > 0 ? pct > targetPct : pct > 45;
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + peso(r.price) + "</td>" +
          "<td>" + pct2(pct) + "</td>" +
          '<td><span class="status-text ' + (isLoss ? "bad" : "good") + '">' + (isLoss ? "Loss Risk" : "Meets Target") + "</span></td>";
        tbody.appendChild(tr);
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

    document.getElementById("save-recipe-btn").addEventListener("click", async function () {
      var name = document.getElementById("input-recipe-name") ? document.getElementById("input-recipe-name").value.trim() : categoryInput.value.trim();
      var category = categoryInput.value;
      var baseBatch = parseFloat(baseBatchInput.value) || 0;
      if (!name) { toast("Enter a bread item name."); return; }
      if (!lineItems.length) { toast("Add at least one ingredient first."); return; }
      if (!baseBatch || Math.floor(baseBatch) !== baseBatch) { toast("Enter the base batch size (yield) as a whole number of pieces."); return; }

      var totals = recompute();
      var portions = parseFloat(portionsInput.value) || 1;
      var sellingPrice = parseFloat(sellingPriceInput.value) || totals.suggested;
      var targetPct = parseFloat(targetFoodCostInput.value) || null;

      var saveBtn = document.getElementById("save-recipe-btn");
      saveBtn.disabled = true;

      // Don't allow two recipes with the same name.
      var dupe = await supabaseClient.from("recipes").select("id").ilike("name", name.replace(/[%_]/g, "\\$&"));
      var sameName = (dupe.data || []).filter(function (r) { return String(r.id) !== String(editingId); });
      if (sameName.length) {
        saveBtn.disabled = false;
        toast('A recipe named "' + name + '" already exists. Open it to edit it, or use a different name.');
        return;
      }

      var result = await saveRecipe({
        name: name, category: category, baseBatchSize: baseBatch, portionsPerPiece: portions,
        notes: notesInput.value.trim(), totalBatchCost: totals.baseTotalCost, costPerPiece: totals.costPerPiece,
        targetFoodCostPct: targetPct, suggestedSellingPrice: totals.suggested || null, sellingPrice: sellingPrice
      }, lineItems, editingId);

      if (result.error) {
        saveBtn.disabled = false;
        toast("Couldn't save recipe: " + result.error.message);
        return;
      }
      // Success: leave the button disabled until the page moves on, so it can't be saved twice.

      await logActivitySupa((editingId ? "Updated recipe - " : "Saved recipe - ") + name);

      // Active warning if the recipe's own current selling price is a loss risk.
      if (totals.costPerPiece > 0 && sellingPrice > 0) {
        var pct = (totals.costPerPiece / sellingPrice) * 100;
        var isLoss = targetPct ? pct > targetPct : pct > 45;
        if (isLoss) {
          toast("Saved \u2014 but heads up: at " + peso(sellingPrice) + ", food cost is " + pct2(pct) + ". That's a loss risk.");
          setTimeout(function () { window.location.href = "dashboard.html"; }, 2200);
          return;
        }
      }

      toast(editingId ? "Recipe updated!" : "Recipe saved!");
      setTimeout(function () { window.location.href = "dashboard.html"; }, 1000);
    });

    async function loadForEdit() {
      var loaded = await fetchRecipeWithIngredients(editingId);
      if (!loaded) { toast("Recipe not found."); return; }
      editingRecipe = loaded.recipe;
      lineItems = loaded.lineItems;

      if (document.getElementById("input-recipe-name")) document.getElementById("input-recipe-name").value = editingRecipe.name;
      categoryInput.value = editingRecipe.category || "";
      baseBatchInput.value = editingRecipe.base_batch_size;
      portionsInput.value = editingRecipe.portions_per_piece || 1;
      notesInput.value = editingRecipe.preparation_notes || "";
      targetFoodCostInput.value = editingRecipe.target_food_cost_pct || "";
      sellingPriceInput.value = editingRecipe.selling_price || "";

      var heading = document.getElementById("recipe-form-heading");
      if (heading) heading.textContent = "Edit Bread Recipe";
      var saveBtn = document.getElementById("save-recipe-btn");
      if (saveBtn) saveBtn.textContent = "Save changes";

      renderIngredientRows();
      recompute();
    }

    async function prefillDefaultTargetFoodCost() {
      if (editingId) return;
      var settingsResult = await supabaseClient.from("business_settings").select("target_food_cost_pct").eq("id", 1).maybeSingle();
      if (settingsResult.data && settingsResult.data.target_food_cost_pct) {
        targetFoodCostInput.value = settingsResult.data.target_food_cost_pct;
      }
    }

    populateIngredientSelect();
    refreshPicker();

    if (editingId) {
      await loadForEdit();
    } else {
      renderIngredientRows();
      await prefillDefaultTargetFoodCost();
      recompute();
    }
  }

  /* =======================================================================
     Recipes & Costing — view page (recipe-view.html)
     ======================================================================= */

  async function initRecipeViewPage() {
    var body = document.getElementById("view-ingredients-body");
    if (!body) return;

    var id = new URLSearchParams(window.location.search).get("id");
    var loaded = await fetchRecipeWithIngredients(id);
    if (!loaded) { toast("Recipe not found."); return; }
    var recipe = loaded.recipe;
    var lineItems = loaded.lineItems;

    if (document.getElementById("view-recipe-name")) document.getElementById("view-recipe-name").textContent = recipe.name;
    document.getElementById("view-batch-size").value = recipe.base_batch_size + " pcs";
    if (document.getElementById("view-base-batch")) document.getElementById("view-base-batch").value = recipe.base_batch_size + " pcs";
    document.getElementById("view-category").value = recipe.category || "";
    document.getElementById("view-portions").value = recipe.portions_per_piece || 1;
    if (document.getElementById("view-notes")) document.getElementById("view-notes").value = recipe.preparation_notes || "";

    body.innerHTML = "";
    lineItems.forEach(function (item) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + item.name + "</td><td>" + item.category + "</td>" +
        "<td>" + fmtQty(item.qty) + " " + item.unit + "</td>" +
        "<td>" + fmtCostPer(item.lineCost / item.qty, item.unit) + "</td>" +
        "<td>" + peso(item.lineCost) + "</td>";
      body.appendChild(tr);
    });

    // Totals come from the same live-priced lines shown above, so the page always adds up.
    var viewTotal = lineItems.reduce(function (sum, i) { return sum + i.lineCost; }, 0);
    document.getElementById("view-total-batch-cost").textContent = peso(viewTotal);
    document.getElementById("view-cost-per-piece").textContent = peso(recipe.base_batch_size > 0 ? viewTotal / recipe.base_batch_size : 0);

    // Real yield %: average(actual pieces baked) vs the recipe's planned batch size,
    // across every production batch logged for this recipe.
    var batchResult = await supabaseClient.from("bread_inventory").select("quantity_baked").eq("recipe_id", id);
    var batches = batchResult.data || [];
    var yieldEl = document.getElementById("view-yield-pct");
    if (!batches.length) {
      yieldEl.textContent = "\u2014";
      yieldEl.title = "No batches baked yet";
    } else {
      var avgBaked = batches.reduce(function (s, b) { return s + b.quantity_baked; }, 0) / batches.length;
      var yieldPct = recipe.base_batch_size > 0 ? (avgBaked / recipe.base_batch_size) * 100 : 0;
      yieldEl.textContent = pct2(yieldPct);
    }

    var role = getCurrentRole();
    var editBtn = document.getElementById("edit-recipe-btn");
    if (editBtn) {
      if (role === "Admin" || role === "Super Admin") {
        editBtn.addEventListener("click", function () {
          window.location.href = "recipe-form.html?id=" + id;
        });
      } else {
        editBtn.style.display = "none";
      }
    }
  }

  /* =======================================================================
     Inventory page (inventory.html)
     ======================================================================= */

  async function initInventoryPage() {
    var body = document.getElementById("ingredient-stock-body");
    if (!body) return;

    var role = getCurrentRole();
    var isStaff = role === "Staff";
    if (isStaff) {
      // Staff can see what's in stock, but not costs, and can't restock/edit/delete.
      var addIngBtn = document.getElementById("show-add-ingredient");
      if (addIngBtn) addIngBtn.style.display = "none";
      var headRow = body.closest("table").querySelector("thead tr");
      if (headRow) headRow.innerHTML = "<th>Ingredient</th><th>Category</th><th>Unit</th><th>Stock Qty</th><th>Low Stock At</th><th>Last Updated</th>";
    }

    var ingredients = await fetchIngredients();
    var recipes = await fetchRecipes();

    /* ---- Raw ingredients tab ---- */
    function renderIngredientTable() {
      body.innerHTML = "";
      if (!ingredients.length) {
        body.innerHTML = '<tr><td colspan="' + (isStaff ? 6 : 10) + '" class="empty-note">No raw ingredients yet.</td></tr>';
        return;
      }
      ingredients.forEach(function (ing) {
        var isLow = ing.low_stock_threshold != null && ing.stock_qty <= ing.low_stock_threshold;
        var showsConversion = ing.purchase_unit && ing.purchase_unit !== ing.unit && ing.units_per_purchase && ing.units_per_purchase !== 1;
        var nameCell = ing.name + (isLow ? ' <span class="status-pill" style="background:#9C3B1E;">Low stock</span>' : "");
        if (showsConversion) {
          nameCell += '<br><span class="field-hint" style="margin:2px 0 0;">1 ' + ing.purchase_unit + ' = ' + Number(ing.units_per_purchase).toLocaleString() + ' ' + ing.unit + '</span>';
        }
        var tr = document.createElement("tr");
        tr.setAttribute("data-id", ing.id);
        if (isStaff) {
          tr.innerHTML =
            "<td>" + nameCell + "</td>" +
            "<td>" + (ing.category || "") + "</td>" +
            "<td>" + ing.unit + "</td>" +
            "<td>" + fmtQty(ing.stock_qty) + " " + ing.unit + "</td>" +
            "<td>" + (ing.low_stock_threshold != null ? fmtQty(ing.low_stock_threshold) + " " + ing.unit : "\u2014") + "</td>" +
            "<td>" + new Date(ing.updated_at).toLocaleDateString() + "</td>";
          body.appendChild(tr);
          return;
        }
        tr.innerHTML =
          "<td>" + nameCell + "</td>" +
          "<td>" + (ing.category || "") + "</td>" +
          "<td>" + ing.unit + "</td>" +
          "<td>" + fmtCostPer(ing.cost_per_unit, ing.unit) + "</td>" +
          "<td>" + fmtQty(ing.stock_qty) + " " + ing.unit + "</td>" +
          "<td>" + (ing.low_stock_threshold != null ? fmtQty(ing.low_stock_threshold) + " " + ing.unit : "\u2014") + "</td>" +
          "<td>" + new Date(ing.updated_at).toLocaleDateString() + "</td>" +
          '<td><a href="#" class="row-action" data-restock="' + ing.id + '">Restock</a></td>' +
          '<td><a href="#" class="row-action" data-edit="' + ing.id + '">Edit</a></td>' +
          '<td><button type="button" class="btn-link-remove" data-delete="' + ing.id + '">Delete</button></td>';
        body.appendChild(tr);
      });
      body.querySelectorAll("[data-restock]").forEach(function (link) {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          toggleRestockRow(link.getAttribute("data-restock"));
        });
      });
      body.querySelectorAll("[data-edit]").forEach(function (link) {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          toggleEditRow(link.getAttribute("data-edit"));
        });
      });
      body.querySelectorAll("[data-delete]").forEach(function (btn) {
        btn.addEventListener("click", async function () {
          var ing = ingredients.find(function (i) { return i.id === btn.getAttribute("data-delete"); });
          if (!ing) return;
          if (!confirm('Delete "' + ing.name + '"? This can\'t be undone.')) return;

          btn.disabled = true;
          var deleteResult = await supabaseClient.from("ingredients").delete().eq("id", ing.id);
          if (deleteResult.error) {
            btn.disabled = false;
            if (deleteResult.error.code === "23503") {
              toast("Can't delete \u2014 " + ing.name + " is used in a recipe. Remove it from that recipe first.");
            } else {
              toast("Couldn't delete: " + deleteResult.error.message);
            }
            return;
          }

          ingredients = ingredients.filter(function (i) { return i.id !== ing.id; });
          await logActivitySupa("Deleted raw ingredient - " + ing.name);
          renderIngredientTable();
          toast(ing.name + " deleted.");
        });
      });
    }

    function toggleRestockRow(id) {
      var ing = ingredients.find(function (i) { return i.id === id; });
      if (!ing) return;
      var rows = body.querySelectorAll("tr");
      rows.forEach(function (tr) {
        if (tr.getAttribute("data-id") === String(ing.id)) {
          tr.innerHTML =
            '<td colspan="10">' +
              '<div class="form-row" style="align-items:flex-end;margin:0;">' +
                '<div class="field-group" style="margin-bottom:0;">' +
                  '<label>Quantity purchased (' + (ing.purchase_unit || ing.unit) + ')</label>' +
                  '<div class="field-control"><input type="number" id="restock-qty-' + ing.id + '" placeholder="e.g. 1" min="0" step="any"></div>' +
                '</div>' +
                '<div class="field-group" style="margin-bottom:0;">' +
                  '<label>Total price paid</label>' +
                  '<div class="field-control"><input type="number" id="restock-price-' + ing.id + '" placeholder="e.g. 1250" min="0" step="0.01"></div>' +
                '</div>' +
                '<div class="field-group" style="margin-bottom:0;">' +
                  '<label>Each ' + escAttr(ing.purchase_unit || "pack") + ' contains</label>' +
                  '<div style="display:flex;gap:8px;">' +
                    '<div class="field-control" style="flex:2;"><input type="number" id="restock-pack-size-' + ing.id + '" value="' + (ing.units_per_purchase || 1) + '" min="0.0001" step="any"></div>' +
                    '<div class="field-control" style="flex:1;"><select id="restock-pack-unit-' + ing.id + '">' + unitOptionsHtml(ing.unit) + '</select></div>' +
                  '</div>' +
                '</div>' +
                '<div class="field-group" style="margin-bottom:0;">' +
                  '<label>Cost to use</label>' +
                  '<div class="field-control"><select id="restock-method-' + ing.id + '">' +
                    '<option value="latest">New price (latest purchase)</option>' +
                    '<option value="average">Average with current stock</option>' +
                  '</select></div>' +
                '</div>' +
              '</div>' +
              '<div class="btn-row" style="margin-top:16px;">' +
                '<button type="button" class="btn-outline" id="restock-cancel-' + ing.id + '">Cancel</button>' +
                '<button type="button" class="btn-dark" id="restock-save-' + ing.id + '">Add Stock</button>' +
              '</div>' +
            '</td>';
 
          document.getElementById("restock-cancel-" + ing.id).addEventListener("click", function () {
            renderIngredientTable();
          });
 
          document.getElementById("restock-save-" + ing.id).addEventListener("click", async function () {
            var qty = parseFloat(document.getElementById("restock-qty-" + ing.id).value);
            var price = parseFloat(document.getElementById("restock-price-" + ing.id).value);
            var packSize = parseFloat(document.getElementById("restock-pack-size-" + ing.id).value);
            var packFactor = unitFactor(document.getElementById("restock-pack-unit-" + ing.id).value, ing.unit);
            if (packFactor === null) {
              toast("That unit can't be converted to " + ing.unit + ". Pick a matching unit (g/kg, ml/L or pc).");
              return;
            }
            var conversion = packSize * packFactor; // recipe units in ONE purchase unit
 
            if (!qty || qty <= 0 || isNaN(price) || price < 0) {
              toast("Enter a quantity purchased and a total price paid.");
              return;
            }
            if (!(conversion > 0)) {
              toast("Enter how much each purchase unit contains (greater than 0).");
              return;
            }
 
            var costPerPurchaseUnit = price / qty;
            var latestCostPerUnit = costPerPurchaseUnit / conversion;
            var addedStock = qty * conversion;
            var oldStock = Number(ing.stock_qty) || 0;
            var newStockQty = round4(oldStock + addedStock);
            // "average" blends what is left on the shelf (old price) with what was just bought (new price).
            var newCostPerUnit = latestCostPerUnit;
            if (document.getElementById("restock-method-" + ing.id).value === "average" && oldStock > 0) {
              newCostPerUnit = (oldStock * (Number(ing.cost_per_unit) || 0) + addedStock * latestCostPerUnit) / (oldStock + addedStock);
            }
 
            var saveBtn = document.getElementById("restock-save-" + ing.id);
            saveBtn.disabled = true;
 
            var result = await updateIngredient(ing.id, {
              cost_per_unit: newCostPerUnit,
              stock_qty: newStockQty,
              units_per_purchase: conversion
            });
 
            if (result.error) {
              saveBtn.disabled = false;
              toast("Couldn't restock: " + result.error.message);
              return;
            }
 
            await recalcRecipesForIngredient(ing.id, newCostPerUnit);
            ing.cost_per_unit = newCostPerUnit;
            ing.stock_qty = newStockQty;
            ing.units_per_purchase = conversion;
            await logActivitySupa("Restocked ingredient - " + ing.name + " (+" + qty + " " + (ing.purchase_unit || ing.unit) + " = +" + fmtQty(addedStock) + " " + ing.unit + ")");
            renderIngredientTable();
            toast(ing.name + " restocked: +" + fmtQty(addedStock) + " " + ing.unit + ".");
          });
        }
      });
    }

    function toggleEditRow(id) {
      var ing = ingredients.find(function (i) { return String(i.id) === String(id); });
      if (!ing) return;
      var rows = body.querySelectorAll("tr");
      rows.forEach(function (tr) {
        if (tr.getAttribute("data-id") !== String(ing.id)) return;

        function field(label, inputId, type, value, extra) {
          return '<div class="field-group" style="margin-bottom:0;">' +
            '<label>' + label + '</label>' +
            '<div class="field-control"><input type="' + type + '" id="' + inputId + '-' + ing.id + '" value="' + escAttr(value) + '"' + (extra || "") + '></div>' +
          '</div>';
        }

        // Edit the price you actually pay per purchase unit (e.g. per sack); cost per recipe unit is worked out from it.
        var upp = Number(ing.units_per_purchase) > 0 ? Number(ing.units_per_purchase) : 1;
        var puLabel = ing.purchase_unit || ing.unit;
        // Bought loose by weight/volume (no package): show the familiar per-kg / per-liter price.
        var perKg = upp === 1 && (ing.unit === "g" || ing.unit === "ml") && (!ing.purchase_unit || ing.purchase_unit === ing.unit);
        var priceFactor = perKg ? 1000 : upp;
        var priceLabelUnit = perKg ? (ing.unit === "g" ? "kg" : "L") : puLabel;
        var shownPrice = r2(Number(ing.cost_per_unit) * priceFactor);

        tr.innerHTML =
          '<td colspan="10">' +
            '<div class="form-row" style="align-items:flex-end;margin:0;flex-wrap:wrap;">' +
              field("Name", "edit-name", "text", ing.name) +
              '<div class="field-group" style="margin-bottom:0;"><label>Category</label><div class="field-control"><select id="edit-category-' + ing.id + '">' + categoryOptionsHtml(ing.category || "", !ing.category) + '</select></div></div>' +
              field("Supplier", "edit-supplier", "text", ing.supplier || "") +
              '<div class="field-group" style="margin-bottom:0;"><label>Price per ' + escAttr(priceLabelUnit) + ' (\u20B1)</label>' +
                '<div class="field-control"><input type="number" id="edit-price-' + ing.id + '" value="' + shownPrice + '" min="0" step="any"></div>' +
                '<p class="field-hint" id="edit-price-hint-' + ing.id + '"></p></div>' +
              field("Stock (" + ing.unit + ")", "edit-stock", "number", round4(ing.stock_qty), ' min="0" step="any"') +
              field("Low-stock alert (" + ing.unit + ")", "edit-low", "number", ing.low_stock_threshold != null ? ing.low_stock_threshold : "", ' min="0" step="any"') +
            '</div>' +
            '<div class="btn-row" style="margin-top:16px;">' +
              '<button type="button" class="btn-outline" id="edit-cancel-' + ing.id + '">Cancel</button>' +
              '<button type="button" class="btn-dark" id="edit-save-' + ing.id + '">Save</button>' +
            '</div>' +
          '</td>';

        document.getElementById("edit-cancel-" + ing.id).addEventListener("click", function () {
          renderIngredientTable();
        });

        function updateEditPriceHint() {
          var p = parseFloat(document.getElementById("edit-price-" + ing.id).value);
          var hint = document.getElementById("edit-price-hint-" + ing.id);
          if (isNaN(p) || p < 0) { hint.textContent = ""; return; }
          var unchanged = Math.abs(p - shownPrice) < 1e-9;
          var perUnit = unchanged ? Number(ing.cost_per_unit) : p / priceFactor;
          hint.textContent = "= " + fmtCostPer(perUnit, ing.unit) + (upp !== 1 ? " (1 " + puLabel + " = " + upp.toLocaleString() + " " + ing.unit + ")" : "");
        }
        document.getElementById("edit-price-" + ing.id).addEventListener("input", updateEditPriceHint);
        updateEditPriceHint();

        document.getElementById("edit-save-" + ing.id).addEventListener("click", async function () {
          var name = document.getElementById("edit-name-" + ing.id).value.trim();
          var category = document.getElementById("edit-category-" + ing.id).value;
          var supplier = document.getElementById("edit-supplier-" + ing.id).value.trim();
          var priceEntered = parseFloat(document.getElementById("edit-price-" + ing.id).value);
          // Untouched price keeps the exact stored cost (no rounding drift); a changed price is converted per recipe unit.
          var cost = Math.abs(priceEntered - shownPrice) < 1e-9 ? Number(ing.cost_per_unit) : priceEntered / priceFactor;
          var stock = parseFloat(document.getElementById("edit-stock-" + ing.id).value);
          var lowRaw = document.getElementById("edit-low-" + ing.id).value;
          var low = lowRaw === "" ? null : parseFloat(lowRaw);

          if (!name) { toast("Ingredient name is required."); return; }
          if (!category) { toast("Please choose a category."); return; }
          if (isNaN(priceEntered) || priceEntered < 0 || isNaN(cost)) { toast("Enter a valid price."); return; }
          if (isNaN(stock) || stock < 0) { toast("Enter a valid stock quantity."); return; }
          if (low !== null && (isNaN(low) || low < 0)) { toast("Enter a valid low-stock alert level."); return; }

          var saveBtn = document.getElementById("edit-save-" + ing.id);
          saveBtn.disabled = true;

          var fields = {
            name: name,
            category: category,
            supplier: supplier || null,
            cost_per_unit: cost,
            stock_qty: round4(stock),
            low_stock_threshold: low
          };
          var costChanged = Number(ing.cost_per_unit) !== cost;
          var result = await updateIngredient(ing.id, fields);

          if (result.error) {
            saveBtn.disabled = false;
            toast("Couldn't save changes: " + result.error.message);
            return;
          }
          if (costChanged) await recalcRecipesForIngredient(ing.id, cost);

          ing.name = fields.name;
          ing.category = fields.category;
          ing.supplier = fields.supplier;
          ing.cost_per_unit = fields.cost_per_unit;
          ing.stock_qty = fields.stock_qty;
          ing.low_stock_threshold = fields.low_stock_threshold;
          ing.updated_at = new Date().toISOString();

          await logActivitySupa("Edited raw ingredient - " + ing.name);
          renderIngredientTable();
          toast(ing.name + " updated.");
        });
      });
    }

    var addBtn = document.getElementById("show-add-ingredient");
    var addForm = document.getElementById("add-ingredient-form");
    document.getElementById("ing-category").innerHTML = categoryOptionsHtml("", true);
    addBtn.addEventListener("click", function () {
      addForm.classList.toggle("is-visible");
      if (addForm.classList.contains("is-visible")) addForm.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    document.getElementById("cancel-ingredient-btn").addEventListener("click", function () {
      ["ing-name","ing-category","ing-qty-purchased","ing-total-price","ing-supplier","ing-start-stock","ing-low-stock","ing-purchase-unit"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = "";
      });
      resetPackFields();
      updateCostPreview();
      addForm.classList.remove("is-visible");
    });

    var qtyInput = document.getElementById("ing-qty-purchased");
    var priceInput = document.getElementById("ing-total-price");
    var costPreview = document.getElementById("ing-cost-preview");

    function updateCostPreview() {
      var qty = parseFloat(qtyInput.value);
      var price = parseFloat(priceInput.value);
      var unit = document.getElementById("ing-unit").value || "unit";
      var purchaseUnitRaw = document.getElementById("ing-purchase-unit").value.trim();
      var purchaseUnit = purchaseUnitRaw || unit;
      var hasPackage = purchaseUnitRaw !== "";
      document.getElementById("ing-pack-group").style.display = hasPackage ? "" : "none";
      document.getElementById("ing-qty-label").textContent = "Quantity purchased (" + purchaseUnit + (hasPackage ? "s" : "") + ")";
      if (!hasPackage) {
        // Bought straight in the recipe unit: nothing to convert.
        document.getElementById("ing-pack-size").value = "1";
        document.getElementById("ing-pack-unit").value = unit;
      }
      var packSize = parseFloat(document.getElementById("ing-pack-size").value) || 0;
      var packUnit = document.getElementById("ing-pack-unit").value;
      var factor = unitFactor(packUnit, unit);
      var conversion = factor === null ? 0 : packSize * factor;
      document.getElementById("ing-conversion").value = conversion > 0 ? conversion : "";

      var hintEl = document.getElementById("ing-conversion-hint");
      hintEl.style.color = "";
      if (factor === null) {
        hintEl.textContent = packUnit + " can't be converted to " + unit + ". Pick a matching unit (g/kg, ml/L or pc).";
        hintEl.style.color = "#9C3B1E";
      } else {
        var label = purchaseUnitRaw || "pack";
        hintEl.textContent = "1 " + label + " = " + packSize + " " + packUnit +
          (packUnit !== unit ? "  \u2192  " + conversion.toLocaleString(undefined, { maximumFractionDigits: 4 }) + " " + unit + " in your recipes" : "");
      }
 
      var purchaseNote = document.getElementById("ing-cost-preview-purchase");
 
      if (qty > 0 && price >= 0 && conversion > 0) {
        var costPerPurchaseUnit = price / qty;
        var costPerRecipeUnit = costPerPurchaseUnit / conversion;
        costPreview.textContent = fmtCostPer(costPerRecipeUnit, unit);
        purchaseNote.textContent = purchaseUnit !== unit
          ? "(" + peso(costPerPurchaseUnit) + " per " + purchaseUnit + ")"
          : "";
      } else {
        costPreview.textContent = fmtCostPer(0, unit);
        purchaseNote.textContent = "";
      }
    }
    // Pack fields start out matching the recipe unit; keep them compatible when the recipe unit changes.
    var packUnitTouched = false; // true once the person picks the package's unit themselves
    function resetPackFields() {
      packUnitTouched = false;
      document.getElementById("ing-pack-size").value = "1";
      document.getElementById("ing-pack-unit").value = document.getElementById("ing-unit").value;
      document.getElementById("ing-conversion").value = "1";
    }
    document.getElementById("ing-pack-unit").addEventListener("change", function () { packUnitTouched = true; });
    document.getElementById("ing-unit").addEventListener("change", function () {
      var u = document.getElementById("ing-unit").value;
      var packUnitEl = document.getElementById("ing-pack-unit");
      // The package unit follows the recipe unit until it is chosen by hand (or if it no longer fits).
      if (!packUnitTouched || unitFactor(packUnitEl.value, u) === null) packUnitEl.value = u;
    });
    document.getElementById("ing-purchase-unit").addEventListener("change", function () {
      var packUnitEl = document.getElementById("ing-pack-unit");
      if (!packUnitTouched) packUnitEl.value = document.getElementById("ing-unit").value;
    });

    [qtyInput, priceInput, document.getElementById("ing-unit"), document.getElementById("ing-purchase-unit"), document.getElementById("ing-pack-size"), document.getElementById("ing-pack-unit")].forEach(function (el) {
        el.addEventListener("input", updateCostPreview);
        el.addEventListener("change", updateCostPreview);
      });
    updateCostPreview();

    document.getElementById("save-ingredient-btn").addEventListener("click", async function () {
      var name = document.getElementById("ing-name").value.trim();
      var category = document.getElementById("ing-category").value;
      var unit = document.getElementById("ing-unit").value;
      var qty = parseFloat(qtyInput.value);
      var totalPrice = parseFloat(priceInput.value);
      var packSize = parseFloat(document.getElementById("ing-pack-size").value);
      var packFactor = unitFactor(document.getElementById("ing-pack-unit").value, unit);
      if (packFactor === null) {
        toast("Each purchase unit must use a unit that matches the recipe unit (g/kg, ml/L or pc).");
        return;
      }
      var conversion = packSize * packFactor; // recipe units in ONE purchase unit (e.g. 1 sack of 25 kg = 25000 g)
      var purchaseUnit = document.getElementById("ing-purchase-unit").value.trim() || (conversion === 1 ? unit : "pack");
      var startStockInput = document.getElementById("ing-start-stock").value;
      var startStock = startStockInput !== "" ? parseFloat(startStockInput) : (qty * conversion || 0);
      var lowStockVal = document.getElementById("ing-low-stock").value;
 
      if (!name || !qty || qty <= 0 || isNaN(totalPrice)) {
        toast("Fill in ingredient name, quantity purchased, and total price paid.");
        return;
      }
      if (!category) { toast("Please choose a category."); return; }
      if (!(conversion > 0)) {
        toast("Enter how much each purchase unit contains (greater than 0).");
        return;
      }
      var costPerPurchaseUnit = totalPrice / qty;
      var costPerUnit = costPerPurchaseUnit / conversion; // cost per RECIPE unit — this is what recipes use
 
      var dupIng = ingredients.some(function (i) { return String(i.name || "").trim().toLowerCase() === name.toLowerCase(); });
      if (dupIng) { toast('"' + name + '" is already in your raw ingredient stock. Edit or restock it instead.'); return; }

      var saveBtn = document.getElementById("save-ingredient-btn");
      saveBtn.disabled = true;
      var result = await insertIngredient({
        name: name, category: category, unit: unit,
        cost_per_unit: costPerUnit, baseline_cost_per_unit: costPerUnit,
        stock_qty: startStock, low_stock_threshold: lowStockVal === "" ? null : parseFloat(lowStockVal),
        supplier: document.getElementById("ing-supplier").value.trim() || null,
        purchase_unit: purchaseUnit, units_per_purchase: conversion
      });
      saveBtn.disabled = false;
 
      if (result.error) { toast("Couldn't save ingredient: " + result.error.message); return; }
 
      ingredients.push(result.data);
      await logActivitySupa("Added raw ingredient - " + name);
 
      ["ing-name","ing-category","ing-qty-purchased","ing-total-price","ing-supplier","ing-start-stock","ing-low-stock","ing-purchase-unit"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = "";
      });
      resetPackFields();
      updateCostPreview();
      renderIngredientTable();
      addForm.classList.remove("is-visible");
      toast('"' + name + '" added to raw ingredient stock.');
    });

    /* ---- Bread Stock tab ---- */
    var breadBody = document.getElementById("bread-stock-body");
    var breadBatches = await fetchBreadInventory();

    function renderBreadStock() {
      breadBody.innerHTML = "";
      if (!breadBatches.length) {
        breadBody.innerHTML = '<tr><td colspan="6" class="empty-note">No bread stock logged yet.</td></tr>';
        return;
      }
      // Aggregate by recipe.
      var totals = {};
      breadBatches.forEach(function (b) {
        var name = b.recipes ? b.recipes.name : "Unknown";
        if (!totals[name]) totals[name] = { baked: 0, sold: 0, lastBaked: b.date_baked, batches: [] };
        totals[name].baked += b.quantity_baked;
        totals[name].sold += b.quantity_sold;
        if (new Date(b.date_baked) > new Date(totals[name].lastBaked)) totals[name].lastBaked = b.date_baked;
      });
      // Batches (morning / afternoon / evening) logged on each item's most recent baking day.
      breadBatches.forEach(function (b) {
        var name = b.recipes ? b.recipes.name : "Unknown";
        if (b.batch && b.date_baked === totals[name].lastBaked && totals[name].batches.indexOf(b.batch) === -1) {
          totals[name].batches.push(b.batch);
        }
      });
      Object.keys(totals).forEach(function (name) {
        var t = totals[name];
        var remaining = Math.max(0, t.baked - t.sold);
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + name + "</td><td>" + t.baked + " pcs</td><td>" + t.sold + " pcs</td><td>" + remaining + " pcs</td><td>" + new Date(t.lastBaked).toLocaleDateString() + "</td><td>" + (t.batches.length ? t.batches.join(", ") : "\u2014") + "</td>";
        breadBody.appendChild(tr);
      });
    }

    var showAddBreadBtn = document.getElementById("show-add-bread-stock");
    var addBreadForm = document.getElementById("add-bread-stock-form");
    var bsSelect = document.getElementById("bs-bread-item");
    var bsPrice = document.getElementById("bs-selling-price");
    var bsQty = document.getElementById("bs-qty-baked");
    var bsDate = document.getElementById("bs-date-baked");
    var bsIngredientsBody = document.getElementById("bs-ingredients-used-body");
    var recipeLineCache = {};

    function populateBreadItemSelect() {
      bsSelect.innerHTML = "";
      if (!recipes.length) {
        bsSelect.innerHTML = '<option value="">No recipes yet \u2014 add one first</option>';
        return;
      }
      recipes.forEach(function (r) {
        var opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name;
        bsSelect.appendChild(opt);
      });
    }

    async function updateBreadStockPreview() {
      var recipe = recipes.find(function (r) { return r.id === bsSelect.value; });
      bsPrice.value = recipe ? peso(recipe.selling_price) : peso(0);
      bsDate.value = todayLabel();

      var qty = parseFloat(bsQty.value) || 0;
      bsIngredientsBody.innerHTML = "";
      if (!recipe || !qty) {
        bsIngredientsBody.innerHTML = '<tr><td colspan="2" class="empty-note">Pick a bread item and enter quantity baked to preview ingredient usage.</td></tr>';
        return;
      }

      if (!recipeLineCache[recipe.id]) {
        var loaded = await fetchRecipeWithIngredients(recipe.id);
        recipeLineCache[recipe.id] = loaded ? loaded.lineItems : [];
      }
      var lines = recipeLineCache[recipe.id];
      var scale = qty / recipe.base_batch_size;
      lines.forEach(function (item) {
        var usedQty = item.qty * scale;
        var have = ingredients.find(function (i) { return i.id === item.ingredientId; });
        var short = have && Number(have.stock_qty) + 1e-9 < usedQty;
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + item.name + "</td><td>" + fmtQty(usedQty) + " " + item.unit +
          (short ? ' <span style="color:#9C3B1E;">\u2014 only ' + fmtQty(have.stock_qty) + " in stock</span>" : "") + "</td>";
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

    document.getElementById("cancel-bread-stock-btn").addEventListener("click", function () {
      bsQty.value = "";
      updateBreadStockPreview();
      addBreadForm.classList.remove("is-visible");
    });

    bsSelect.addEventListener("change", updateBreadStockPreview);
    bsQty.addEventListener("input", updateBreadStockPreview);

    document.getElementById("save-bread-stock-btn").addEventListener("click", async function () {
      var recipe = recipes.find(function (r) { return r.id === bsSelect.value; });
      var qty = parseFloat(bsQty.value);
      if (!recipe) { toast("Add a recipe first, then log bread inventory for it."); return; }
      if (!qty || qty <= 0 || Math.floor(qty) !== qty) { toast("Enter a whole number of pieces baked."); return; }

      if (!recipeLineCache[recipe.id]) {
        var loaded = await fetchRecipeWithIngredients(recipe.id);
        recipeLineCache[recipe.id] = loaded ? loaded.lineItems : [];
      }
      var lines = recipeLineCache[recipe.id];
      var scale = qty / recipe.base_batch_size;
      var shortNames = [];
      var consumed = lines.map(function (item) {
        var ing = ingredients.find(function (i) { return i.id === item.ingredientId; });
        var usedQty = item.qty * scale;
        if (ing && Number(ing.stock_qty) + 1e-9 < usedQty) shortNames.push(item.name + " (need " + fmtQty(usedQty) + " " + item.unit + ", have " + fmtQty(ing.stock_qty) + ")");
        return { ingredientId: item.ingredientId, newStockQty: ing ? ing.stock_qty - usedQty : 0 };
      });
      if (shortNames.length && !confirm("Not enough stock for:\n- " + shortNames.join("\n- ") + "\n\nThese will be set to 0. Log the bread anyway?")) return;

      var saveBtn = document.getElementById("save-bread-stock-btn");
      saveBtn.disabled = true;
      var result = await insertBreadBatch(recipe.id, qty, consumed, document.getElementById("bs-batch").value);
      saveBtn.disabled = false;

      if (result.error) { toast("Couldn't save: " + result.error.message); return; }

      consumed.forEach(function (c) {
        var ing = ingredients.find(function (i) { return i.id === c.ingredientId; });
        if (ing) ing.stock_qty = round4(Math.max(0, c.newStockQty));
      });
      breadBatches.unshift(Object.assign({ recipes: { name: recipe.name } }, result.data));

      await logActivitySupa("Added bread inventory- " + recipe.name + " +" + qty);

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
  function initAdminPage() {
    var body = document.getElementById("accounts-body");
    if (!body) return;

    async function renderAccounts() {
      var result = await supabaseClient.from("profiles").select("*");
      if (result.error) {
        console.error("renderAccounts error:", result.error);
        body.innerHTML = '<tr><td colspan="7" class="empty-note">Couldn\'t load accounts: ' + result.error.message + '</td></tr>';
        return;
      }
      var accounts = (result.data || []).slice().sort(function (a, b) {
        var an = nameOf(a), bn = nameOf(b);
        return (an.last + " " + an.first).toLowerCase().localeCompare((bn.last + " " + bn.first).toLowerCase());
      });
      body.innerHTML = "";
      if (!accounts.length) {
        body.innerHTML = '<tr><td colspan="7" class="empty-note">No accounts yet.</td></tr>';
        return;
      }
      accounts.forEach(function (acc) {
        var tr = document.createElement("tr");
        var nm = nameOf(acc);
        tr.innerHTML =
          "<td>" + escAttr(nm.last) + "</td>" +
          "<td>" + escAttr(nm.first) + "</td>" +
          "<td>" + (nm.middle ? escAttr(nm.middle) : "\u2014") + "</td>" +
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
        logBody.innerHTML = '<tr><td colspan="4" class="empty-note">No activity yet.</td></tr>';
        return;
      }
      entries.forEach(function (entry) {
        var tr = document.createElement("tr");
        var when = new Date(entry.created_at);
        var dateLabel = when.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
        var timeLabel = when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        var userName = entry.profiles ? entry.profiles.full_name : "Unknown";
        tr.innerHTML = "<td>" + dateLabel + "</td><td>" + timeLabel + "</td><td>" + userName + "</td><td>" + entry.action + "</td>";
        logBody.appendChild(tr);
      });
    }

    renderAccounts();
    renderActivity();
  }

  /* =======================================================================
     Admin — invite account (invite-account.html)
     ======================================================================= */

  /* ---- Account emails (invite / create) ----
     These use a SEPARATE, throw-away Supabase client that never stores a session,
     so sending an email or creating an account for someone else can never log
     the Super Admin out or swap them into the new user's session. */
  function makeTempClient() {
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }
  function siteUrl(file) {
    return window.location.origin + window.location.pathname.replace(/[^\/]*$/, "") + file;
  }
  function generatePassword() {
    var sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*?"];
    var all = sets.join("");
    var arr = new Uint32Array(14);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    var out = sets.map(function (set, i) { return set[arr[i] % set.length]; });
    for (var i = sets.length; i < arr.length; i++) out.push(all[arr[i] % all.length]);
    // shuffle
    for (var j = out.length - 1; j > 0; j--) { var k = arr[j] % (j + 1); var tmp = out[j]; out[j] = out[k]; out[k] = tmp; }
    return out.join("");
  }

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
      var email = document.getElementById("invite-email").value.trim();
      if (!isValidEmail(email)) { toast("Enter a valid email address."); return; }

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

      // The invite record carries the role. The person's real name is entered by
      // them later, so the email address stands in as a placeholder name.
      var insertResult = await supabaseClient.from("invites").insert({
        email: email, full_name: email, role: selectedRole, status: "Pending"
      }).select().single();

      if (insertResult.error) {
        sendBtn.disabled = false;
        toast("Couldn't create the invite: " + insertResult.error.message);
        return;
      }
      var inviteId = insertResult.data.id;

      // Email them a confirmation link. Opening it confirms their email and brings
      // them to our sign-up page ("?setup=1"), where they add their name + password.
      var mail = await makeTempClient().auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: siteUrl("signup.html?setup=1"),
          shouldCreateUser: true,
          data: { full_name: email, account_setup_done: false }
        }
      });

      sendBtn.disabled = false;

      if (mail.error) {
        // Roll the invite back so the person can be invited again after the problem is fixed.
        await supabaseClient.from("invites").delete().eq("id", inviteId);
        toast("Couldn't send the email: " + mail.error.message);
        return;
      }

      await logActivitySupa("Invited account - " + email + " (" + selectedRole + ")");

      var link = siteUrl("signup.html?invite=" + inviteId);
      var resultText = document.getElementById("invite-result-text");
      if (resultText) resultText.textContent = "We emailed a confirmation link to " + email + ". Once they click it, they'll be brought to DRR Bakery to enter their name and set a password.";

      if (formSection) formSection.style.display = "none";
      if (resultSection) resultSection.classList.add("is-visible");
      if (linkInput) linkInput.value = link;

      toast("Invitation emailed to " + email + ".");
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
     Admin — create account (create-account.html)
     The Super Admin fills in everything and sets the first password. The new
     user is emailed a link to confirm their email address, then logs in.
     ======================================================================= */

  function initCreateAccountPage() {
    var btn = document.getElementById("create-account-btn");
    if (!btn) return;
    var selectedRole = "Staff";
    var formSection = document.getElementById("create-form-section");
    var resultSection = document.getElementById("create-result-section");
    var form = formSection;

    document.querySelectorAll("#create-role-toggle .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.querySelectorAll("#create-role-toggle .chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        selectedRole = chip.getAttribute("data-role");
      });
    });

    var genLink = document.getElementById("create-generate-pw");
    if (genLink) {
      genLink.addEventListener("click", function (e) {
        e.preventDefault();
        var pw = generatePassword();
        var input = document.getElementById("create-password");
        input.value = pw;
        input.type = "text"; // show it so the Super Admin can pass it on
        toast("Password generated. Copy it before you create the account.");
      });
    }

    btn.addEventListener("click", async function () {
      clearAllFieldErrors(form);
      var first = document.getElementById("create-first-name").value.trim();
      var middle = document.getElementById("create-middle-name").value.trim();
      var last = document.getElementById("create-last-name").value.trim();
      var email = document.getElementById("create-email").value.trim();
      var password = document.getElementById("create-password").value;
      var hasError = false;

      if (!first) { setFieldError("create-first-name", "First name is required."); hasError = true; }
      if (!last) { setFieldError("create-last-name", "Last name is required."); hasError = true; }
      if (!email) { setFieldError("create-email", "Email is required."); hasError = true; }
      else if (!isValidEmail(email)) { setFieldError("create-email", "Enter a valid email address."); hasError = true; }
      if (!password) { setFieldError("create-password", "Password is required."); hasError = true; }
      else if (!isValidPassword(password)) { setFieldError("create-password", "Use at least 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol."); hasError = true; }
      if (hasError) return;

      btn.disabled = true;

      var existingProfile = await supabaseClient.from("profiles").select("id").ilike("email", email).maybeSingle();
      if (existingProfile.data) {
        btn.disabled = false;
        setFieldError("create-email", "An account with this email already exists.");
        return;
      }
      var existingInvite = await supabaseClient.from("invites").select("id").ilike("email", email).eq("status", "Pending").maybeSingle();
      if (existingInvite.data) {
        btn.disabled = false;
        setFieldError("create-email", "This email already has a pending invite. Delete it or ask them to use it.");
        return;
      }

      var fullName = joinName(first, middle, last);

      // 1) Record the role as an invite for this email. The database's sign-up
      //    step reads it to give the new account the right role.
      var inviteResult = await supabaseClient.from("invites").insert({
        email: email, full_name: fullName, role: selectedRole, status: "Pending"
      }).select().single();
      if (inviteResult.error) {
        btn.disabled = false;
        toast("Couldn't create the account: " + inviteResult.error.message);
        return;
      }

      // 2) Create the login. Supabase emails them to confirm their address.
      var signUp = await makeTempClient().auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: siteUrl("index.html"),
          data: { full_name: fullName, first_name: first, middle_name: middle, last_name: last, account_setup_done: true }
        }
      });

      btn.disabled = false;

      var alreadyRegistered = signUp.data && signUp.data.user && signUp.data.user.identities && signUp.data.user.identities.length === 0;
      if (signUp.error || alreadyRegistered) {
        await supabaseClient.from("invites").delete().eq("id", inviteResult.data.id);
        toast("Couldn't create the account: " + (signUp.error ? signUp.error.message : "that email is already registered."));
        return;
      }

      await logActivitySupa("Created account - " + fullName + " (" + selectedRole + ")");

      var needsConfirm = !(signUp.data && signUp.data.session);
      var resultText = document.getElementById("create-result-text");
      if (resultText) {
        resultText.textContent = fullName + "'s " + selectedRole + " account was created. " +
          (needsConfirm
            ? "We emailed " + email + " a link to confirm their email address. After confirming, they can log in with the password you set \u2014 share it with them privately."
            : "They can log in right away with the password you set \u2014 share it with them privately.");
      }
      if (formSection) formSection.style.display = "none";
      if (resultSection) resultSection.classList.add("is-visible");
      toast("Account created for " + fullName + ".");
    });
  }

  /* =======================================================================
     Admin — edit account (edit-account.html)
     ======================================================================= */

  function initEditAccountPage() {
    var nameInput = document.getElementById("edit-account-first-name");
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
      var accName = nameOf(acc);
      nameInput.value = accName.first;
      document.getElementById("edit-account-middle-name").value = accName.middle;
      document.getElementById("edit-account-last-name").value = accName.last;
      ["edit-account-first-name", "edit-account-middle-name", "edit-account-last-name", "edit-account-email"].forEach(function (fid) {
        var f = document.getElementById(fid);
        f.setAttribute("readonly", "readonly");
        f.setAttribute("aria-readonly", "true");
      });
      document.getElementById("edit-account-email").value = acc.email;
      setStatusUI(acc.status === "Active" ? "Active" : "Inactive");

      var isSuperAdmin = acc.role === "Super Admin";
      // Role and status are only chosen here; nothing is written until "Save changes" is clicked.
      var pendingRole = acc.role;
      var pendingStatus = acc.status === "Active" ? "Active" : "Inactive";
      var superAdminSection = document.getElementById("super-admin-section");
      var deleteBtn = document.getElementById("delete-account-btn");
      var deactivateBtn = document.getElementById("deactivate-account-btn");

      if (isSuperAdmin) {
        // There's only ever one Super Admin — lock the role toggle entirely
        // and block deleting/deactivating this account directly. To hand
        // off ownership, open a DIFFERENT account's Edit page and click its
        // Super Admin chip instead — that's the only way to transfer it.
        setRoleUI("Super Admin");
        document.querySelectorAll("#edit-role-toggle .chip").forEach(function (chip) {
          chip.setAttribute("disabled", "disabled");
        });
        deleteBtn.setAttribute("disabled", "disabled");
        deactivateBtn.setAttribute("disabled", "disabled");
        // The Super Admin account must always stay Active.
        setStatusUI("Active");
        document.querySelectorAll("#edit-status-toggle .chip").forEach(function (chip) {
          chip.setAttribute("disabled", "disabled");
          chip.setAttribute("aria-disabled", "true");
        });

        superAdminSection.innerHTML =
          '<div class="locked-notice">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8"/></svg>' +
          '<span><strong>This is the Super Admin account.</strong> It is the owner of the system, so it always stays <strong>Active</strong> and its role can\'t be changed, deactivated or deleted. There can only be one Super Admin. To give ownership to someone else, open that person\'s Edit page and click <strong>Super Admin</strong>. They will become the Super Admin, and this account will become an Admin.</span>' +
          '</div>';
      } else {
        superAdminSection.innerHTML = "";
        setRoleUI(acc.role);

        document.querySelectorAll("#edit-role-toggle .chip[data-role='Admin'], #edit-role-toggle .chip[data-role='Staff']").forEach(function (chip) {
          chip.addEventListener("click", function () {
            pendingRole = chip.getAttribute("data-role");
            setRoleUI(pendingRole);
          });
        });

        var superAdminChip = document.querySelector("#edit-role-toggle .chip[data-role='Super Admin']");
        superAdminChip.addEventListener("click", async function () {
          var existingResult = await supabaseClient.from("profiles").select("id, full_name").eq("role", "Super Admin").maybeSingle();
          var existing = existingResult.data;

          var confirmMsg = existing
            ? "Make " + acc.full_name + " the new Super Admin? " + existing.full_name + " (currently Super Admin) will be switched to Admin right after \u2014 only one Super Admin is allowed at a time."
            : "Make " + acc.full_name + " the Super Admin? This restores Super Admin access to the system.";
          if (!confirm(confirmMsg)) return;

          superAdminChip.disabled = true;
          var originalTargetRole = acc.role;

          var promoteResult = await supabaseClient.from("profiles").update({ role: "Super Admin" }).eq("id", acc.id);
          if (promoteResult.error) {
            superAdminChip.disabled = false;
            toast("Couldn't promote " + acc.full_name + ": " + promoteResult.error.message);
            return;
          }

          if (existing && existing.id !== acc.id) {
            var demoteResult = await supabaseClient.from("profiles").update({ role: "Admin" }).eq("id", existing.id);
            if (demoteResult.error) {
              // Roll back so we never end up with two Super Admins at once.
              await supabaseClient.from("profiles").update({ role: originalTargetRole }).eq("id", acc.id);
              superAdminChip.disabled = false;
              toast("Couldn't finish the transfer, so it was rolled back. Try again.");
              return;
            }
          }

          acc.role = "Super Admin";
          await logActivitySupa("Transferred Super Admin role to - " + acc.full_name);
          toast(acc.full_name + " is now Super Admin \u2014 redirecting\u2026");
          setTimeout(function () { window.location.href = "admin.html"; }, 1400);
        });
      }

      document.querySelectorAll("#edit-status-toggle .chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          if (isSuperAdmin) return; // Super Admin status is locked
          pendingStatus = chip.getAttribute("data-status") === "Active" ? "Active" : "Inactive";
          setStatusUI(pendingStatus);
        });
      });

      document.getElementById("deactivate-account-btn").addEventListener("click", async function () {
        var updateResult = await supabaseClient.from("profiles").update({ status: "Inactive" }).eq("id", acc.id);
        if (updateResult.error) { toast("Couldn't deactivate: " + updateResult.error.message); return; }
        acc.status = "Inactive";
        pendingStatus = "Inactive";
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

      var saveAccountBtn = document.getElementById("save-account-btn");
      if (isSuperAdmin) {
        // Nothing on the Super Admin account can be changed here.
        saveAccountBtn.setAttribute("disabled", "disabled");
      }
      saveAccountBtn.addEventListener("click", async function () {
        var changes = {};
        var currentStatus = acc.status === "Active" ? "Active" : "Inactive";
        if (pendingRole !== acc.role) changes.role = pendingRole;
        if (pendingStatus !== currentStatus) changes.status = pendingStatus;
        if (!Object.keys(changes).length) { toast("No changes to save."); return; }

        saveAccountBtn.disabled = true;
        var saveResult = await supabaseClient.from("profiles").update(changes).eq("id", acc.id);
        if (saveResult.error) {
          saveAccountBtn.disabled = false;
          toast("Couldn't save changes: " + saveResult.error.message);
          return;
        }
        if (changes.role) {
          acc.role = changes.role;
          await logActivitySupa("Updated account role - " + acc.full_name + " (" + changes.role + ")");
        }
        if (changes.status) {
          acc.status = changes.status;
          await logActivitySupa("Updated account status - " + acc.full_name + " (" + changes.status + ")");
        }
        toast("Changes saved for " + acc.full_name + ".");
        setTimeout(function () { window.location.href = "admin.html"; }, 900);
      });
    }

    load();
  }

  /* =======================================================================
     Profile / business settings page (profile.html)
     ======================================================================= */

  function initProfilePage() {
    var firstNameInput = document.getElementById("profile-first-name");
    if (!firstNameInput) return;
    var middleNameInput = document.getElementById("profile-middle-name");
    var lastNameInput = document.getElementById("profile-last-name");

    var session = getSession();
    if (!session) { window.location.href = "index.html"; return; }

    // Everything on this page is read-only except the business settings,
    // which only the Super Admin has. Nobody else has anything to save.
    var businessSection = document.getElementById("business-settings-section");
    var actionsRow = document.getElementById("profile-actions");
    if (session.role !== "Super Admin") {
      if (businessSection) businessSection.style.display = "none";
      if (actionsRow) actionsRow.style.display = "none";
    }

    async function load() {
      var profileResult = await supabaseClient.from("profiles").select("*").eq("email", session.email).maybeSingle();
      var profile = profileResult.data;

      // Show the name split into first / middle / last (read-only).
      var myName = profile ? nameOf(profile) : { first: session.firstName, middle: "", last: "" };
      firstNameInput.value = myName.first;
      if (middleNameInput) middleNameInput.value = myName.middle;
      lastNameInput.value = myName.last;
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

    var saveBtn = document.getElementById("save-profile-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", async function () {
        if (session.role !== "Super Admin") return;
        saveBtn.disabled = true;

        var result = await supabaseClient.from("business_settings").update({
          bakery_name: document.getElementById("business-name").value.trim(),
          currency: document.getElementById("business-currency").value,
          target_food_cost_pct: parseFloat(document.getElementById("business-target-foodcost").value) || 0,
          business_hours: document.getElementById("business-hours").value.trim()
        }).eq("id", 1);

        saveBtn.disabled = false;
        if (result.error) {
          toast("Couldn't save settings: " + result.error.message);
          return;
        }
        await logActivitySupa("Updated business settings");
        toast("Changes saved.");
      });
    }

    load();
  }

  
  /* =======================================================================
     Record Sale page (record-sale.html)
     ======================================================================= */

  async function initRecordSalePage() {
    var select = document.getElementById("sale-bread-item");
    if (!select) return;

    var recipes = await fetchRecipes();
    var breadBatches = await fetchBreadInventory();

    function remainingFor(recipeId) {
      var baked = 0, sold = 0;
      breadBatches.forEach(function (b) {
        if (b.recipe_id === recipeId) { baked += b.quantity_baked; sold += b.quantity_sold; }
      });
      return Math.max(0, baked - sold);
    }

    select.innerHTML = "";
    if (!recipes.length) {
      select.innerHTML = '<option value="">No recipes yet</option>';
    } else {
      recipes.forEach(function (r) {
        var opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name + " (" + remainingFor(r.id) + " left)";
        select.appendChild(opt);
      });
    }

    var qtyInput = document.getElementById("sale-qty");
    var priceInput = document.getElementById("sale-price");
    var totalInput = document.getElementById("sale-total");

    function updatePrice() {
      var recipe = recipes.find(function (r) { return r.id === select.value; });
      priceInput.value = recipe ? recipe.selling_price.toFixed(2) : "";
      updateTotal();
    }
    function updateTotal() {
      var qty = parseFloat(qtyInput.value) || 0;
      var price = parseFloat(priceInput.value) || 0;
      totalInput.value = peso(r2(qty * price));
    }

    select.addEventListener("change", updatePrice);
    qtyInput.addEventListener("input", updateTotal);
    priceInput.addEventListener("input", updateTotal);
    updatePrice();

    document.getElementById("save-sale-btn").addEventListener("click", async function () {
      var recipe = recipes.find(function (r) { return r.id === select.value; });
      var qty = parseFloat(qtyInput.value);
      var price = parseFloat(priceInput.value);

      if (!recipe) { toast("Pick a bread item first."); return; }
      if (!qty || qty <= 0 || Math.floor(qty) !== qty) { toast("Enter a whole number of pieces."); return; }
      if (isNaN(price) || price < 0) { toast("Enter a price."); return; }

      var remaining = remainingFor(recipe.id);
      if (qty > remaining) {
        toast("Only " + remaining + " pcs of " + recipe.name + " left in stock.");
        return;
      }

      // Apply the sale against the oldest batch(es) with remaining stock (FIFO).
      var toDeduct = qty;
      var batchUpdates = [];
      var relevantBatches = breadBatches
        .filter(function (b) { return b.recipe_id === recipe.id && b.quantity_sold < b.quantity_baked; })
        .sort(function (a, b) { return new Date(a.date_baked) - new Date(b.date_baked); });

      var firstBatchId = relevantBatches.length ? relevantBatches[0].id : null;

      for (var i = 0; i < relevantBatches.length && toDeduct > 0; i++) {
        var b = relevantBatches[i];
        var available = b.quantity_baked - b.quantity_sold;
        var take = Math.min(available, toDeduct);
        batchUpdates.push({ id: b.id, newSold: b.quantity_sold + take });
        toDeduct -= take;
      }

      var saveBtn = document.getElementById("save-sale-btn");
      saveBtn.disabled = true;

      var saleResult = await insertSale(recipe.id, firstBatchId, qty, price, recipe.cost_per_piece);
      if (saleResult.error) {
        saveBtn.disabled = false;
        toast("Couldn't save sale: " + saleResult.error.message);
        return;
      }

      for (var j = 0; j < batchUpdates.length; j++) {
        await updateBreadBatchSold(batchUpdates[j].id, batchUpdates[j].newSold);
        var localBatch = breadBatches.find(function (bb) { return bb.id === batchUpdates[j].id; });
        if (localBatch) localBatch.quantity_sold = batchUpdates[j].newSold;
      }

      saveBtn.disabled = false;
      await logActivitySupa("Recorded sale - " + recipe.name + " x" + qty);

      select.innerHTML = recipes.map(function (r) {
        return '<option value="' + r.id + '">' + r.name + ' (' + remainingFor(r.id) + ' left)</option>';
      }).join("");
      select.value = recipe.id;
      qtyInput.value = "";
      updatePrice();

      toast("Sale recorded: " + qty + "x " + recipe.name + " for " + peso(r2(qty * price)));
    });
  }

    /* =======================================================================
     Analytics — formal PDF export
     Builds an actual downloadable PDF report (not just a browser print
     dialog) using jsPDF + its AutoTable plugin. Currency is written as
     "PHP" rather than the ₱ symbol because jsPDF's built-in fonts don't
     include that glyph — using it directly would render as a broken box.
     ======================================================================= */

  // Draws the bakery logo (same icon as the site header) to a PNG for the PDF.
  function loadPdfLogo() {
    return new Promise(function (resolve) {
      try {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none">' +
          '<path d="M5.5 19.5h13a1.6 1.6 0 0 0 1.6-1.6v-5.4c1.1-.7 1.8-1.8 1.8-3C21.9 7 18.2 4.8 12 4.8S2.1 7 2.1 9.5c0 1.2.7 2.3 1.8 3v5.4a1.6 1.6 0 0 0 1.6 1.6Z" stroke="#EDBF6B" stroke-width="1.7" stroke-linejoin="round"/>' +
          '<path d="M8 9.4l1.7 3M11.6 8.8l1.7 3M15.2 9.4l1.7 3" stroke="#EDBF6B" stroke-width="1.7" stroke-linecap="round"/></svg>';
        var img = new Image();
        img.onload = function () {
          try {
            var c = document.createElement("canvas"); c.width = 96; c.height = 96;
            c.getContext("2d").drawImage(img, 0, 0, 96, 96);
            resolve(c.toDataURL("image/png"));
          } catch (e) { resolve(null); }
        };
        img.onerror = function () { resolve(null); };
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        setTimeout(function () { resolve(null); }, 1500);
      } catch (e) { resolve(null); }
    });
  }

  async function exportReportToPdf(rangeKey, sales, recipes, extra) {
    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) { toast("PDF library didn't load. Check your internet connection and try again."); return; }

    var doc = new jsPDFCtor({ unit: "pt", format: "a4" });
    var F = { brand: "times", text: "helvetica" };
    var logo = null;
    var W = doc.internal.pageSize.getWidth();
    var H = doc.internal.pageSize.getHeight();
    var M = 54, CW = W - M * 2;

    // Palette taken straight from style.css
    var CREAM = [253, 248, 240], CRUST = [62, 39, 35], CINNAMON = [193, 102, 47], WHEAT_LINE = [220, 203, 174],
        MOCHA = [139, 115, 85], FIELD = [246, 239, 226], BUTTER = [237, 191, 107], BARK = [43, 26, 20],
        GOOD = [62, 107, 46], BAD = [156, 59, 30];
    var BODY_TOP = 80, BODY_BOTTOM = 62;

    function money(n) { return "PHP " + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function setC(c) { doc.setTextColor(c[0], c[1], c[2]); }
    function paintPage() { doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]); doc.rect(0, 0, W, H, "F"); }

    function ensure(y, need) { if (y + need > H - BODY_BOTTOM) { doc.addPage(); return BODY_TOP; } return y; }
    function sectionTitle(text, y) {
      y = ensure(y, 150);
      doc.setFont("times", "bold"); doc.setFontSize(13); setC(CRUST);
      doc.text(text, M, y);
      doc.setDrawColor(WHEAT_LINE[0], WHEAT_LINE[1], WHEAT_LINE[2]); doc.setLineWidth(0.8); doc.line(M, y + 8, W - M, y + 8);
      doc.setDrawColor(CINNAMON[0], CINNAMON[1], CINNAMON[2]); doc.setLineWidth(2.2); doc.line(M, y + 8, M + 40, y + 8);
      return y + 26;
    }
    var tableBase = {
      theme: "grid",
      headStyles: { fillColor: BARK, textColor: CREAM, fontStyle: "bold", fontSize: 8.5, cellPadding: { top: 8, bottom: 8, left: 8, right: 8 } },
      styles: { font: F.text, fontSize: 9, cellPadding: { top: 7, bottom: 7, left: 8, right: 8 }, textColor: CRUST, fillColor: [255, 255, 255], lineColor: MOCHA, lineWidth: 0.6 },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      margin: { left: M, right: M, top: BODY_TOP, bottom: BODY_BOTTOM }
    };
    function alignHead(d, right, center) {
      if (d.section === "head") {
        if (right.indexOf(d.column.index) !== -1) d.cell.styles.halign = "right";
        if (center.indexOf(d.column.index) !== -1) d.cell.styles.halign = "center";
      }
    }

    var rangeLabels = { today: "Today", "7days": "Last 7 Days", "30days": "Last 30 Days", all: "All Time" };
    var rangeLabel = rangeLabels[rangeKey] || "Today";
    var session = getSession();
    var now = new Date();
    var generatedAt = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) + ", " + now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    var preparedBy = session ? session.firstName + " (" + session.role + ")" : "Unknown";
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var refNo = "DRR-SPR-" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "-" + pad(now.getHours()) + pad(now.getMinutes());

    // ---- Header band: same dark wood bar + butter accent as the app header ----
    doc.setFillColor(BARK[0], BARK[1], BARK[2]); doc.rect(0, 0, W, 88, "F");
    doc.setFillColor(CINNAMON[0], CINNAMON[1], CINNAMON[2]); doc.rect(0, 88, W, 3, "F");
    var textX = M;
    if (logo) { doc.addImage(logo, "PNG", M, 30, 30, 30); textX = M + 40; }
    doc.setFont("times", "bold"); doc.setFontSize(26); setC(CREAM);
    doc.text("DRR BAKERY", textX, 52);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); setC(BUTTER);
    doc.text("FOOD COST & MENU PRICE SYSTEM", textX, 67, { charSpace: 1.4 });
    doc.setFont(F.text, "normal"); doc.setFontSize(8); doc.setTextColor(CREAM[0], CREAM[1], CREAM[2]);
    doc.text("Document Ref.", W - M, 38, { align: "right" });
    doc.setFont(F.text, "bold"); doc.setFontSize(10); setC(BUTTER);
    doc.text(refNo, W - M, 52, { align: "right" });
    doc.setFont(F.text, "normal"); doc.setFontSize(7.5); doc.setTextColor(CREAM[0], CREAM[1], CREAM[2]);
    doc.text("CONFIDENTIAL — FOR INTERNAL USE", W - M, 67, { align: "right", charSpace: 0.6 });

    // ---- Title ----
    var y = 142;
    doc.setFont("times", "bold"); doc.setFontSize(24); setC(CRUST);
    doc.text("Sales & Profitability Report", M, y);
    y += 24;

    // ---- Report details ----
    doc.setDrawColor(WHEAT_LINE[0], WHEAT_LINE[1], WHEAT_LINE[2]); doc.setLineWidth(0.7);
    doc.rect(M, y, CW, 56);
    var cells = [["REPORT PERIOD", rangeLabel], ["DATE ISSUED", generatedAt], ["PREPARED BY", preparedBy]];
    var colW = CW / 3;
    cells.forEach(function (c, i) {
      var x = M + 14 + i * colW;
      if (i > 0) { doc.setDrawColor(WHEAT_LINE[0], WHEAT_LINE[1], WHEAT_LINE[2]); doc.line(M + i * colW, y + 10, M + i * colW, y + 46); }
      doc.setFont(F.text, "bold"); doc.setFontSize(7); setC(MOCHA);
      doc.text(c[0], x, y + 21, { charSpace: 0.9 });
      doc.setFont(F.text, "normal"); doc.setFontSize(9.5); setC(CRUST);
      doc.text(doc.splitTextToSize(c[1], colW - 26), x, y + 37);
    });
    y += 56 + 34;

    // ---- Figures ----
    var totalSales = sales.reduce(function (s, x) { return s + x.total_amount; }, 0);
    var totalCost = sales.reduce(function (s, x) { return s + x.food_cost; }, 0);
    var gross = totalSales - totalCost;
    var grossPct = totalSales > 0 ? (gross / totalSales) * 100 : 0;
    var units = sales.reduce(function (s, x) { return s + x.quantity; }, 0);

    var byItem = {}, detail = {};
    sales.forEach(function (s) {
      var n = s.recipes ? s.recipes.name : "Unknown";
      byItem[n] = (byItem[n] || 0) + s.quantity;
      var d = detail[n] || (detail[n] = { qty: 0, rev: 0, cost: 0 });
      d.qty += s.quantity; d.rev += s.total_amount; d.cost += s.food_cost;
    });
    var names = Object.keys(byItem).sort(function (a, b) { return byItem[b] - byItem[a]; });
    var bestText = names.length ? names[0] + " — " + byItem[names[0]] + " pcs sold" : "No sales in this period";
    var lowText = names.length ? names[names.length - 1] + " — " + byItem[names[names.length - 1]] + " pcs sold" : "No sales in this period";

    // ---- Drawing helpers for the charts (same look & colours as the analytics page) ----
    var C_SALES = [193, 102, 47], C_COST = [40, 120, 168], WHITE = [255, 255, 255];
    var PIE = [[193, 102, 47], [40, 120, 168], [62, 107, 46], [237, 191, 107], [122, 78, 45], [156, 59, 30]];
    function fillC(c) { doc.setFillColor(c[0], c[1], c[2]); }
    function drawC(c) { doc.setDrawColor(c[0], c[1], c[2]); }
    function fitText(t, maxW) {
      t = String(t);
      if (doc.getTextWidth(t) <= maxW) return t;
      while (t.length > 1 && doc.getTextWidth(t + "...") > maxW) t = t.slice(0, -1);
      return t + "...";
    }
    function axisLabel(n) {
      if (!n) return "0";
      if (n >= 1000000) return +(n / 1000000).toFixed(1) + "M";
      if (n >= 1000) return +(n / 1000).toFixed(1) + "K";
      return String(n);
    }
    // White card with a title (left) and a small caption (right). Returns nothing; caller draws inside.
    function chartCard(x, y, w, h, title, sub) {
      fillC(WHITE); drawC(WHEAT_LINE); doc.setLineWidth(0.7); doc.rect(x, y, w, h, "FD");
      fillC(CINNAMON); doc.rect(x, y, 3, h, "F");
      doc.setFont(F.text, "bold"); doc.setFontSize(10); setC(CRUST);
      doc.text(title, x + 16, y + 20);
      if (sub) { doc.setFont(F.text, "italic"); doc.setFontSize(8); setC(MOCHA); doc.text(sub, x + w - 14, y + 20, { align: "right" }); }
    }
    function legendItem(x, y, color, text) {
      fillC(color); doc.rect(x, y - 6, 8, 8, "F");
      doc.setFont(F.text, "normal"); doc.setFontSize(8); setC(CRUST); doc.text(text, x + 13, y + 1);
      return x + 13 + doc.getTextWidth(text) + 16;
    }

    // Sales vs Production Cost — grouped columns, one pair per period
    function drawTrendChart(y, trend) {
      var h = 236;
      y = ensure(y, h + 10);
      chartCard(M, y, CW, h, "Sales vs Production Cost (" + trend.title + ")", trend.sub + "  |  amounts in PHP");
      var lx = legendItem(M + 16, y + 38, C_SALES, "Sales"); legendItem(lx, y + 38, C_COST, "Production cost");
      var L = M + 62, R = M + CW - 18, T = y + 54, B = y + h - 30, pw = R - L, ph = B - T;
      var data = trend.buckets;
      var top = Math.max.apply(null, data.map(function (d) { return Math.max(d.sales, d.cost); }));
      var floors = { daily: 2000, weekly: 8000, monthly: 20000, yearly: 40000 };
      var sc = axisScale(top, floors[trend.mode] || 4000, 4, trend.mode === "daily" ? 2 : 3);
      doc.setFontSize(8); doc.setFont(F.text, "normal");
      for (var t = 0; t <= 4; t++) {
        var gy = B - ph * t / 4;
        drawC(WHEAT_LINE); doc.setLineWidth(t === 0 ? 0.9 : 0.4);
        if (t) doc.setLineDashPattern([2, 3], 0);
        doc.line(L, gy, R, gy); doc.setLineDashPattern([], 0);
        setC(MOCHA); doc.text(axisLabel(sc.step * t), L - 8, gy + 3, { align: "right" });
      }
      var gw = pw / data.length, bw = Math.max(4, Math.min(20, gw * 0.3));
      data.forEach(function (d, i) {
        var cx = L + gw * i + gw / 2;
        var hs = d.sales > 0 ? Math.max(1.5, ph * d.sales / sc.max) : 0, hc = d.cost > 0 ? Math.max(1.5, ph * d.cost / sc.max) : 0;
        if (hs) { fillC(C_SALES); doc.rect(cx - bw - 0.5, B - hs, bw, hs, "F"); }
        if (hc) { fillC(C_COST); doc.rect(cx + 0.5, B - hc, bw, hc, "F"); }
        doc.setFont(F.text, "normal"); doc.setFontSize(7.5); setC(MOCHA);
        doc.text(fitText(d.label, gw + 2), cx, B + 13, { align: "center" });
      });
      return y + h + 10;
    }

    // Profit Margin by Bread — horizontal bars with the 50% "High Profit" mark
    function drawMarginChart(y, list) {
      var rowH = 17, h = 66 + list.length * rowH;
      y = ensure(y, h + 10);
      chartCard(M, y, CW, h, "Profit Margin by Bread", "Dashed line = 50% High Profit mark");
      var lx = legendItem(M + 16, y + 38, GOOD, "High Profit (50% and above)"); legendItem(lx, y + 38, BAD, "Low Profit (below 50%)");
      var L = M + 118, R = M + CW - 58, T = y + 52, pw = R - L;
      var rx = L + pw * 0.5, bot = T + list.length * rowH;
      drawC(MOCHA); doc.setLineWidth(0.9); doc.setLineDashPattern([3, 3], 0); doc.line(rx, T - 2, rx, bot); doc.setLineDashPattern([], 0);
      list.forEach(function (r, i) {
        var ry = T + i * rowH, high = r.margin >= 50;
        doc.setFont(F.text, "normal"); doc.setFontSize(8.5); setC(CRUST);
        doc.text(fitText(r.name, 100), L - 8, ry + 10, { align: "right" });
        var bw = pw * Math.max(0, Math.min(r.margin, 100)) / 100;
        fillC(high ? GOOD : BAD); if (bw > 0) doc.rect(L, ry + 2.5, bw, rowH - 7, "F");
        doc.setFont(F.text, "bold"); doc.setFontSize(8.5); setC(CRUST);
        doc.text(pct2(r.margin), L + bw + 6, ry + 10);
      });
      doc.setFont(F.text, "normal"); doc.setFontSize(8); setC(MOCHA); doc.text("50%", rx, bot + 12, { align: "center" });
      return y + h + 10;
    }

    // Pie of the top / bottom five breads by pieces sold (same colours as the page)
    function drawPie(x, y, w, h, title, list, qtyOf) {
      chartCard(x, y, w, h, title, "Pieces sold");
      var total = list.reduce(function (s, n) { return s + qtyOf(n); }, 0);
      if (!total) { doc.setFont(F.text, "italic"); doc.setFontSize(9); setC(MOCHA); doc.text("No sales in this range yet.", x + w / 2, y + h / 2 + 6, { align: "center" }); return; }
      var cx = x + w / 2, cy = y + 34 + 42, R = 38, ang = -Math.PI / 2;
      var shown = list.filter(function (n) { return qtyOf(n) > 0; });
      shown.forEach(function (n, i) {
        var col = PIE[i % PIE.length], frac = qtyOf(n) / total;
        fillC(col);
        if (shown.length === 1) { doc.circle(cx, cy, R, "F"); return; }
        var a2 = ang + frac * Math.PI * 2, steps = Math.max(2, Math.ceil(frac * 60)), pts = [[R * Math.cos(ang), R * Math.sin(ang)]];
        for (var s = 1; s <= steps; s++) { var a = ang + (a2 - ang) * s / steps; pts.push([R * Math.cos(a), R * Math.sin(a)]); }
        var segs = [], prev = [0, 0];
        pts.forEach(function (p) { segs.push([p[0] - prev[0], p[1] - prev[1]]); prev = p; });
        drawC(WHITE); doc.setLineWidth(1.4);
        doc.lines(segs, cx, cy, [1, 1], "FD", true);
        ang = a2;
      });
      var ly = cy + R + 18;
      shown.forEach(function (n, i) {
        fillC(PIE[i % PIE.length]); doc.rect(x + 16, ly - 6, 8, 8, "F");
        doc.setFont(F.text, "normal"); doc.setFontSize(8.5); setC(CRUST); doc.text(fitText(n, w - 130), x + 29, ly + 1);
        doc.setFont(F.text, "bold"); doc.text(qtyOf(n).toLocaleString("en-US") + " pcs  |  " + Math.round(qtyOf(n) / total * 100) + "%", x + w - 14, ly + 1, { align: "right" });
        ly += 12.5;
      });
    }

    // ---- 1. Executive summary ----
    y = sectionTitle("1.  Executive Summary", y);
    var summaryText = sales.length
      ? "For the reporting period (" + rangeLabel.toLowerCase() + "), DRR Bakery recorded " + sales.length + " sales transaction" + (sales.length === 1 ? "" : "s") +
        " totalling " + units.toLocaleString("en-US") + " pieces sold. Total sales amounted to " + money(totalSales) + " against a production cost of " + money(totalCost) +
        ", resulting in a gross profit of " + money(gross) + " (" + pct2(grossPct) + " gross margin)."
      : "No sales were recorded for the reporting period (" + rangeLabel.toLowerCase() + "). Figures below reflect zero activity.";
    doc.setFont("times", "normal"); doc.setFontSize(10.5); setC(CRUST);
    var lines = doc.splitTextToSize(summaryText, CW);
    doc.text(lines, M, y, { lineHeightFactor: 1.45 });
    y += lines.length * 15 + 18;

    // ---- 2. Financial summary: the four tiles from the top of the analytics page ----
    y = sectionTitle("2.  Financial Summary", y);
    var tiles = [["Total Sales", totalSales, C_SALES], ["Total Production Cost", totalCost, C_COST], ["Gross Profit", gross, GOOD], ["Net Profit", gross, GOOD]];
    var gap = 10, tw = (CW - gap * 3) / 4;
    tiles.forEach(function (t, i) {
      var tx = M + i * (tw + gap);
      fillC(WHITE); drawC(WHEAT_LINE); doc.setLineWidth(0.7); doc.rect(tx, y, tw, 58, "FD");
      fillC(t[2]); doc.rect(tx, y, tw, 3.5, "F");
      doc.setFont(F.text, "bold"); doc.setFontSize(7); setC(MOCHA); doc.text(t[0].toUpperCase(), tx + 10, y + 20, { charSpace: 0.3 });
      doc.setFont(F.text, "bold"); doc.setFontSize(11.5); setC(CRUST); doc.text(fitText(money(t[1]), tw - 16), tx + 10, y + 42);
    });
    y += 58 + 30;

    // ---- 3. Sales charts ----
    y = sectionTitle("3.  Sales Charts", y);
    var trend = extra && extra.trend;
    if (trend && trend.buckets && trend.buckets.some(function (d) { return d.sales > 0 || d.cost > 0; })) {
      y = drawTrendChart(y, trend);
      y = ensure(y, 40 + (trend.buckets.length + 1) * 17);
      doc.autoTable(Object.assign({}, tableBase, {
        startY: y,
        head: [[trend.mode === "yearly" ? "Year" : (trend.mode === "monthly" ? "Month" : (trend.mode === "weekly" ? "Week" : "Date")), "Pieces Sold", "Sales", "Production Cost", "Profit"]],
        body: trend.buckets.map(function (b) { return [b.full, b.pcs.toLocaleString("en-US"), money(b.sales), money(b.cost), money(b.sales - b.cost)]; }),
        styles: Object.assign({}, tableBase.styles, { fontSize: 8, cellPadding: { top: 4, bottom: 4, left: 8, right: 8 } }),
        headStyles: Object.assign({}, tableBase.headStyles, { fontSize: 8, cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } }),
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
        didParseCell: function (d) { alignHead(d, [1, 2, 3, 4], []); }
      }));
      y = doc.lastAutoTable.finalY + 16;
    } else {
      y = ensure(y, 40);
      doc.setFont(F.text, "italic"); doc.setFontSize(10); setC(MOCHA);
      doc.text("No sales recorded in the chart period yet.", M, y); y += 26;
    }

    var marginRows = recipes.filter(function (r) { return r.selling_price > 0; }).map(function (r) {
      var profit = r.selling_price - r.cost_per_piece;
      return { name: r.name, margin: (profit / r.selling_price) * 100 };
    }).sort(function (a, b) { return b.margin - a.margin; });
    if (marginRows.length) y = drawMarginChart(y, marginRows);
    y += 14;

    // ---- 4. Best / lowest selling bread (pies, side by side like the page) ----
    y = sectionTitle("4.  Best Selling / Lowest Selling Bread", y);
    var allQty = {};
    recipes.forEach(function (r) { allQty[r.name] = 0; });
    names.forEach(function (n) { allQty[n] = byItem[n]; });
    var ranked = Object.keys(allQty).sort(function (a, b) { return allQty[b] - allQty[a]; });
    var pieH = 200, pieW = (CW - 14) / 2;
    y = ensure(y, pieH + 10);
    var qtyOf = function (n) { return allQty[n] || 0; };
    drawPie(M, y, pieW, pieH, "Best Selling Bread", sales.length ? ranked.slice(0, 5) : [], qtyOf);
    drawPie(M + pieW + 14, y, pieW, pieH, "Lowest Selling Bread", sales.length ? ranked.slice().reverse().slice(0, 5) : [], qtyOf);
    y += pieH + 24;

    // ---- 5. Profitability ranking ----
    var rows = recipes.map(function (r) {
      var profit = (r.selling_price || 0) - r.cost_per_piece;
      var mg = r.selling_price ? (profit / r.selling_price) * 100 : 0;
      return { name: r.name, cost: r.cost_per_piece, price: r.selling_price || 0, profit: profit, margin: mg };
    }).sort(function (a, b) { return b.margin - a.margin; });

    y = sectionTitle("5.  Bread Profitability Ranking", y);
    doc.autoTable(Object.assign({}, tableBase, {
      startY: y,
      head: [["No.", "Bread Name", "Unit Cost", "Selling Price", "Profit", "Margin", "Status"]],
      body: rows.map(function (r, i) {
        return [i + 1, r.name + (i < 5 ? "  (Top 5)" : ""), money(r.cost), money(r.price), money(r.profit), pct2(r.margin), r.margin >= 50 ? "High Profit" : "Low Profit"];
      }),
      columnStyles: { 0: { cellWidth: 32, halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "center", fontStyle: "bold" } },
      didParseCell: function (d) {
        alignHead(d, [2, 3, 4, 5], [0, 6]);
        if (d.section === "body" && d.row.index < 5) { d.cell.styles.fillColor = [250, 233, 196]; if (d.column.index === 1) d.cell.styles.fontStyle = "bold"; }
        if (d.section === "body" && d.column.index === 6) d.cell.styles.textColor = d.cell.raw === "High Profit" ? GOOD : BAD;
      }
    }));
    y = doc.lastAutoTable.finalY;
    if (!rows.length) {
      doc.setFont(F.text, "normal"); doc.setFontSize(10); setC(MOCHA);
      doc.text("No recipes available.", M, y + 18); y += 24;
    }
    y += 30;

    // ---- 6. Bread sales: every bread, best seller first, with a coloured Total row ----
    y = sectionTitle("6.  Bread Sales", y);
    var soldBy = {};
    sales.forEach(function (x) {
      var t = soldBy[x.recipe_id] || (soldBy[x.recipe_id] = { qty: 0, amount: 0, cost: 0, profit: 0 });
      var amount = Number(x.total_amount) || 0, cost = Number(x.food_cost) || 0;
      t.qty += Number(x.quantity) || 0; t.amount += amount; t.cost += cost;
      t.profit += x.gross_profit != null ? Number(x.gross_profit) : amount - cost;
    });
    var salesRows = recipes.map(function (r) {
      var t = soldBy[r.id] || { qty: 0, amount: 0, cost: 0, profit: 0 };
      return { name: r.name, qty: t.qty, amount: t.amount, cost: t.cost, profit: t.profit };
    }).sort(function (a, b) { return b.qty - a.qty || b.amount - a.amount || a.name.localeCompare(b.name); });
    var tot = { qty: 0, amount: 0, cost: 0, profit: 0 };
    salesRows.forEach(function (r) { tot.qty += r.qty; tot.amount += r.amount; tot.cost += r.cost; tot.profit += r.profit; });
    var salesBody = salesRows.map(function (r, i) { return [i + 1, r.name, r.qty + " pcs", money(r.amount), money(r.cost), money(r.profit)]; });
    salesBody.push(["", "Total", tot.qty + " pcs", money(tot.amount), money(tot.cost), money(tot.profit)]);
    doc.autoTable(Object.assign({}, tableBase, {
      startY: y,
      head: [["No.", "Bread Name", "Pieces Sold", "Total Sales", "Food Cost", "Profit"]],
      body: salesBody,
      columnStyles: { 0: { cellWidth: 32, halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      didParseCell: function (d) {
        alignHead(d, [2, 3, 4, 5], [0]);
        if (d.section === "body" && d.row.index === salesBody.length - 1) {
          d.cell.styles.fontStyle = "bold"; d.cell.styles.fontSize = 10; d.cell.styles.textColor = CRUST; d.cell.styles.fillColor = [250, 233, 196];
          if (d.column.index === 3) d.cell.styles.textColor = [165, 81, 31];
          if (d.column.index === 4) d.cell.styles.textColor = [30, 95, 135];
          if (d.column.index === 5) d.cell.styles.textColor = GOOD;
        }
      }
    }));
    y = doc.lastAutoTable.finalY;
    if (!salesRows.length) {
      doc.setFont(F.text, "normal"); doc.setFontSize(10); setC(MOCHA);
      doc.text("No recipes available.", M, y + 18); y += 24;
    }
    y += 30;

    // ---- 7. Pre-baking profit forecast (only when figures were entered on the page) ----
    var sec = 7;
    var fc = extra && extra.forecast;
    if (fc && fc.pcs > 0) {
      y = sectionTitle("7.  Pre-Baking Profit Forecast", y);
      doc.autoTable(Object.assign({}, tableBase, {
        startY: y,
        head: [["Bread Item", "Pieces to Bake", "Waste", "Expected Revenue", "Expected Food Cost", "Expected Gross Profit", "Expected Margin"]],
        body: [[fc.name, fc.pcs.toLocaleString("en-US"), fc.wastePct + "%", money(fc.revenue), money(fc.foodCost), money(fc.grossProfit), pct2(fc.margin)]],
        styles: Object.assign({}, tableBase.styles, { fontSize: 8.5 }),
        headStyles: Object.assign({}, tableBase.headStyles, { fontSize: 7.5 }),
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right", fontStyle: "bold", textColor: GOOD }, 6: { halign: "right" } },
        didParseCell: function (d) { alignHead(d, [1, 2, 3, 4, 5, 6], []); }
      }));
      y = doc.lastAutoTable.finalY;
      doc.setFont(F.text, "italic"); doc.setFontSize(8); setC(MOCHA);
      doc.text("This is a projection only. It is not counted as a real sale.", M, y + 14);
      y += 44; sec = 8;
    }

    // ---- Notes ----
    y = sectionTitle(sec + ".  Notes", y);
    var notes = [
      "All amounts are expressed in Philippine Pesos (PHP).",
      "Net profit is presented equal to gross profit; no operating expenses are deducted in this report.",
      "A bread item is classified as “High Profit” when its margin is 50% or higher, otherwise “Low Profit”."
    ];
    doc.setFont(F.text, "normal"); doc.setFontSize(9); setC(MOCHA);
    notes.forEach(function (n, i) {
      var l = doc.splitTextToSize((i + 1) + ".  " + n, CW - 14);
      y = ensure(y, l.length * 12 + 4);
      doc.text(l, M + 8, y, { lineHeightFactor: 1.35 });
      y += l.length * 12.5 + 3;
    });
    y += 14;

    // ---- Sign-off (needs only ~50pt, so it stays on the Notes page when there is room) ----
    y = ensure(y, 50);
    var sigW = (CW - 40) / 2;
    [["Prepared by", preparedBy], ["Reviewed / Approved by", ""]].forEach(function (sg, i) {
      var x = M + i * (sigW + 40);
      doc.setDrawColor(CRUST[0], CRUST[1], CRUST[2]); doc.setLineWidth(0.6); doc.line(x, y + 30, x + sigW, y + 30);
      doc.setFont(F.text, "bold"); doc.setFontSize(7.5); setC(MOCHA);
      doc.text(sg[0].toUpperCase(), x, y + 44, { charSpace: 0.7 });
      if (sg[1]) { doc.setFont(F.text, "normal"); doc.setFontSize(9.5); setC(CRUST); doc.text(sg[1], x, y + 22); }
    });

    // ---- Running header (pages 2+) and footer (all pages) ----
    var pageCount = doc.internal.getNumberOfPages();
    for (var p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      if (p > 1) {
        doc.setFillColor(BARK[0], BARK[1], BARK[2]); doc.rect(0, 0, W, 40, "F");
        doc.setFillColor(CINNAMON[0], CINNAMON[1], CINNAMON[2]); doc.rect(0, 40, W, 2, "F");
        doc.setFont("times", "bold"); doc.setFontSize(12); setC(CREAM);
        doc.text("DRR BAKERY", M, 26);
        doc.setFont(F.text, "normal"); doc.setFontSize(8); setC(BUTTER);
        doc.text("Sales & Profitability Report  |  " + rangeLabel + "  |  " + refNo, W - M, 25, { align: "right" });
      }
      doc.setDrawColor(WHEAT_LINE[0], WHEAT_LINE[1], WHEAT_LINE[2]); doc.setLineWidth(0.7); doc.line(M, H - 42, W - M, H - 42);
      doc.setFont(F.text, "normal"); doc.setFontSize(7.5); setC(MOCHA);
      doc.text("PROFIT PRO — DRR Bakery Food Cost & Menu Price System  |  Confidential — For internal use only", M, H - 28);
      doc.text("Page " + p + " of " + pageCount, W - M, H - 28, { align: "right" });
    }

    var fileDate = new Date().toISOString().slice(0, 10);
    doc.save("DRR-Bakery-Report-" + fileDate + ".pdf");
  }

  /* =======================================================================
     Analytics page (analytics.html)
     ======================================================================= */

  async function initAnalyticsPage() {
    var el = document.getElementById("stat-total-sales");
    if (!el) return;

    var rangeSelect = document.getElementById("analytics-date-range");
    var headingEl = document.getElementById("analytics-heading");
    var headingByRange = { today: "Today's Sale", "7days": "Last 7 Days", "30days": "Last 30 Days", all: "All-Time Sales" };

    var recipes = await fetchRecipes();

    async function renderTotals(sales) {
      var totalSales = sales.reduce(function (s, x) { return s + x.total_amount; }, 0);
      var totalCost = sales.reduce(function (s, x) { return s + x.food_cost; }, 0);
      var gross = totalSales - totalCost;
      document.getElementById("stat-total-sales").textContent = peso(totalSales);
      document.getElementById("stat-total-cost").textContent = peso(totalCost);
      document.getElementById("stat-gross-profit").textContent = peso(gross);
      document.getElementById("stat-net-profit").textContent = peso(gross);
    }

    // Every bread, ranked by profit margin per piece.
    function renderRanking() {
      var tbody = document.getElementById("ranking-body");
      tbody.innerHTML = "";
      if (!recipes.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-note">No recipes yet.</td></tr>';
        return;
      }
      var rows = recipes.map(function (r) {
        var profit = (r.selling_price || 0) - r.cost_per_piece;
        var margin = r.selling_price ? (profit / r.selling_price) * 100 : 0;
        return { name: r.name, cost: r.cost_per_piece, price: r.selling_price || 0, profit: profit, margin: margin };
      }).sort(function (a, b) { return b.margin - a.margin; });

      rows.forEach(function (r, i) {
        var tr = document.createElement("tr");
        if (i < 5) tr.className = "top-five";
        var status = r.margin >= 50 ? '<span class="status-text good">High Profit</span>' : '<span class="status-text bad">Low Profit</span>';
        tr.innerHTML =
          "<td>" + (i + 1) + "</td><td>" + r.name + (i < 5 ? ' <span class="top-badge">Top 5</span>' : "") + "</td>" +
          "<td>" + peso(r.cost) + "</td><td>" + peso(r.price) + "</td>" +
          "<td>" + peso(r.profit) + "</td><td>" + pct2(r.margin) + "</td><td>" + status + "</td>";
        tbody.appendChild(tr);
      });
    }

    // Separate table: what each bread actually sold in the chosen date range.
    // Every bread is listed (0 if it had no sales), best seller first.
    function renderBreadSales(sales) {
      var tbody = document.getElementById("bread-sales-body");
      if (!tbody) return;
      tbody.innerHTML = "";
      if (!recipes.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-note">No recipes yet.</td></tr>';
        return;
      }
      var sold = {};
      (sales || []).forEach(function (x) {
        var t = sold[x.recipe_id] || (sold[x.recipe_id] = { qty: 0, amount: 0, cost: 0, profit: 0 });
        var amount = Number(x.total_amount) || 0, cost = Number(x.food_cost) || 0;
        t.qty += Number(x.quantity) || 0;
        t.amount += amount;
        t.cost += cost;
        t.profit += x.gross_profit != null ? Number(x.gross_profit) : amount - cost;
      });
      var rows = recipes.map(function (r) {
        var t = sold[r.id] || { qty: 0, amount: 0, cost: 0, profit: 0 };
        return { name: r.name, qty: t.qty, amount: t.amount, cost: t.cost, profit: t.profit };
      }).sort(function (a, b) { return b.qty - a.qty || b.amount - a.amount || a.name.localeCompare(b.name); });

      var total = { qty: 0, amount: 0, cost: 0, profit: 0 };
      rows.forEach(function (r, i) {
        total.qty += r.qty; total.amount += r.amount; total.cost += r.cost; total.profit += r.profit;
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + (i + 1) + "</td><td>" + r.name + "</td><td>" + r.qty + " pcs</td>" +
          "<td>" + peso(r.amount) + "</td><td>" + peso(r.cost) + "</td><td>" + peso(r.profit) + "</td>";
        tbody.appendChild(tr);
      });
      var totalRow = document.createElement("tr");
      totalRow.className = "total-row";
      totalRow.innerHTML =
        "<td></td><td><strong>Total</strong></td><td><strong>" + total.qty + " pcs</strong></td>" +
        "<td><strong>" + peso(total.amount) + "</strong></td><td><strong>" + peso(total.cost) + "</strong></td><td><strong>" + peso(total.profit) + "</strong></td>";
      tbody.appendChild(totalRow);
    }


    /* ---- Charts (inline SVG, brand colours) ---- */
    var C_SALES = "#C1662F", C_COST = "#2878A8", C_GOOD = "#3E6B2E", C_BAD = "#9C3B1E";
    var C_INK = "#3E2723", C_MUTED = "#8B7355", C_GRID = "#DCCBAE";
    var tipEl = document.getElementById("chart-tip");

    function niceMax(v) {
      if (v <= 0) return 1;
      var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
      var f = v / p;
      var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
      return n * p;
    }
    function svgEsc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    // Bar with rounded top corners (4px), flat on the baseline.
    function barPath(x, y, w, h, r) {
      if (h <= 0) return "";
      r = Math.min(r, w / 2, h);
      return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z";
    }
    function hBarPath(x, y, w, h, r) {
      if (w <= 0) return "";
      r = Math.min(r, h / 2, w);
      return "M" + x + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h - r) + "Q" + (x + w) + "," + (y + h) + " " + (x + w - r) + "," + (y + h) + "H" + x + "Z";
    }
    function showTip(e, html) {
      if (!tipEl) return;
      tipEl.innerHTML = html;
      tipEl.classList.add("is-visible");
      var x = e.clientX + 14, y = e.clientY + 14;
      var w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
      if (y + hgt > window.innerHeight - 8) y = e.clientY - hgt - 14;
      tipEl.style.left = x + "px"; tipEl.style.top = y + "px";
    }
    function hideTip() { if (tipEl) tipEl.classList.remove("is-visible"); }
    function wireTips(container) {
      container.querySelectorAll("[data-tip]").forEach(function (g) {
        g.addEventListener("mousemove", function (e) { showTip(e, g.getAttribute("data-tip")); });
        g.addEventListener("mouseleave", hideTip);
        g.addEventListener("focus", function () {
          var r = g.getBoundingClientRect();
          showTip({ clientX: r.left + r.width / 2, clientY: r.top }, g.getAttribute("data-tip"));
        });
        g.addEventListener("blur", hideTip);
      });
    }
    function emptyChart(el, msg) { el.innerHTML = '<p class="chart-empty">' + msg + '</p>'; }

    /* Sales vs cost chart: has its own range (Daily / Weekly / Monthly / Yearly),
       independent of the date filter at the top of the page. */
    var trendMode = "monthly";
    var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    function trendBuckets(mode) {
      var now = new Date(), list = [], i, d;
      if (mode === "daily") {
        for (i = 6; i >= 0; i--) {
          d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          list.push({ start: d, end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), label: MONTHS[d.getMonth()] + " " + d.getDate(),
                      full: d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" }) });
        }
      } else if (mode === "weekly") {
        var dow = (now.getDay() + 6) % 7; // Monday = 0
        var thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
        for (i = 7; i >= 0; i--) {
          d = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - i * 7);
          var e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
          var last = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 1);
          list.push({ start: d, end: e, label: MONTHS[d.getMonth()] + " " + d.getDate(),
                      full: "Week of " + MONTHS[d.getMonth()] + " " + d.getDate() + " – " + MONTHS[last.getMonth()] + " " + last.getDate() });
        }
      } else if (mode === "yearly") {
        for (i = 4; i >= 0; i--) {
          var y = now.getFullYear() - i;
          list.push({ start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), label: String(y), full: String(y) });
        }
      } else { // monthly: the last 12 months, oldest to newest
        for (i = 11; i >= 0; i--) {
          d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          var showYear = i === 11 || d.getMonth() === 0;
          list.push({ start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
                      label: MONTHS[d.getMonth()] + (showYear ? " '" + String(d.getFullYear()).slice(2) : ""),
                      full: MONTHS_LONG[d.getMonth()] + " " + d.getFullYear() });
        }
      }
      list.forEach(function (b) { b.sales = 0; b.cost = 0; b.pcs = 0; });
      return list;
    }

    async function fetchSalesBetween(startDate) {
      var rows = [], from = 0, page = 1000;
      for (var n = 0; n < 30; n++) {
        var res = await supabaseClient.from("sales").select("total_amount, food_cost, quantity, sale_datetime")
          .gte("sale_datetime", startDate.toISOString()).order("sale_datetime", { ascending: true }).range(from, from + page - 1);
        if (res.error || !res.data) break;
        rows = rows.concat(res.data);
        if (res.data.length < page) break;
        from += page;
      }
      return rows;
    }

    var trendLoadId = 0, lastTrend = null;
    async function loadTrendChart(mode) {
      var el = document.getElementById("chart-trend");
      if (!el) return;
      trendMode = mode;
      var myLoad = ++trendLoadId;
      document.querySelectorAll("#chart-trend-tabs button").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-mode") === mode);
      });
      var titles = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };
      var subs = { daily: "Last 7 days", weekly: "Last 8 weeks (weeks start Monday)", monthly: "Last 12 months", yearly: "Last 5 years" };
      var titleEl = document.getElementById("chart-trend-title");
      if (titleEl) titleEl.textContent = "Sales vs Production Cost (" + titles[mode] + ")";
      var subEl = document.getElementById("chart-trend-sub");
      if (subEl) subEl.textContent = subs[mode];

      var buckets = trendBuckets(mode);
      var rows;
      try { rows = await fetchSalesBetween(buckets[0].start); }
      catch (err) { if (myLoad === trendLoadId) emptyChart(el, "Couldn't load the chart. Try again."); return; }
      if (myLoad !== trendLoadId) return; // a newer click superseded this one
      rows.forEach(function (s) {
        var d = new Date(s.sale_datetime);
        if (isNaN(d)) return;
        for (var i = 0; i < buckets.length; i++) {
          if (d >= buckets[i].start && d < buckets[i].end) {
            buckets[i].sales += s.total_amount; buckets[i].cost += s.food_cost; buckets[i].pcs += s.quantity;
            break;
          }
        }
      });
      lastTrend = { mode: mode, title: titles[mode], sub: subs[mode], buckets: buckets };
      renderTrendChart(buckets);
    }

    function renderTrendChart(data) {
      var el = document.getElementById("chart-trend");
      if (!el) return;
      var any = data.some(function (d) { return d.sales > 0 || d.cost > 0; });
      if (!any) { emptyChart(el, "No sales recorded in this period yet."); return; }

      var W = 520, H = 250, L = 56, R = 10, T = 12, B = 32;
      var pw = W - L - R, ph = H - T - B;
      var top = Math.max.apply(null, data.map(function (d) { return Math.max(d.sales, d.cost); }));
      // Axis in thousands (₱1K, ₱2K ...). The starting scale is higher for longer ranges
      // and always grows if the sales are bigger than that.
      var floors = { daily: 2000, weekly: 8000, monthly: 20000, yearly: 40000 };
      var sc = axisScale(top, floors[trendMode] || 4000, 4, trendMode === "daily" ? 2 : 3);
      var step = sc.step, max = sc.max;
      var gw = pw / data.length;
      var bw = Math.max(4, Math.min(26, gw * 0.3));
      var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Sales versus production cost">';
      for (var t = 0; t <= 4; t++) {
        var gy = T + ph - (ph * t / 4);
        out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" stroke="' + C_GRID + '" stroke-width="1"' + (t === 0 ? '' : ' stroke-dasharray="2 4"') + '/>';
        out += '<text x="' + (L - 8) + '" y="' + (gy + 4) + '" text-anchor="end" fill="' + C_MUTED + '" font-size="11">' + fmtAxisPeso(step * t) + '</text>';
      }
      data.forEach(function (d, i) {
        var cx = L + gw * i + gw / 2;
        var hs = d.sales > 0 ? Math.max(3, ph * d.sales / max) : 0, hc = d.cost > 0 ? Math.max(3, ph * d.cost / max) : 0;
        var tip = '<strong>' + svgEsc(d.full) + '</strong><br><i class="chart-swatch" style="background:' + C_SALES + '"></i>Sales ' + peso(d.sales) + '<br><i class="chart-swatch" style="background:' + C_COST + '"></i>Cost ' + peso(d.cost) + '<br>Profit ' + peso(d.sales - d.cost) + '<br>' + d.pcs.toLocaleString("en-US") + ' pcs sold';
        out += '<g data-tip="' + svgEsc(tip) + '" tabindex="0">';
        out += '<rect x="' + (cx - gw / 2) + '" y="' + T + '" width="' + gw + '" height="' + ph + '" fill="transparent"/>';
        out += '<path d="' + barPath(cx - bw - 1, T + ph - hs, bw, hs, 4) + '" fill="' + C_SALES + '"/>';
        out += '<path d="' + barPath(cx + 1, T + ph - hc, bw, hc, 4) + '" fill="' + C_COST + '"/>';
        out += '</g>';
        out += '<text x="' + cx + '" y="' + (H - 12) + '" text-anchor="middle" fill="' + C_MUTED + '" font-size="11">' + svgEsc(d.label) + '</text>';
      });
      out += '</svg>';
      el.innerHTML = out;
      wireTips(el);
    }

    document.querySelectorAll("#chart-trend-tabs button").forEach(function (b) {
      b.addEventListener("click", function () { loadTrendChart(b.getAttribute("data-mode")); });
    });

    function renderHBars(el, rows, opts) {
      // rows: [{label, value, color, tip, valueLabel}]
      var rowH = 34, L = 118, R = 64, T = 8, W = 420;
      var H = T + rows.length * rowH + 24;
      var max = opts.max;
      var pw = W - L - R;
      var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + svgEsc(opts.label) + '">';
      rows.forEach(function (r, i) {
        var y = T + i * rowH;
        var w = Math.max(0, pw * Math.min(r.value, max) / max);
        var name = r.label.length > 16 ? r.label.slice(0, 15) + "…" : r.label;
        out += '<g data-tip="' + svgEsc(r.tip) + '" tabindex="0">';
        out += '<rect x="0" y="' + y + '" width="' + W + '" height="' + rowH + '" fill="transparent"/>';
        out += '<text x="' + (L - 10) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="end" fill="' + C_INK + '" font-size="12">' + svgEsc(name) + '</text>';
        out += '<path d="' + hBarPath(L, y + 7, w, rowH - 14, 4) + '" fill="' + r.color + '"/>';
        out += '<text x="' + (L + w + 8) + '" y="' + (y + rowH / 2 + 4) + '" fill="' + C_INK + '" font-size="12" font-weight="700">' + svgEsc(r.valueLabel) + '</text>';
        out += '</g>';
      });
      if (opts.refLine != null) {
        var rx = L + pw * opts.refLine / max;
        out += '<line x1="' + rx + '" x2="' + rx + '" y1="' + T + '" y2="' + (T + rows.length * rowH) + '" stroke="' + C_MUTED + '" stroke-width="1.5" stroke-dasharray="4 4"/>';
        out += '<text x="' + rx + '" y="' + (T + rows.length * rowH + 16) + '" text-anchor="middle" fill="' + C_MUTED + '" font-size="11">' + opts.refLabel + '</text>';
      }
      out += '</svg>';
      el.innerHTML = out;
      wireTips(el);
    }

    function breadTotals(sales) {
      var byItem = {};
      recipes.forEach(function (r) { byItem[r.name] = { qty: 0, rev: 0 }; });
      sales.forEach(function (s) {
        var n = s.recipes ? s.recipes.name : "Unknown";
        var d = byItem[n] || (byItem[n] = { qty: 0, rev: 0 });
        d.qty += s.quantity; d.rev += s.total_amount;
      });
      return byItem;
    }

    var PIE_COLORS = ["#C1662F", "#2878A8", "#3E6B2E", "#EDBF6B", "#7A4E2D", "#9C3B1E"];

    function renderPie(el, rows, label) {
      // rows: [{label, value, tip}]
      var total = rows.reduce(function (t, r) { return t + r.value; }, 0);
      if (!total) { emptyChart(el, "No sales in this range yet."); return; }
      var cx = 90, cy = 90, R = 80, ang = -Math.PI / 2;
      var out = '<div class="pie-wrap"><svg class="pie-svg" viewBox="0 0 180 180" role="img" aria-label="' + svgEsc(label) + '">';
      var shown = rows.filter(function (r) { return r.value > 0; });
      shown.forEach(function (r, i) {
        var frac = r.value / total, color = PIE_COLORS[i % PIE_COLORS.length];
        if (shown.length === 1) {
          out += '<g data-tip="' + svgEsc(r.tip) + '" tabindex="0"><circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="' + color + '" stroke="#fff" stroke-width="2"/></g>';
          return;
        }
        var a2 = ang + frac * Math.PI * 2;
        var x1 = cx + R * Math.cos(ang), y1 = cy + R * Math.sin(ang);
        var x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
        out += '<g data-tip="' + svgEsc(r.tip) + '" tabindex="0"><path d="M' + cx + ' ' + cy + ' L' + x1 + ' ' + y1 + ' A' + R + ' ' + R + ' 0 ' + (frac > 0.5 ? 1 : 0) + ' 1 ' + x2 + ' ' + y2 + ' Z" fill="' + color + '" stroke="#fff" stroke-width="2"/></g>';
        ang = a2;
      });
      out += '</svg><ul class="pie-legend">';
      shown.forEach(function (r, i) {
        out += '<li><i class="chart-swatch" style="background:' + PIE_COLORS[i % PIE_COLORS.length] + '"></i><span class="pie-name">' + svgEsc(r.label) + '</span><strong>' + r.value.toLocaleString("en-US") + ' pcs &middot; ' + Math.round(r.value / total * 100) + '%</strong></li>';
      });
      out += '</ul></div>';
      el.innerHTML = out;
      wireTips(el);
    }

    function drawSalesRank(elId, sales, lowest) {
      var el = document.getElementById(elId);
      if (!el) return;
      var byItem = breadTotals(sales);
      if (!sales.length) { emptyChart(el, "No sales in this range yet."); return; }
      var names = Object.keys(byItem).filter(function (n) { return !lowest || true; }).sort(function (a, b) {
        return lowest ? byItem[a].qty - byItem[b].qty : byItem[b].qty - byItem[a].qty;
      }).slice(0, 5);
      renderPie(el, names.map(function (n) {
        return { label: n, value: byItem[n].qty,
          tip: "<strong>" + svgEsc(n) + "</strong><br>" + byItem[n].qty + " pcs sold<br>Sales " + peso(byItem[n].rev) };
      }), (lowest ? "Lowest" : "Best") + " selling bread by pieces sold");
    }

    function renderMarginChart() {
      var el = document.getElementById("chart-margin");
      if (!el) return;
      var rows = recipes.filter(function (r) { return r.selling_price > 0; }).map(function (r) {
        var profit = r.selling_price - r.cost_per_piece;
        return { name: r.name, margin: (profit / r.selling_price) * 100, profit: profit, price: r.selling_price, cost: r.cost_per_piece };
      }).sort(function (a, b) { return b.margin - a.margin; });
      if (!rows.length) { emptyChart(el, "No recipes with a selling price yet."); return; }
      renderHBars(el, rows.map(function (r) {
        var high = r.margin >= 50;
        return { label: r.name, value: Math.max(0, r.margin), color: high ? C_GOOD : C_BAD, valueLabel: pct2(r.margin) + (high ? " ▲" : " ▼"),
          tip: "<strong>" + svgEsc(r.name) + "</strong><br>Margin " + pct2(r.margin) + " (" + (high ? "High Profit" : "Low Profit") + ")<br>Price " + peso(r.price) + " &middot; Cost " + peso(r.cost) + "<br>Profit " + peso(r.profit) + " per pc" };
      }), { max: 100, refLine: 50, refLabel: "50%", label: "Profit margin by bread" });
    }

    function renderCharts(sales, rangeKey) {
      drawSalesRank("chart-best", sales, false);
      drawSalesRank("chart-lowest", sales, true);
    }

    async function refreshForRange(rangeKey) {
      headingEl.textContent = headingByRange[rangeKey] || "Sales";
      var sales = await fetchSales(rangeKey);
      await renderTotals(sales);
      renderBreadSales(sales);
      renderCharts(sales, rangeKey);
    }

    rangeSelect.addEventListener("change", function () { refreshForRange(rangeSelect.value); });

    /* ---- Pre-Baking Profit Forecast (hypothetical, kept OUT of real sales) ---- */

    function populateBreadItemSelect() {
      var select = document.getElementById("forecast-bread-item");
      select.innerHTML = "";
      if (!recipes.length) {
        select.innerHTML = '<option value="">No recipes yet</option>';
        return;
      }
      recipes.forEach(function (r) {
        var opt = document.createElement("option");
        opt.value = r.id;
        opt.dataset.price = r.selling_price;
        opt.dataset.cost = r.cost_per_piece;
        opt.textContent = r.name;
        select.appendChild(opt);
      });
      document.getElementById("forecast-price").value = recipes[0].selling_price;
    }

    document.getElementById("forecast-bread-item").addEventListener("change", function () {
      var opt = this.options[this.selectedIndex];
      document.getElementById("forecast-price").value = opt.dataset.price || 0;
      recomputeForecast();
    });

    function recomputeForecast() {
      var select = document.getElementById("forecast-bread-item");
      var opt = select.options[select.selectedIndex];
      var pcs = parseFloat(document.getElementById("forecast-pcs").value) || 0;
      var price = parseFloat(document.getElementById("forecast-price").value) || 0;
      var wastePct = parseFloat(document.getElementById("forecast-waste-pct").value) || 0;
      var wastePcs = Math.round(pcs * (wastePct / 100));
      document.getElementById("forecast-waste-pcs-label").textContent = wastePct + "% (" + wastePcs + "pcs)";

      var unitCost = opt && opt.dataset.cost ? parseFloat(opt.dataset.cost) : price * 0.4;
      var sellablePcs = Math.max(0, pcs - wastePcs);
      var revenue = sellablePcs * price;
      var foodCost = pcs * unitCost;
      var grossProfit = revenue - foodCost;
      var margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      document.getElementById("forecast-revenue").textContent = peso(revenue);
      document.getElementById("forecast-foodcost").textContent = peso(foodCost);
      document.getElementById("forecast-grossprofit").textContent = peso(grossProfit);
      document.getElementById("forecast-margin").textContent = pct2(margin);

      return { revenue: revenue, foodCost: foodCost, grossProfit: grossProfit, margin: margin, pcs: pcs, wastePct: wastePct };
    }

    ["forecast-pcs","forecast-price","forecast-waste-pct"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", recomputeForecast);
    });

    document.getElementById("save-forecast-btn").addEventListener("click", async function () {
      var select = document.getElementById("forecast-bread-item");
      var recipeId = select.value;
      var name = select.options[select.selectedIndex] ? select.options[select.selectedIndex].textContent : "";
      var result = recomputeForecast();
      if (!result.pcs) { toast("Enter expected pieces to bake & sell."); return; }
      if (!recipeId) { toast("Add a recipe first."); return; }

      var saveBtn = document.getElementById("save-forecast-btn");
      saveBtn.disabled = true;
      var saveResult = await insertForecast(recipeId, result.pcs, result.wastePct, result.revenue, result.foodCost, result.grossProfit, result.margin);
      saveBtn.disabled = false;

      if (saveResult.error) { toast("Couldn't save forecast: " + saveResult.error.message); return; }

      await logActivitySupa("Saved forecast - " + name + " (" + result.pcs + " pcs)");
      // Forecasts are hypothetical and intentionally do NOT get added to sales/
      // best-selling/profitability numbers above \u2014 only real recorded sales do.
      toast("Forecast saved for " + name + ". (This is a projection \u2014 it won't count as a real sale.)");
    });

      document.getElementById("print-report-btn").addEventListener("click", async function () {
      var btn = document.getElementById("print-report-btn");
      var originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Generating\u2026";
      var sales = await fetchSales(rangeSelect.value);
      var fcSel = document.getElementById("forecast-bread-item");
      var fc = recomputeForecast();
      fc.name = fcSel.options[fcSel.selectedIndex] ? fcSel.options[fcSel.selectedIndex].textContent : "";
      await exportReportToPdf(rangeSelect.value, sales, recipes, { trend: lastTrend, forecast: fc });
      btn.disabled = false;
      btn.textContent = originalText;
    });

    populateBreadItemSelect();
    if (recipes.length) recomputeForecast();
    renderRanking();
    renderMarginChart();
    loadTrendChart(trendMode);
    await refreshForRange("today");
  }

  /* =======================================================================
     Footer (every page): year, phone number, and the link list
     ======================================================================= */

  function fillFooterBasics() {
    document.querySelectorAll(".footer-year").forEach(function (el) { el.textContent = new Date().getFullYear(); });
    document.querySelectorAll(".footer-phone-text").forEach(function (el) { el.textContent = CONTACT_PHONE; });
  }

  // Logged in: mirror the header menu (so each role sees only its own pages).
  // Logged out (login / sign-up pages): show the account links instead.
  function fillFooterLinks() {
    var list = document.getElementById("footer-links");
    if (!list) return;
    var items = [];
    document.querySelectorAll(".app-header .app-nav a").forEach(function (a) {
      items.push({ text: a.textContent.trim(), href: a.getAttribute("href") });
    });
    if (!items.length) {
      var heading = document.getElementById("footer-links-heading");
      if (heading) heading.textContent = "Account";
      items = [{ text: "Log in", href: "index.html" }, { text: "Forgot password", href: "forgot-password.html" }];
    }
    list.innerHTML = "";
    items.forEach(function (item) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.textContent = item.text;
      a.setAttribute("href", item.href);
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  /* =======================================================================
     Init
     ======================================================================= */

  /* ---- Double-click / double-save protection ----
     Every "save" style button only runs one request at a time and stays blocked
     for a moment afterwards (or for good while it is disabled), so clicking twice,
     or clicking again while the page is still redirecting, can never create a
     second copy of the record. */
  function protectSaveButtons() {
    ["save-recipe-btn", "save-ingredient-btn", "save-bread-stock-btn", "save-sale-btn",
     "save-forecast-btn", "send-invite-btn", "create-account-btn"].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn || btn.__guarded) return;
      btn.__guarded = true;
      var nativeAdd = btn.addEventListener;
      btn.addEventListener = function (type, fn, opts) {
        if (type === "click" && typeof fn === "function") {
          var original = fn, busy = false;
          fn = async function (e) {
            if (busy || btn.disabled) { if (e && e.preventDefault) e.preventDefault(); return; }
            busy = true;
            try { return await original.call(this, e); }
            finally { setTimeout(function () { busy = false; }, 1500); }
          };
        }
        return nativeAdd.call(this, type, fn, opts);
      };
    });
  }

  var appInitStarted = false;

  document.addEventListener("DOMContentLoaded", async function () {
    if (appInitStarted) return;      // never initialise a page twice
    appInitStarted = true;

    function reveal() { document.body.classList.add("app-ready"); }

    try {
      // Trim the menu for the known role right away (before any network call)
      // so it doesn't visibly change after the page has painted.
      try {
        var early = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
        if (early && early.role) filterNavForRole(early.role);
      } catch (e) { /* ignore */ }

      protectSaveButtons();
      fillFooterBasics();
      initPasswordToggles();
      initSignupForm();
      initLoginForm();
      initForgotPasswordForm();
      initResetPasswordForm();

      var chromeOk = await initAppChrome();
      if (chromeOk === false) return;   // redirecting - keep the page hidden, no flash
      fillFooterLinks();

      // Run the page initialisers side by side (only the one for the current
      // page does any work), each on its own so one failure can't freeze the rest.
      var inits = [initDashboardPage, initRecipesListPage, initRecipeFormPage, initRecipeViewPage,
                   initInventoryPage, initAdminPage, initInviteAccountPage, initCreateAccountPage, initEditAccountPage,
                   initProfilePage, initRecordSalePage, initAnalyticsPage];
      var work = Promise.all(inits.map(function (fn) {
        return Promise.resolve().then(fn).catch(function (err) {
          if (!pageIsUnloading) console.error("Page init failed:", fn.name, err);
        });
      }));
      await work;
    } catch (err) {
      if (!pageIsUnloading) console.error("App init failed:", err);
    } finally {
      reveal();
    }
  });
})();