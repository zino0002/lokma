const STORAGE_KEY = "lokma-kitchen-v1";
const SUPABASE_URL = "https://yvgwydbcvgkfmkvnpvgq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_oXWBZjJxAtzBtE36TUnUwA_cwjAYnX1";
const CLOUD_TABLE = "user_kitchens";
const AUTH_CACHE_PREFIX = "lokma-kitchen-cache:";
const PENDING_SYNC_PREFIX = "lokma-kitchen-pending:";
const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

const initialState = () => {
  const recipes = [
    { id: "r-mercimek", name: "Kırmızı mercimek çorbası", categoryId: "cat-yemek", ingredients: "1 su bardağı kırmızı mercimek\n1 adet soğan\n1 adet havuç\n6 su bardağı su\nTuz, karabiber", instructions: "Soğanı ve havucu doğrayıp mercimekle birlikte tencereye al. Suyu ekleyip yumuşayana kadar pişir. Blenderdan geçirip baharatlarını ekle." },
    { id: "r-makarna", name: "Fırında sebzeli makarna", categoryId: "cat-yemek", ingredients: "Makarna\nKabak ve kapya biber\n1 kutu krema\nRendelenmiş kaşar", instructions: "Makarnayı haşla. Sebzeleri sotele, krema ile karıştır. Fırın kabına alıp kaşar ekle ve üzeri kızarana kadar pişir." },
    { id: "r-kek", name: "Limonlu anne keki", categoryId: "cat-tatli", ingredients: "3 yumurta\n1 su bardağı şeker\n1 limonun kabuğu ve suyu\n2 su bardağı un\n1 paket kabartma tozu", instructions: "Yumurta ve şekeri çırp. Limonu ekle, ardından kuru malzemeleri karıştır. Yağlanmış kalıpta 180 derecede yaklaşık 35 dakika pişir." },
    { id: "r-salata", name: "Nohutlu mevsim salatası", categoryId: "cat-yemek", ingredients: "Haşlanmış nohut\nMevsim yeşillikleri\nCherry domates\nZeytinyağı ve limon", instructions: "Yeşillikleri yıka ve doğra. Nohut ve domateslerle karıştır. Zeytinyağı ve limonla servis et." }
  ];
  return {
    categories: [
      { id: "cat-yemek", name: "Yemekler" },
      { id: "cat-tatli", name: "Tatlılar" }
    ],
    recipes,
    meals: [
      { id: "m-1", recipeId: "r-mercimek", dayOfWeek: 0, time: "19:00", completed: false },
      { id: "m-2", recipeId: "r-salata", dayOfWeek: 1, time: "13:00", completed: false },
      { id: "m-3", recipeId: "r-makarna", dayOfWeek: 2, time: "18:30", completed: false },
      { id: "m-4", recipeId: "r-kek", dayOfWeek: 4, time: "16:00", completed: false }
    ]
  };
};

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  return result;
}
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function weekKey(date) { return dateKey(startOfWeek(date)); }
function dateForWeekDay(weekStart, dayOfWeek) {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayOfWeek);
  return date;
}
function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return initialState();
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.recipes) || !Array.isArray(parsed.meals)) throw new Error("Geçersiz mutfak verisi");
    if (parsed.meals.some((meal) => !Number.isInteger(meal.dayOfWeek) || meal.dayOfWeek < 0 || meal.dayOfWeek > 6)) {
      const datedMeals = parsed.meals.filter((meal) => typeof meal.date === "string");
      const recurringMeals = parsed.meals.filter((meal) => Number.isInteger(meal.dayOfWeek) && meal.dayOfWeek >= 0 && meal.dayOfWeek <= 6);
      const monday = startOfWeek(new Date());
      const thisWeekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      const weekGroups = new Map();
      datedMeals.forEach((meal) => {
        const [year, month, day] = meal.date.split("-").map(Number);
        const mealDate = new Date(year, month - 1, day);
        if (Number.isNaN(mealDate.getTime())) return;
        const mealMonday = startOfWeek(mealDate);
        const weekKey = `${mealMonday.getFullYear()}-${String(mealMonday.getMonth() + 1).padStart(2, "0")}-${String(mealMonday.getDate()).padStart(2, "0")}`;
        if (!weekGroups.has(weekKey)) weekGroups.set(weekKey, []);
        weekGroups.get(weekKey).push({ ...meal, dayOfWeek: (mealDate.getDay() + 6) % 7 });
      });
      const selectedWeek = weekGroups.has(thisWeekKey)
        ? thisWeekKey
        : [...weekGroups.keys()].sort().at(-1);
      parsed.meals = [
        ...recurringMeals,
        ...(weekGroups.get(selectedWeek) || []).map(({ date, ...meal }) => meal)
      ];
      parsed.scheduleVersion = 2;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch (error) {
    console.error("Kaydedilmiş mutfak verisi okunamadı.", error);
    return initialState();
  }
}

