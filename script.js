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

  async function fetchRecipes() {
    var result = await supabaseClient.from("recipes").select("*").order("name");
    return result.data || [];
  }

  async function fetchRecipeWithIngredients(id) {
    var recipeResult = await supabaseClient.from("recipes").select("*").eq("id", id).maybeSingle();
    if (!recipeResult.data) return null;
    var lineResult = await supabaseClient
      .from("recipe_ingredients")
      .select("*, ingredients(name, category, unit)")
      .eq("recipe_id", id);
    var lines = (lineResult.data || []).map(function (row) {
      return {
        id: row.id,
        ingredientId: row.ingredient_id,
        name: row.ingredients ? row.ingredients.name : "(deleted ingredient)",
        category: row.ingredients ? row.ingredients.category : "",
        unit: row.unit,
        qty: row.quantity,
        lineCost: row.line_cost
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

  async function insertBreadBatch(recipeId, qtyBaked, consumedIngredients) {
    var batchResult = await supabaseClient.from("bread_inventory").insert({
      recipe_id: recipeId,
      quantity_baked: qtyBaked,
      quantity_sold: 0,
      date_baked: new Date().toISOString().slice(0, 10),
      logged_by: currentUserId()
    }).select().single();
    if (batchResult.error) return batchResult;

    for (var i = 0; i < consumedIngredients.length; i++) {
      var c = consumedIngredients[i];
      await supabaseClient.from("ingredients")
        .update({ stock_qty: Math.max(0, c.newStockQty), updated_at: new Date().toISOString() })
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
    var totalAmount = qty * unitPrice;
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
    var session = { id: supaSession.user.id, firstName: firstName, email: profile.email, role: profile.role };
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
    initAiChatWidget();
    return true;
  }

  /* =======================================================================
     AI Assistant — floating chat widget (site-wide)
     Rule-based insights generated live from your real Supabase data —
     no external AI API is called, so this works fully offline of any key.
     ======================================================================= */

  async function generateBusinessInsights() {
    var insights = [];

    var recipesResult = await supabaseClient.from("recipes").select("*");
    var recipes = recipesResult.data || [];

    var salesResult = await supabaseClient.from("sales").select("recipe_id, quantity, recipes(name)");
    var sales = salesResult.data || [];

    var ingredientsResult = await supabaseClient.from("ingredients").select("*");
    var ingredients = ingredientsResult.data || [];

    var settingsResult = await supabaseClient.from("business_settings").select("target_food_cost_pct").eq("id", 1).maybeSingle();
    var targetPct = (settingsResult.data && settingsResult.data.target_food_cost_pct) || 30;

    var soldRecipeIds = {};
    var qtyByRecipeName = {};
    sales.forEach(function (s) {
      soldRecipeIds[s.recipe_id] = true;
      var name = s.recipes ? s.recipes.name : "Unknown";
      qtyByRecipeName[name] = (qtyByRecipeName[name] || 0) + s.quantity;
    });

    var unsold = recipes.filter(function (r) { return !soldRecipeIds[r.id]; });
    if (unsold.length) {
      insights.push({
        type: "unsold",
        text: unsold.slice(0, 3).map(function (r) { return r.name; }).join(", ") +
          (unsold.length === 1 ? " hasn't sold" : " haven't sold") + " a single piece yet \u2014 maybe try a promo or a smaller test batch."
      });
    }

    recipes.forEach(function (r) {
      if (r.selling_price > 0) {
        var pct = (r.cost_per_piece / r.selling_price) * 100;
        if (pct > 0 && pct < targetPct - 10) {
          insights.push({ type: "underpriced", text: r.name + " is priced well under its target food cost (" + pct.toFixed(0) + "% vs " + targetPct + "% target) \u2014 there may be room to raise the price a bit." });
        } else if (pct > targetPct + 10) {
          insights.push({ type: "overpriced", text: r.name + " is running a high food cost (" + pct.toFixed(0) + "%) against your " + targetPct + "% target \u2014 worth reviewing its price or recipe cost." });
        }
      }
    });

    var lowStock = ingredients.filter(function (i) { return i.low_stock_threshold != null && i.stock_qty <= i.low_stock_threshold; });
    if (lowStock.length) {
      insights.push({ type: "lowstock", text: lowStock.slice(0, 3).map(function (i) { return i.name; }).join(", ") + " running low on stock \u2014 restock soon to avoid a production gap." });
    }

    var names = Object.keys(qtyByRecipeName);
    var bestSeller = null;
    if (names.length) {
      names.sort(function (a, b) { return qtyByRecipeName[b] - qtyByRecipeName[a]; });
      bestSeller = { name: names[0], qty: qtyByRecipeName[names[0]] };
      insights.push({ type: "bestseller", text: bestSeller.name + " is your best seller so far, with " + bestSeller.qty + " pcs sold." });
    }

    return { insights: insights, recipes: recipes, ingredients: ingredients, lowStock: lowStock, bestSeller: bestSeller, qtyByRecipeName: qtyByRecipeName, unsold: unsold, targetPct: targetPct };
  }

  function initAiChatWidget() {
    if (document.getElementById("ai-chat-fab")) return; // already initialized (shouldn't happen, but just in case)

    var fab = document.createElement("button");
    fab.type = "button";
    fab.id = "ai-chat-fab";
    fab.className = "ai-chat-fab";
    fab.setAttribute("aria-label", "Open bakery assistant chat");
    fab.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4.2 3.6A.6.6 0 0 1 4 19.1V5.5Z" fill="currentColor"/>' +
      '</svg><span class="ai-chat-badge"></span>';
    document.body.appendChild(fab);

    var panel = document.createElement("div");
    panel.id = "ai-chat-panel";
    panel.className = "ai-chat-panel";
    panel.innerHTML =
      '<div class="ai-chat-header">' +
        '<div class="ai-chat-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C9 6 7 8.5 7 11.5C7 14.5 9.2 17 12 17C14.8 17 17 14.5 17 11.5C17 8.5 15 6 12 2Z" fill="currentColor"/><path d="M6 20C6 17.7909 8.68629 16 12 16C15.3137 16 18 17.7909 18 20V21H6V20Z" fill="currentColor"/></svg></div>' +
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

    async function botReply(userText) {
      showTyping();
      var ctx = lastContext || await generateBusinessInsights();
      lastContext = ctx;
      var q = userText.toLowerCase();
      var reply;

      if (/low.?stock|restock|running out/.test(q)) {
        reply = ctx.lowStock.length
          ? "These are running low: " + ctx.lowStock.map(function (i) { return i.name + " (" + i.stock_qty + " " + i.unit + " left)"; }).join(", ") + "."
          : "Nothing's below its low-stock threshold right now \u2014 you're good.";
      } else if (/best.?sell|top.?sell|popular/.test(q)) {
        reply = ctx.bestSeller ? ctx.bestSeller.name + " is your best seller so far, with " + ctx.bestSeller.qty + " pcs sold." : "No sales recorded yet, so nothing to rank.";
      } else if (/unsold|not selling|no sales/.test(q)) {
        reply = ctx.unsold.length
          ? ctx.unsold.map(function (r) { return r.name; }).join(", ") + " " + (ctx.unsold.length === 1 ? "hasn't" : "haven't") + " sold at all yet."
          : "Every recipe has sold at least once \u2014 nice.";
      } else if (/profit|margin|price|pricing|expensive|cost/.test(q)) {
        var priceMsgs = ctx.insights.filter(function (i) { return i.type === "underpriced" || i.type === "overpriced"; }).map(function (i) { return i.text; });
        reply = priceMsgs.length ? priceMsgs.join(" ") : "Pricing looks close to your " + ctx.targetPct + "% target food cost across the board.";
      } else if (/hi|hello|hey/.test(q)) {
        reply = "Hey! I can help with stock levels, best sellers, pricing, or unsold items \u2014 what do you want to check?";
      } else if (/help|what can you|what do you do/.test(q)) {
        reply = "Ask me things like \"any low stock?\", \"what's my best seller?\", \"any unsold bread?\", or \"how's my pricing?\" \u2014 I pull straight from your current recipes, ingredients, and sales.";
      } else {
        reply = ctx.insights.length
          ? ctx.insights[0].text + (ctx.insights.length > 1 ? " I've got a few more \u2014 try asking about stock, best sellers, or pricing." : "")
          : "Everything looks steady right now \u2014 no alerts on stock, pricing, or unsold items.";
      }

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
        var ctx = await generateBusinessInsights();
        lastContext = ctx;
        setTimeout(function () {
          hideTyping();
          var name = currentUserName();
          if (ctx.insights.length) {
            addMessage("Hi " + name + "! Here's what stands out right now:", "bot");
            ctx.insights.slice(0, 3).forEach(function (i) { addMessage(i.text, "bot"); });
          } else {
            addMessage("Hi " + name + "! Nothing urgent to flag right now \u2014 stock, pricing, and sales all look steady.", "bot");
          }
          setQuickReplies(["Low stock?", "Best seller?", "Any unsold items?", "How's my pricing?"]);
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
    document.getElementById("stat-foodcost").textContent = computeAverageFoodCostPct(recipes).toFixed(1) + "%";
    var todayProfit = todaySales.reduce(function (sum, s) { return sum + s.gross_profit; }, 0);
    document.getElementById("stat-profit").textContent = "\u20B1 " + todayProfit.toLocaleString(undefined, { maximumFractionDigits: 0 });
    document.getElementById("stat-alerts").textContent = computeIngredientAlerts(ingredients);

    await renderMonthlySalesChart();
    await renderTopBreadDonut();
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

    var maxVal = Math.max(1000, Math.ceil(Math.max.apply(null, current.concat(past)) / 1000) * 1000);
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
      for (var v = 0; v <= maxVal; v += Math.ceil(maxVal / 5 / 1000) * 1000) {
        var s = document.createElement("span");
        s.textContent = "\u20B1" + (v / 1000) + "K";
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
        '<span class="amt">\u20B1' + (d.value / 1000).toFixed(1) + 'K</span>' +
        '<span class="pill">' + pctOfTotal.toFixed(0) + '%</span>';
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

    document.getElementById("staff-stat-sales").textContent = "\u20B1 " + totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 });
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
      li.innerHTML = "<span>" + time + " \u2014 " + (s.recipes ? s.recipes.name : "Item") + " x" + s.quantity + "</span><span>\u20B1" + s.total_amount.toFixed(2) + "</span>";
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
          "<td>\u20B1" + r.cost_per_piece.toFixed(2) + "</td>" +
          "<td>\u20B1" + r.selling_price.toFixed(2) + "</td>" +
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

  async function initRecipeFormPage() {
    var body = document.getElementById("recipe-ingredients-body");
    if (!body) return;

    var allIngredients = await fetchIngredients();
    var lineItems = [];
    var scaleFactor = 1;
    var editingId = new URLSearchParams(window.location.search).get("id");
    var editingRecipe = null;

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
        opt.textContent = ing.name + " (\u20B1" + ing.cost_per_unit.toFixed(3) + "/" + ing.unit + ")";
        ingredientSelect.appendChild(opt);
      });
    }

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
            "<td>" + item.qty + " " + item.unit + "</td>" +
            "<td>\u20B1" + (item.lineCost / item.qty).toFixed(3) + "</td>" +
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
      var ing = allIngredients.find(function (i) { return i.id === ingredientSelect.value; });
      var qty = parseFloat(qtyInput.value);
      if (!ing || !qty || qty <= 0) { toast("Pick an ingredient and enter a quantity."); return; }
      lineItems.push({
        ingredientId: ing.id, name: ing.name, category: ing.category || "",
        unit: ing.unit, qty: qty, lineCost: ing.cost_per_unit * qty
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
        var isLoss = targetPct > 0 ? pct > targetPct + 10 : pct > 45;
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>\u20B1" + r.price.toFixed(2) + "</td>" +
          "<td>" + pct.toFixed(1) + "%</td>" +
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
      if (!baseBatch) { toast("Enter a base batch size (yield)."); return; }

      var totals = recompute();
      var portions = parseFloat(portionsInput.value) || 1;
      var sellingPrice = parseFloat(sellingPriceInput.value) || totals.suggested;
      var targetPct = parseFloat(targetFoodCostInput.value) || null;

      var saveBtn = document.getElementById("save-recipe-btn");
      saveBtn.disabled = true;

      var result = await saveRecipe({
        name: name, category: category, baseBatchSize: baseBatch, portionsPerPiece: portions,
        notes: notesInput.value.trim(), totalBatchCost: totals.totalCost, costPerPiece: totals.costPerPiece,
        targetFoodCostPct: targetPct, suggestedSellingPrice: totals.suggested || null, sellingPrice: sellingPrice
      }, lineItems, editingId);

      saveBtn.disabled = false;

      if (result.error) {
        toast("Couldn't save recipe: " + result.error.message);
        return;
      }

      await logActivitySupa((editingId ? "Updated recipe - " : "Saved recipe - ") + name);

      // Active warning if the recipe's own current selling price is a loss risk.
      if (totals.costPerPiece > 0 && sellingPrice > 0) {
        var pct = (totals.costPerPiece / sellingPrice) * 100;
        var isLoss = targetPct ? pct > targetPct + 10 : pct > 45;
        if (isLoss) {
          toast("Saved \u2014 but heads up: at \u20B1" + sellingPrice.toFixed(2) + ", food cost is " + pct.toFixed(0) + "%. That's a loss risk.");
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
        "<td>\u20B1" + (item.lineCost / item.qty).toFixed(3) + "</td>" +
        "<td>\u20B1" + item.lineCost.toFixed(2) + "</td>";
      body.appendChild(tr);
    });

    document.getElementById("view-total-batch-cost").textContent = "\u20B1" + recipe.total_batch_cost.toFixed(2);
    document.getElementById("view-cost-per-piece").textContent = "\u20B1" + recipe.cost_per_piece.toFixed(2);

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
      yieldEl.textContent = yieldPct.toFixed(0) + "%";
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
    if (role === "Staff") {
      var rawTabBtn = document.querySelector('[data-tab="tab-raw-ingredients"]');
      if (rawTabBtn) rawTabBtn.style.display = "none";
    }

    var ingredients = await fetchIngredients();
    var recipes = await fetchRecipes();

    /* ---- Raw ingredients tab ---- */
    function renderIngredientTable() {
      body.innerHTML = "";
      if (!ingredients.length) {
        body.innerHTML = '<tr><td colspan="8" class="empty-note">No raw ingredients yet.</td></tr>';
        return;
      }
      ingredients.forEach(function (ing) {
        var isLow = ing.low_stock_threshold != null && ing.stock_qty <= ing.low_stock_threshold;
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + ing.name + (isLow ? ' <span class="status-pill" style="background:#9C3B1E;">Low stock</span>' : "") + "</td>" +
          "<td>" + (ing.category || "") + "</td>" +
          "<td>" + ing.unit + "</td>" +
          "<td>\u20B1" + ing.cost_per_unit.toFixed(3) + "</td>" +
          "<td>" + Number(ing.stock_qty).toLocaleString() + " " + ing.unit + "</td>" +
          "<td>" + (ing.low_stock_threshold != null ? ing.low_stock_threshold : "\u2014") + "</td>" +
          "<td>" + new Date(ing.updated_at).toLocaleDateString() + "</td>" +
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
      var ing = ingredients.find(function (i) { return i.id === id; });
      if (!ing) return;
      var rows = body.querySelectorAll("tr");
      rows.forEach(function (tr) {
        if (tr.children[0] && tr.children[0].textContent.indexOf(ing.name) === 0) {
          tr.innerHTML =
            '<td>' + ing.name + '</td>' +
            '<td>' + (ing.category || "") + '</td>' +
            '<td>' + ing.unit + '</td>' +
            '<td><input type="number" step="0.001" id="edit-cost-' + ing.id + '" value="' + ing.cost_per_unit + '"></td>' +
            '<td><input type="number" step="1" id="edit-stock-' + ing.id + '" value="' + ing.stock_qty + '"></td>' +
            '<td><input type="number" step="1" id="edit-lowstock-' + ing.id + '" value="' + (ing.low_stock_threshold != null ? ing.low_stock_threshold : "") + '"></td>' +
            '<td>' + new Date(ing.updated_at).toLocaleDateString() + '</td>' +
            '<td><a href="#" class="row-action" data-save="' + ing.id + '">Save</a></td>';
          tr.querySelector("[data-save]").addEventListener("click", async function (e) {
            e.preventDefault();
            var newCost = parseFloat(document.getElementById("edit-cost-" + ing.id).value);
            var newStock = parseFloat(document.getElementById("edit-stock-" + ing.id).value);
            var newLowStock = document.getElementById("edit-lowstock-" + ing.id).value;
            var fields = {};
            if (!isNaN(newCost)) fields.cost_per_unit = newCost;
            if (!isNaN(newStock)) fields.stock_qty = newStock;
            fields.low_stock_threshold = newLowStock === "" ? null : parseFloat(newLowStock);

            var result = await updateIngredient(ing.id, fields);
            if (result.error) { toast("Couldn't save: " + result.error.message); return; }

            Object.assign(ing, fields);
            await logActivitySupa("Updated ingredient - " + ing.name);
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

    document.getElementById("save-ingredient-btn").addEventListener("click", async function () {
      var name = document.getElementById("ing-name").value.trim();
      var category = document.getElementById("ing-category").value.trim();
      var unit = document.getElementById("ing-unit").value;
      var qty = parseFloat(qtyInput.value);
      var totalPrice = parseFloat(priceInput.value);
      var startStock = parseFloat(document.getElementById("ing-start-stock").value) || qty || 0;
      var lowStockVal = document.getElementById("ing-low-stock").value;

      if (!name || !qty || qty <= 0 || isNaN(totalPrice)) {
        toast("Fill in ingredient name, quantity purchased, and total price paid.");
        return;
      }
      var costPerUnit = totalPrice / qty;

      var saveBtn = document.getElementById("save-ingredient-btn");
      saveBtn.disabled = true;
      var result = await insertIngredient({
        name: name, category: category || "Uncategorized", unit: unit,
        cost_per_unit: costPerUnit, baseline_cost_per_unit: costPerUnit,
        stock_qty: startStock, low_stock_threshold: lowStockVal === "" ? null : parseFloat(lowStockVal),
        supplier: document.getElementById("ing-supplier").value.trim() || null
      });
      saveBtn.disabled = false;

      if (result.error) { toast("Couldn't save ingredient: " + result.error.message); return; }

      ingredients.push(result.data);
      await logActivitySupa("Added raw ingredient - " + name);

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
    var breadBatches = await fetchBreadInventory();

    function renderBreadStock() {
      breadBody.innerHTML = "";
      if (!breadBatches.length) {
        breadBody.innerHTML = '<tr><td colspan="5" class="empty-note">No bread stock logged yet.</td></tr>';
        return;
      }
      // Aggregate by recipe.
      var totals = {};
      breadBatches.forEach(function (b) {
        var name = b.recipes ? b.recipes.name : "Unknown";
        if (!totals[name]) totals[name] = { baked: 0, sold: 0, lastBaked: b.date_baked };
        totals[name].baked += b.quantity_baked;
        totals[name].sold += b.quantity_sold;
        if (new Date(b.date_baked) > new Date(totals[name].lastBaked)) totals[name].lastBaked = b.date_baked;
      });
      Object.keys(totals).forEach(function (name) {
        var t = totals[name];
        var remaining = Math.max(0, t.baked - t.sold);
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + name + "</td><td>" + t.baked + " pcs</td><td>" + t.sold + " pcs</td><td>" + remaining + " pcs</td><td>" + new Date(t.lastBaked).toLocaleDateString() + "</td>";
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
      bsPrice.value = recipe ? "\u20B1" + recipe.selling_price.toFixed(2) : "\u20B10.00";
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

    document.getElementById("save-bread-stock-btn").addEventListener("click", async function () {
      var recipe = recipes.find(function (r) { return r.id === bsSelect.value; });
      var qty = parseFloat(bsQty.value);
      if (!recipe) { toast("Add a recipe first, then log bread inventory for it."); return; }
      if (!qty || qty <= 0) { toast("Enter a quantity baked."); return; }

      if (!recipeLineCache[recipe.id]) {
        var loaded = await fetchRecipeWithIngredients(recipe.id);
        recipeLineCache[recipe.id] = loaded ? loaded.lineItems : [];
      }
      var lines = recipeLineCache[recipe.id];
      var scale = qty / recipe.base_batch_size;
      var consumed = lines.map(function (item) {
        var ing = ingredients.find(function (i) { return i.id === item.ingredientId; });
        var usedQty = item.qty * scale;
        return { ingredientId: item.ingredientId, newStockQty: ing ? ing.stock_qty - usedQty : 0 };
      });

      var saveBtn = document.getElementById("save-bread-stock-btn");
      saveBtn.disabled = true;
      var result = await insertBreadBatch(recipe.id, qty, consumed);
      saveBtn.disabled = false;

      if (result.error) { toast("Couldn't save: " + result.error.message); return; }

      consumed.forEach(function (c) {
        var ing = ingredients.find(function (i) { return i.id === c.ingredientId; });
        if (ing) ing.stock_qty = Math.max(0, c.newStockQty);
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
      totalInput.value = "\u20B1" + (qty * price).toFixed(2);
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
      if (!qty || qty <= 0) { toast("Enter a quantity."); return; }
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

      toast("Sale recorded: " + qty + "x " + recipe.name + " for \u20B1" + (qty * price).toFixed(2));
    });
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
      document.getElementById("stat-total-sales").textContent = "\u20B1 " + totalSales.toFixed(0);
      document.getElementById("stat-total-cost").textContent = "\u20B1 " + totalCost.toFixed(0);
      document.getElementById("stat-gross-profit").textContent = "\u20B1 " + gross.toFixed(0);
      document.getElementById("stat-net-profit").textContent = "\u20B1 " + gross.toFixed(0);
    }

    function renderBestLowest(sales) {
      var byItem = {};
      sales.forEach(function (s) {
        var name = s.recipes ? s.recipes.name : "Unknown";
        byItem[name] = (byItem[name] || 0) + s.quantity;
      });
      var names = Object.keys(byItem);
      var bestEl = document.getElementById("best-selling-text");
      var lowEl = document.getElementById("lowest-selling-text");
      if (!names.length) {
        bestEl.textContent = "No sales in this range yet.";
        lowEl.textContent = "No sales in this range yet.";
        return;
      }
      names.sort(function (a, b) { return byItem[b] - byItem[a]; });
      bestEl.textContent = names[0] + " \u2014 " + byItem[names[0]] + " pcs sold";
      var worst = names[names.length - 1];
      lowEl.textContent = worst + " \u2014 " + byItem[worst] + " pcs sold";
    }

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
        var status = r.margin >= 50 ? '<span class="status-text good">High Profit</span>' : '<span class="status-text bad">Low Profit</span>';
        tr.innerHTML =
          "<td>" + (i + 1) + "</td><td>" + r.name + "</td>" +
          "<td>\u20B1" + r.cost.toFixed(2) + "</td><td>\u20B1" + r.price.toFixed(2) + "</td>" +
          "<td>\u20B1" + r.profit.toFixed(2) + "</td><td>" + r.margin.toFixed(1) + "%</td><td>" + status + "</td>";
        tbody.appendChild(tr);
      });
    }

    async function refreshForRange(rangeKey) {
      headingEl.textContent = headingByRange[rangeKey] || "Sales";
      var sales = await fetchSales(rangeKey);
      await renderTotals(sales);
      renderBestLowest(sales);
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

      document.getElementById("forecast-revenue").textContent = "\u20B1 " + revenue.toFixed(0);
      document.getElementById("forecast-foodcost").textContent = "\u20B1 " + foodCost.toFixed(0);
      document.getElementById("forecast-grossprofit").textContent = "\u20B1 " + grossProfit.toFixed(0);
      document.getElementById("forecast-margin").textContent = margin.toFixed(0) + "%";

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

    document.getElementById("print-report-btn").addEventListener("click", function () { window.print(); });

    populateBreadItemSelect();
    if (recipes.length) recomputeForecast();
    renderRanking();
    await refreshForRange("today");
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

    await initDashboardPage();
    await initRecipesListPage();
    await initRecipeFormPage();
    await initRecipeViewPage();
    await initInventoryPage();
    initAdminPage();
    initInviteAccountPage();
    initEditAccountPage();
    initProfilePage();
    await initRecordSalePage();
    await initAnalyticsPage();
  });
})();