const hasLegacyData = localStorage.getItem(STORAGE_KEY) !== null;
let legacyState = hasLegacyData ? loadState() : null;
let state = initialState();
let activeCategory = "all";
let activeView = "week";
let viewedWeekKey = weekKey(new Date());
let recipeForDetails = null;
let toastTimer;
let supabaseClient = null;
let activeUserId = null;
let loadingUserId = null;
let authGeneration = 0;
let saveQueue = Promise.resolve();

const elements = {
  daysGrid: document.querySelector("#days-grid"),
  recipeGrid: document.querySelector("#recipe-grid"),
  categoryTabs: document.querySelector("#category-tabs"),
  recipeDialog: document.querySelector("#recipe-dialog"),
  recipeForm: document.querySelector("#recipe-form"),
  categoryDialog: document.querySelector("#category-dialog"),
  categoryForm: document.querySelector("#category-form"),
  detailDialog: document.querySelector("#detail-dialog"),
  toast: document.querySelector("#toast")
};

function saveState() {
  if (!activeUserId || !supabaseClient) return;
  const userId = activeUserId;
  const snapshot = JSON.parse(JSON.stringify(state));
  localStorage.setItem(`${AUTH_CACHE_PREFIX}${userId}`, JSON.stringify(snapshot));
  localStorage.setItem(`${PENDING_SYNC_PREFIX}${userId}`, "true");
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    if (activeUserId !== userId) return;
    const { error } = await supabaseClient
      .from(CLOUD_TABLE)
      .upsert({ user_id: userId, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    localStorage.removeItem(`${PENDING_SYNC_PREFIX}${userId}`);
  }).catch((error) => {
    console.error("Mutfak verisi Supabase'e kaydedilemedi.", error);
    showToast("Buluta kaydedilemedi. Bağlantını ve Supabase tablo/RLS kurulumunu kontrol et.");
  });
}

function getWeekHistory() {
  if (!state.weekHistory || typeof state.weekHistory !== "object" || Array.isArray(state.weekHistory)) state.weekHistory = {};
  return state.weekHistory;
}

function makeWeekRecord(key, startDate, sourceMeals = state.meals) {
  const monday = new Date(`${key}T00:00:00`);
  const meals = sourceMeals.filter((meal) => dateKey(dateForWeekDay(monday, meal.dayOfWeek)) >= startDate).map((meal) => {
    const recipe = getRecipe(meal.recipeId);
    const category = recipe && getCategory(recipe.categoryId);
    return {
      id: meal.id,
      recipeId: meal.recipeId,
      recipeName: recipe?.name || "Silinmiş tarif",
      categoryName: category?.name || "Tarif",
      dayOfWeek: meal.dayOfWeek,
      time: meal.time,
      completed: Boolean(meal.completed)
    };
  });
  return { weekStart: key, startDate, updatedAt: new Date().toISOString(), meals };
}

function ensureCurrentWeekRecord() {
  const key = weekKey(new Date());
  const history = getWeekHistory();
  if (!history[key]) {
    const startDate = dateKey(new Date());
    if (!state.historyStartDate) state.historyStartDate = startDate;
    state.meals = state.meals.map((meal) => ({ ...meal, completed: false }));
    history[key] = makeWeekRecord(key, startDate);
    history[key].status = "current";
  } else if (history[key].status === "planned") {
    history[key].meals = history[key].meals.map((meal) => ({ ...meal, completed: false }));
    history[key].status = "current";
  } else if (!history[key].status) {
    history[key].status = "current";
  }
}

function getOrCreateWeekRecord(key) {
  const history = getWeekHistory();
  if (history[key]) return history[key];
  const isFuture = key > weekKey(new Date());
  const meals = isFuture ? state.meals.map((meal) => ({ ...meal, completed: false })) : [];
  const record = makeWeekRecord(key, key, meals);
  record.status = isFuture ? "planned" : "past";
  history[key] = record;
  return record;
}

function addMealToWeek(key, meal) {
  const record = getOrCreateWeekRecord(key);
  const recipe = getRecipe(meal.recipeId);
  const category = recipe && getCategory(recipe.categoryId);
  record.meals.push({
    ...meal,
    recipeName: recipe?.name || "Silinmiş tarif",
    categoryName: category?.name || "Tarif"
  });
  if (key === weekKey(new Date())) state.meals.push(meal);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2400);
}

function getRecipe(id) {
  return state.recipes.find((recipe) => recipe.id === id);
}
function getCategory(id) {
  return state.categories.find((category) => category.id === id);
}

function renderWeek() {
  const currentKey = weekKey(new Date());
  const isCurrentWeek = viewedWeekKey === currentKey;
  const history = getWeekHistory();
  const record = history[viewedWeekKey];
  const monday = new Date(`${viewedWeekKey}T00:00:00`);
  const sunday = dateForWeekDay(monday, 6);
  const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  document.querySelector("#week-date-button").textContent = `${dateFormatter.format(monday)} – ${dateFormatter.format(sunday)}  ▾`;
  document.querySelector("#week-picker").value = dateKey(monday);
  document.querySelector("#current-week-shortcut").classList.toggle("is-current", isCurrentWeek);
  const isFutureWeek = viewedWeekKey > currentKey;
  document.querySelector("#week-caption").textContent = isCurrentWeek
    ? "Bu haftanın planı ve tamamlanan yemekleri kaydediliyor."
    : record?.status === "planned" ? "Gelecek hafta planı · düzenleyebilirsin."
      : record ? "Bu haftanın kaydı · günleri düzenleyebilirsin."
        : isFutureWeek ? "Gelecek hafta için yemek planı oluşturabilirsin."
          : "Bu haftaya ait henüz kayıt yok; plan ekleyebilirsin.";
  const recordedMeals = record?.meals || [];
  const todayIndex = (new Date().getDay() + 6) % 7;
  elements.daysGrid.innerHTML = DAY_NAMES.map((dayName, index) => {
    const meals = recordedMeals.filter((meal) => meal.dayOfWeek === index).sort((a, b) => a.time.localeCompare(b.time));
    const isToday = isCurrentWeek && index === todayIndex;
    return `<article class="day-card${isToday ? " today" : ""}">
      <div class="day-heading">
        <div class="day-title"><strong>${dayName}</strong>${isToday ? '<span class="today-label">BUGÜN</span>' : ""}</div>
        <button class="add-day-meal" data-add-day="${index}" aria-label="${dayName} için yemek ekle">＋</button>
      </div>
      ${meals.length ? `<div class="meal-list">${meals.map((meal) => {
        const recipe = getRecipe(meal.recipeId);
        const recipeName = meal.recipeName || recipe?.name;
        const categoryName = meal.categoryName || (recipe && getCategory(recipe.categoryId)?.name) || "Tarif";
        if (!recipeName) return "";
        return `<div class="meal-item${meal.completed ? " completed" : ""}">
          <input class="meal-check" type="checkbox" data-toggle-meal="${meal.id}" ${meal.completed ? "checked" : ""} aria-label="${escapeHtml(recipeName)} tamamlandı" />
          <div class="meal-info"><span class="meal-name">${escapeHtml(recipeName)}</span><span class="meal-category">${escapeHtml(categoryName)}</span></div>
          <span class="meal-time">${escapeHtml(meal.time)}</span>
          <button class="remove-meal" data-remove-meal="${meal.id}" aria-label="Yemek planından çıkar">×</button>
        </div>`;
      }).join("")}</div>` : '<p class="empty-day">Henüz plan yok. Bir yemek ekle!</p>'}
    </article>`;
  }).join("");
  elements.daysGrid.querySelectorAll("[data-add-day]").forEach((button) => button.addEventListener("click", () => openRecipeForm({ day: Number(button.dataset.addDay) })));
  elements.daysGrid.querySelectorAll("[data-toggle-meal]").forEach((checkbox) => checkbox.addEventListener("change", () => {
    const selectedRecord = getOrCreateWeekRecord(viewedWeekKey);
    const meal = selectedRecord.meals.find((item) => item.id === checkbox.dataset.toggleMeal);
    if (!meal) return;
    meal.completed = checkbox.checked;
    if (viewedWeekKey === weekKey(new Date())) {
      const templateMeal = state.meals.find((item) => item.id === meal.id);
      if (templateMeal) templateMeal.completed = checkbox.checked;
    }
    saveState();
    renderWeek();
  }));
  elements.daysGrid.querySelectorAll("[data-remove-meal]").forEach((button) => button.addEventListener("click", () => {
    const selectedRecord = getOrCreateWeekRecord(viewedWeekKey);
    selectedRecord.meals = selectedRecord.meals.filter((meal) => meal.id !== button.dataset.removeMeal);
    if (viewedWeekKey === weekKey(new Date())) state.meals = state.meals.filter((meal) => meal.id !== button.dataset.removeMeal);
    saveState();
    renderWeek();
    showToast("Yemek haftalık plandan çıkarıldı.");
  }));
}

function renderCategories() {
  const categories = state.categories;
  if (!categories.some((category) => category.id === activeCategory)) activeCategory = "all";
  elements.categoryTabs.innerHTML = `<button class="category-tab${activeCategory === "all" ? " active" : ""}" data-category="all">Tümü</button>${categories.map((category) =>
    `<button class="category-tab${activeCategory === category.id ? " active" : ""}" data-category="${escapeHtml(category.id)}">${escapeHtml(category.name)}</button>`
  ).join("")}`;
  elements.categoryTabs.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    renderRecipes();
  }));
}

function deleteCategory(id) {
  const category = getCategory(id);
  if (!category) return;
  const recipeIds = new Set(state.recipes.filter((recipe) => recipe.categoryId === category.id).map((recipe) => recipe.id));
  const linkedMeals = state.meals.filter((meal) => recipeIds.has(meal.recipeId)).length;
  const message = recipeIds.size
    ? `"${category.name}" bölümünü silmek, içindeki ${recipeIds.size} tarifi${linkedMeals ? ` ve haftalık plandaki ${linkedMeals} öğünü` : ""} de siler. Devam edilsin mi?`
    : `"${category.name}" bölümü silinsin mi?`;
  if (!window.confirm(message)) return;
  state.categories = state.categories.filter((item) => item.id !== category.id);
  state.recipes = state.recipes.filter((recipe) => !recipeIds.has(recipe.id));
  state.meals = state.meals.filter((meal) => !recipeIds.has(meal.recipeId));
  activeCategory = "all";
  saveState();
  renderAll();
  showToast("Bölüm silindi.");
}

function renderRecipes() {
  renderCategories();
  const recipes = state.recipes.filter((recipe) => activeCategory === "all" || recipe.categoryId === activeCategory);
  const selectedCategory = getCategory(activeCategory);
  document.querySelector("#delete-category").classList.toggle("hidden", !selectedCategory);
  elements.recipeGrid.innerHTML = recipes.length ? recipes.map((recipe) => {
    const category = getCategory(recipe.categoryId);
    const description = recipe.ingredients ? recipe.ingredients.split("\n").slice(0, 2).join(" · ") : "Tarif detaylarını eklemek için incele.";
    return `<article class="recipe-card">
      <div class="recipe-card-top"><span class="recipe-category">${escapeHtml(category?.name || "Tarif")}</span></div>
      <h3>${escapeHtml(recipe.name)}</h3><p>${escapeHtml(description)}</p>
      <div class="recipe-card-bottom"><button data-detail-recipe="${escapeHtml(recipe.id)}">Tarifi görüntüle <span>→</span></button><button class="delete-recipe-card" data-delete-recipe="${escapeHtml(recipe.id)}" aria-label="${escapeHtml(recipe.name)} tarifini sil">×</button></div>
    </article>`;
  }).join("") : `<div class="empty-recipes"><strong>${activeCategory === "all" ? "Tarif defterin henüz boş." : "Bu bölümde henüz tarif yok."}</strong>İlk tarifini ekleyerek başlayabilirsin.</div>`;
  elements.recipeGrid.querySelectorAll("[data-detail-recipe]").forEach((button) => button.addEventListener("click", () => openRecipeDetails(button.dataset.detailRecipe)));
  elements.recipeGrid.querySelectorAll("[data-delete-recipe]").forEach((button) => button.addEventListener("click", () => deleteRecipe(button.dataset.deleteRecipe)));
}

function renderAll() {
  renderWeek();
  renderRecipes();
}

function setView(view) {
  activeView = view;
  document.querySelector("#week-view").classList.toggle("hidden", view !== "week");
  document.querySelector("#recipes-view").classList.toggle("hidden", view !== "recipes");
  document.querySelector("#breadcrumb-current").textContent = view === "week" ? "Haftalık plan" : "Yemeklerim";
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
}

function openRecipeForm({ day = null, recipeId = null } = {}) {
  if (!state.categories.length) {
    showToast("Önce bir yemek bölümü eklemelisin.");
    setView("recipes");
    return;
  }
  elements.recipeForm.reset();
  const recipe = recipeId ? getRecipe(recipeId) : null;
  const categorySelect = document.querySelector("#recipe-category");
  categorySelect.innerHTML = state.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join("");
  if (recipe) {
    document.querySelector("#recipe-name").value = recipe.name;
    categorySelect.value = recipe.categoryId;
    document.querySelector("#recipe-ingredients").value = recipe.ingredients || "";
    document.querySelector("#recipe-instructions").value = recipe.instructions || "";
  }
  elements.recipeForm.dataset.planDay = day === null ? "" : String(day);
  elements.recipeForm.dataset.recipeId = recipeId || "";
  document.querySelector("#plan-fields").classList.toggle("hidden", day === null);
  const planRecipe = document.querySelector("#plan-recipe");
  const recipeGroups = state.categories.map((category) => {
    const recipes = state.recipes.filter((item) => item.categoryId === category.id);
    return recipes.length
      ? `<optgroup label="${escapeHtml(category.name)}">${recipes.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</optgroup>`
      : "";
  }).join("");
  const ungroupedRecipes = state.recipes.filter((item) => !getCategory(item.categoryId));
  planRecipe.innerHTML = state.recipes.length
    ? `${recipeGroups}${ungroupedRecipes.length ? `<optgroup label="Diğer">${ungroupedRecipes.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</optgroup>` : ""}<option value="__new__">＋ Yeni tarif oluştur</option>`
    : `<option value="__new__">Henüz tarifin yok — yeni tarif oluştur</option>`;
  const selectExistingRecipe = day !== null && state.recipes.length > 0;
  planRecipe.value = selectExistingRecipe ? state.recipes[0].id : "__new__";
  document.querySelector("#recipe-fields").classList.toggle("hidden", day !== null && selectExistingRecipe);
  document.querySelector("#recipe-name").required = day === null || !selectExistingRecipe;
  document.querySelector("#recipe-category").required = day === null || !selectExistingRecipe;
  document.querySelector("#recipe-modal-eyebrow").textContent = day !== null ? "HAFTALIK PLANINA" : recipe ? "TARİFİNİ DÜZENLE" : "MUTFAK DEFTERİNE";
  document.querySelector("#recipe-modal-title").textContent = day !== null ? `${DAY_NAMES[day]} için yemek planla` : recipe ? "Tarifi düzenle" : "Yeni tarif";
  document.querySelector("#recipe-submit").textContent = day !== null ? "Planına ekle" : recipe ? "Değişiklikleri kaydet" : "Tarifi kaydet";
  if (day !== null) document.querySelector("#meal-time").value = "18:30";
  elements.recipeDialog.showModal();
}

document.querySelector("#plan-recipe").addEventListener("change", (event) => {
  const creatingRecipe = event.target.value === "__new__";
  document.querySelector("#recipe-fields").classList.toggle("hidden", !creatingRecipe);
  document.querySelector("#recipe-name").required = creatingRecipe;
  document.querySelector("#recipe-category").required = creatingRecipe;
});

elements.recipeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(elements.recipeForm);
  const day = elements.recipeForm.dataset.planDay;
  const selectedRecipeId = document.querySelector("#plan-recipe").value;
  if (day !== "" && selectedRecipeId !== "__new__") {
    addMealToWeek(viewedWeekKey, { id: makeId("meal"), recipeId: selectedRecipeId, dayOfWeek: Number(day), time: String(form.get("time") || "18:30"), completed: false });
    saveState();
    elements.recipeDialog.close();
    renderAll();
    showToast("Yemek haftalık planına eklendi.");
    return;
  }
  const name = String(form.get("name")).trim();
  if (!name) return;
  const recipeId = elements.recipeForm.dataset.recipeId;
  let recipe = recipeId ? getRecipe(recipeId) : null;
  if (recipe) {
    recipe.name = name;
    recipe.categoryId = String(form.get("categoryId"));
    recipe.ingredients = String(form.get("ingredients")).trim();
    recipe.instructions = String(form.get("instructions")).trim();
  } else {
    recipe = {
      id: makeId("recipe"),
      name,
      categoryId: String(form.get("categoryId")),
      ingredients: String(form.get("ingredients")).trim(),
      instructions: String(form.get("instructions")).trim()
    };
    state.recipes.push(recipe);
  }
  if (day !== "") addMealToWeek(viewedWeekKey, { id: makeId("meal"), recipeId: recipe.id, dayOfWeek: Number(day), time: String(form.get("time") || "18:30"), completed: false });
  saveState();
  elements.recipeDialog.close();
  renderAll();
  if (day === "") setView("recipes");
  showToast(day !== "" ? "Yemek haftalık planına eklendi." : recipeId ? "Tarif güncellendi." : "Yeni tarif kaydedildi.");
});

function openRecipeDetails(id) {
  const recipe = getRecipe(id);
  if (!recipe) return;
  recipeForDetails = id;
  const category = getCategory(recipe.categoryId);
  document.querySelector("#detail-category").textContent = category?.name || "Tarif";
  document.querySelector("#detail-name").textContent = recipe.name;
  const ingredients = recipe.ingredients.split("\n").map((item) => item.trim()).filter(Boolean);
  document.querySelector("#detail-ingredients-wrap").classList.toggle("hidden", !ingredients.length);
  document.querySelector("#detail-ingredients").innerHTML = ingredients.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  document.querySelector("#detail-instructions-wrap").classList.toggle("hidden", !recipe.instructions);
  document.querySelector("#detail-instructions").textContent = recipe.instructions || "";
  elements.detailDialog.showModal();
}

function deleteRecipe(id) {
  const recipe = getRecipe(id);
  if (!recipe) return;
  const linkedMeals = state.meals.filter((meal) => meal.recipeId === id).length;
  const message = linkedMeals
    ? `"${recipe.name}" tarifini silmek, haftalık plandaki ${linkedMeals} öğünü de kaldırır. Devam edilsin mi?`
    : `"${recipe.name}" tarifi silinsin mi?`;
  if (!window.confirm(message)) return;
  state.recipes = state.recipes.filter((item) => item.id !== id);
  state.meals = state.meals.filter((meal) => meal.recipeId !== id);
  saveState();
  renderAll();
  if (elements.detailDialog.open) elements.detailDialog.close();
  showToast("Tarif silindi.");
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelector("#previous-week").addEventListener("click", () => {
  const date = new Date(`${viewedWeekKey}T00:00:00`);
  date.setDate(date.getDate() - 7);
  viewedWeekKey = dateKey(date);
  renderWeek();
});
document.querySelector("#week-date-button").addEventListener("click", () => {
  const picker = document.querySelector("#week-picker");
  if (typeof picker.showPicker === "function") picker.showPicker();
  else { picker.focus(); picker.click(); }
});
document.querySelector("#current-week-shortcut").addEventListener("click", () => {
  viewedWeekKey = weekKey(new Date());
  renderWeek();
});
document.querySelector("#week-picker").addEventListener("change", (event) => {
  const selectedDate = new Date(`${event.currentTarget.value}T00:00:00`);
  if (Number.isNaN(selectedDate.getTime())) return;
  viewedWeekKey = weekKey(selectedDate);
  renderWeek();
});
document.querySelector("#next-week").addEventListener("click", () => {
  const date = new Date(`${viewedWeekKey}T00:00:00`);
  date.setDate(date.getDate() + 7);
  viewedWeekKey = dateKey(date);
  renderWeek();
});
document.querySelector("#add-week-meal").addEventListener("click", () => {
  const day = viewedWeekKey === weekKey(new Date()) ? (new Date().getDay() + 6) % 7 : 0;
  openRecipeForm({ day });
});
document.querySelector("#add-recipe").addEventListener("click", () => openRecipeForm());
document.querySelector("#add-category").addEventListener("click", () => {
  elements.categoryForm.reset();
  elements.categoryDialog.showModal();
});
document.querySelector("#delete-category").addEventListener("click", () => {
  if (activeCategory !== "all") deleteCategory(activeCategory);
});
elements.categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = String(new FormData(elements.categoryForm).get("name")).trim();
  if (!name) return;
  if (state.categories.some((category) => category.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) {
    showToast("Bu isimde bir bölüm zaten var.");
    return;
  }
  const category = { id: makeId("category"), name };
  state.categories.push(category);
  activeCategory = category.id;
  saveState();
  elements.categoryDialog.close();
  renderRecipes();
  showToast("Yeni bölüm eklendi.");
});
document.querySelector("#delete-recipe").addEventListener("click", () => {
  if (recipeForDetails) deleteRecipe(recipeForDetails);
});
document.querySelector("#edit-recipe").addEventListener("click", () => {
  const recipeId = recipeForDetails;
  if (!recipeId) return;
  elements.detailDialog.close();
  openRecipeForm({ recipeId });
});
document.querySelectorAll(".close-dialog").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
}));

const authScreen = document.querySelector("#auth-screen");
const appShell = document.querySelector("#app-shell");
const accountDisabledScreen = document.querySelector("#account-disabled-screen");
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const accountDialog = document.querySelector("#account-dialog");
const passwordDialog = document.querySelector("#password-dialog");
let authMode = "signin";

function setAccountScreen(screen) {
  authScreen.classList.toggle("hidden", screen !== "auth");
  appShell.classList.toggle("hidden", screen !== "app");
  accountDisabledScreen.classList.toggle("hidden", screen !== "disabled");
}

function updateAccountStatusUI(isActive) {
  document.querySelector("#account-status").textContent = isActive
    ? "Hesabın açık. Tariflerin ve haftalık planın hesabında saklanıyor."
    : "Hesabın kapalı. Açana kadar tariflerine ve haftalık planına erişemezsin.";
  document.querySelector("#toggle-account-status").textContent = isActive
    ? "Hesabı geçici olarak kapat"
    : "Hesabı yeniden aç";
}

function setAuthMessage(message, type = "error") {
  authMessage.textContent = message;
  authMessage.classList.toggle("success", type === "success");
  authMessage.classList.toggle("error", type === "error");
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignUp = mode === "signup";
  document.querySelector("#auth-title").innerHTML = isSignUp ? 'Mutfağını oluştur<span class="heading-period">.</span>' : 'Hoş geldin<span class="heading-period">.</span>';
  document.querySelector("#auth-description").textContent = isSignUp
    ? "E-posta ve parolanla hesabını oluştur; tariflerin sana özel saklansın."
    : "Tariflerini ve haftalık planını hesabında güvenle sakla.";
  document.querySelector("#auth-submit").textContent = isSignUp ? "Hesap oluştur" : "Giriş yap";
  document.querySelector("#auth-password").autocomplete = isSignUp ? "new-password" : "current-password";
  document.querySelectorAll("[data-auth-mode]").forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
  setAuthMessage("");
}

function validKitchenData(data) {
  return data && Array.isArray(data.categories) && Array.isArray(data.recipes) && Array.isArray(data.meals);
}

function cacheKey(userId) {
  return `${AUTH_CACHE_PREFIX}${userId}`;
}

async function upsertKitchen(userId, kitchen) {
  const { error } = await supabaseClient
    .from(CLOUD_TABLE)
    .upsert({ user_id: userId, data: kitchen, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  localStorage.removeItem(`${PENDING_SYNC_PREFIX}${userId}`);
}

async function activateSession(session) {
  const userId = session.user.id;
  if (activeUserId === userId || loadingUserId === userId) return;
  const generation = ++authGeneration;
  loadingUserId = userId;
  activeUserId = null;
  setAccountScreen("auth");
  authScreen.classList.add("loading");
  setAuthMessage("Mutfağın yükleniyor…", "success");

  let accountStatusVerified = false;
  try {
    const { data: accountStatus, error: statusError } = await supabaseClient
      .from("user_account_status")
      .select("is_active")
      .eq("user_id", userId)
      .maybeSingle();
    if (statusError) throw statusError;
    if (!accountStatus) throw new Error("Hesap durumu tablosu bulunamadı. Yeni schema.sql dosyasını Supabase SQL Editor'de çalıştır.");
    accountStatusVerified = true;
    if (generation !== authGeneration) return;
    document.querySelector("#profile-email").textContent = session.user.email || "Hesabım";
    document.querySelector("#account-email").textContent = session.user.email || "Hesabım";
    updateAccountStatusUI(accountStatus.is_active);
    if (!accountStatus.is_active) {
      activeUserId = userId;
      document.querySelector("#account-disabled-message").textContent = "";
      setAccountScreen("disabled");
      return;
    }

    const { data, error } = await supabaseClient
      .from(CLOUD_TABLE)
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (generation !== authGeneration) return;

    const cachedValue = localStorage.getItem(cacheKey(userId));
    const cachedKitchen = cachedValue ? JSON.parse(cachedValue) : null;
    const hasPendingSync = localStorage.getItem(`${PENDING_SYNC_PREFIX}${userId}`) === "true";

    if (data) {
      if (!validKitchenData(data.data)) throw new Error("Hesabındaki mutfak verisinin biçimi geçersiz.");
      state = hasPendingSync && validKitchenData(cachedKitchen) ? cachedKitchen : data.data;
      activeUserId = userId;
      if (hasPendingSync && validKitchenData(cachedKitchen)) saveState();
      localStorage.removeItem(STORAGE_KEY);
      legacyState = null;
    } else {
      const shouldImport = legacyState && window.confirm("Bu cihazda önceden kaydedilmiş tarifler bulundu. Bu verileri yeni hesabına aktarmak ister misin?");
      state = shouldImport ? legacyState : initialState();
      await upsertKitchen(userId, state);
      activeUserId = userId;
      localStorage.removeItem(STORAGE_KEY);
      legacyState = null;
    }

    if (generation !== authGeneration) return;
    ensureCurrentWeekRecord();
    localStorage.setItem(cacheKey(userId), JSON.stringify(state));
    saveState();
    renderAll();
    setAccountScreen("app");
  } catch (error) {
    console.error("Kullanıcı mutfağı yüklenemedi.", error);
    if (generation === authGeneration) {
      const cachedValue = localStorage.getItem(cacheKey(userId));
      let cachedKitchen = null;
      try {
        cachedKitchen = cachedValue ? JSON.parse(cachedValue) : null;
      } catch (cacheError) {
        console.error("Yerel mutfak önbelleği okunamadı.", cacheError);
      }
      if (accountStatusVerified && validKitchenData(cachedKitchen)) {
        state = cachedKitchen;
        activeUserId = userId;
        ensureCurrentWeekRecord();
        localStorage.setItem(cacheKey(userId), JSON.stringify(state));
        document.querySelector("#profile-email").textContent = session.user.email || "Hesabım";
        document.querySelector("#account-email").textContent = session.user.email || "Hesabım";
        renderAll();
        setAccountScreen("app");
        showToast("Çevrimdışı önbellek açıldı; bulut bağlantısı kurulunca yeniden eşitlenecek.");
      } else {
        setAuthMessage(`Mutfak verisi yüklenemedi: ${error.message} Supabase SQL kurulumunu kontrol et.`);
      }
    }
  } finally {
    if (loadingUserId === userId) loadingUserId = null;
    authScreen.classList.remove("loading");
  }
}

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    setAuthMessage("Supabase bağlantısı başlatılamadı. İnternet bağlantını kontrol edip sayfayı yenile.");
    return;
  }
  const submitButton = document.querySelector("#auth-submit");
  const form = new FormData(authForm);
  const email = String(form.get("email")).trim();
  const password = String(form.get("password"));
  submitButton.disabled = true;
  setAuthMessage(authMode === "signup" ? "Hesabın oluşturuluyor…" : "Giriş yapılıyor…", "success");
  try {
    if (authMode === "signup") {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        setAuthMessage("Hesabın oluşturuldu. E-postana gönderilen doğrulama bağlantısına tıklayıp giriş yapabilirsin.", "success");
      }
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (error) {
    console.error("Supabase hesap işlemi başarısız oldu.", error);
    setAuthMessage(error.message || "İşlem tamamlanamadı. Bilgilerini kontrol edip tekrar dene.");
  } finally {
    submitButton.disabled = false;
  }
});

async function signOut() {
  await saveQueue;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error("Oturum kapatılamadı.", error);
    showToast(`Oturum kapatılamadı: ${error.message}`);
  }
}

document.querySelector("#open-account").addEventListener("click", () => {
  document.querySelector("#open-account").setAttribute("aria-expanded", "true");
  accountDialog.showModal();
});
accountDialog.addEventListener("close", () => {
  document.querySelector("#open-account").setAttribute("aria-expanded", "false");
});
document.querySelector("#sign-out").addEventListener("click", signOut);
document.querySelector("#disabled-sign-out").addEventListener("click", signOut);

document.querySelector("#open-password-dialog").addEventListener("click", () => {
  accountDialog.close();
  document.querySelector("#password-form").reset();
  document.querySelector("#password-message").textContent = "";
  passwordDialog.showModal();
});
document.querySelector("#password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.querySelector("#new-password").value;
  const confirmation = document.querySelector("#confirm-password").value;
  const message = document.querySelector("#password-message");
  if (password !== confirmation) {
    message.textContent = "Parolalar birbiriyle eşleşmiyor.";
    return;
  }
  const submit = event.currentTarget.querySelector('[type="submit"]');
  submit.disabled = true;
  message.textContent = "Parola güncelleniyor…";
  message.classList.add("success");
  try {
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw error;
    passwordDialog.close();
    accountDialog.showModal();
    showToast("Parolan güncellendi.");
  } catch (error) {
    console.error("Parola güncellenemedi.", error);
    message.classList.remove("success");
    message.textContent = `Parola güncellenemedi: ${error.message}`;
  } finally {
    submit.disabled = false;
  }
});

async function setAccountActive(isActive) {
  if (!activeUserId) return;
  const result = await supabaseClient.rpc("set_my_account_active", { p_is_active: isActive });
  if (result.error) throw result.error;
  if (result.data !== true) throw new Error("Hesap durumu değiştirilemedi. Supabase schema.sql dosyasını yeniden çalıştır.");
}

document.querySelector("#toggle-account-status").addEventListener("click", async () => {
  const button = document.querySelector("#toggle-account-status");
  button.disabled = true;
  try {
    await saveQueue;
    const isActive = button.textContent.trim() === "Hesabı yeniden aç";
    if (!isActive && !window.confirm("Hesabını geçici olarak kapatmak istiyor musun? Tariflerine erişimi hesabını yeniden açana kadar durduracağız.")) return;
    await setAccountActive(isActive);
    updateAccountStatusUI(isActive);
    if (isActive) {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data.session) throw new Error("Oturum bulunamadı. Yeniden giriş yap.");
      activeUserId = null;
      accountDialog.close();
      await activateSession(data.session);
    } else {
      accountDialog.close();
      document.querySelector("#account-disabled-message").textContent = "Hesabın kapatıldı. Tariflerin güvende ve hesabını istediğin zaman yeniden açabilirsin.";
      setAccountScreen("disabled");
    }
  } catch (error) {
    console.error("Hesap geçici olarak kapatılamadı.", error);
    showToast(`Hesap kapatılamadı: ${error.message}`);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#reactivate-account").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  document.querySelector("#account-disabled-message").textContent = "Hesabın yeniden açılıyor…";
  try {
    await setAccountActive(true);
    updateAccountStatusUI(true);
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("Oturum bulunamadı. Yeniden giriş yap.");
    activeUserId = null;
    await activateSession(data.session);
  } catch (error) {
    console.error("Hesap yeniden açılamadı.", error);
    document.querySelector("#account-disabled-message").textContent = `Hesap açılamadı: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});

window.addEventListener("online", () => {
  if (activeUserId && localStorage.getItem(`${PENDING_SYNC_PREFIX}${activeUserId}`) === "true") saveState();
});

const THEME_KEY = "lokma-theme";
const themeToggle = document.querySelector(".theme-toggle");
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "☀ Açık temaya geç" : "☾ Koyu temaya geç";
  themeToggle.setAttribute("aria-label", theme === "dark" ? "Açık moda geç" : "Koyu moda geç");
  themeToggle.title = theme === "dark" ? "Açık moda geç" : "Koyu moda geç";
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#202720" : "#f7f8f3";
}
applyTheme(localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light");
themeToggle.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

document.querySelector("#profile-email").textContent = "Ev aşçısı";
if (!window.supabase?.createClient) {
  authScreen.classList.remove("loading");
  setAuthMessage("Supabase bağlantı kitaplığı yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile.");
} else {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) {
      window.setTimeout(() => void activateSession(session), 0);
    } else {
      authGeneration += 1;
      activeUserId = null;
      loadingUserId = null;
      accountDialog.close();
      passwordDialog.close();
      setAccountScreen("auth");
      authForm.reset();
      setAuthMode("signin");
    }
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      authScreen.classList.remove("loading");
      setAuthMessage(`Oturum bilgisi alınamadı: ${error.message}`);
    } else if (data.session) {
      void activateSession(data.session);
    } else {
      authScreen.classList.remove("loading");
    }
  }).catch((error) => {
    console.error("Supabase oturumu denetlenemedi.", error);
    authScreen.classList.remove("loading");
    setAuthMessage("Supabase oturumu kontrol edilemedi. İnternet bağlantını kontrol edip tekrar dene.");
  });
}
