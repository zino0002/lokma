const STORAGE_KEY = "lokma-kitchen-v1";
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

let state = loadState();
let activeCategory = "all";
let activeView = "week";
let recipeForDetails = null;
let toastTimer;

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  const todayIndex = (new Date().getDay() + 6) % 7;
  elements.daysGrid.innerHTML = DAY_NAMES.map((dayName, index) => {
    const meals = state.meals.filter((meal) => meal.dayOfWeek === index).sort((a, b) => a.time.localeCompare(b.time));
    const isToday = index === todayIndex;
    return `<article class="day-card${isToday ? " today" : ""}">
      <div class="day-heading">
        <div class="day-title"><strong>${dayName}</strong>${isToday ? '<span class="today-label">BUGÜN</span>' : ""}</div>
        <button class="add-day-meal" data-add-day="${index}" aria-label="${dayName} için yemek ekle">＋</button>
      </div>
      ${meals.length ? `<div class="meal-list">${meals.map((meal) => {
        const recipe = getRecipe(meal.recipeId);
        const category = recipe && getCategory(recipe.categoryId);
        if (!recipe) return "";
        return `<div class="meal-item${meal.completed ? " completed" : ""}">
          <input class="meal-check" type="checkbox" data-toggle-meal="${meal.id}" ${meal.completed ? "checked" : ""} aria-label="${escapeHtml(recipe.name)} tamamlandı" />
          <div class="meal-info"><span class="meal-name">${escapeHtml(recipe.name)}</span><span class="meal-category">${escapeHtml(category?.name || "Tarif")}</span></div>
          <span class="meal-time">${escapeHtml(meal.time)}</span>
          <button class="remove-meal" data-remove-meal="${meal.id}" aria-label="Yemek planından çıkar">×</button>
        </div>`;
      }).join("")}</div>` : '<p class="empty-day">Henüz plan yok. Bir yemek ekle!</p>'}
    </article>`;
  }).join("");
  elements.daysGrid.querySelectorAll("[data-add-day]").forEach((button) => button.addEventListener("click", () => openRecipeForm({ day: Number(button.dataset.addDay) })));
  elements.daysGrid.querySelectorAll("[data-toggle-meal]").forEach((checkbox) => checkbox.addEventListener("change", () => {
    const meal = state.meals.find((item) => item.id === checkbox.dataset.toggleMeal);
    if (!meal) return;
    meal.completed = checkbox.checked;
    saveState();
    renderWeek();
  }));
  elements.daysGrid.querySelectorAll("[data-remove-meal]").forEach((button) => button.addEventListener("click", () => {
    state.meals = state.meals.filter((meal) => meal.id !== button.dataset.removeMeal);
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
    state.meals.push({ id: makeId("meal"), recipeId: selectedRecipeId, dayOfWeek: Number(day), time: String(form.get("time") || "18:30"), completed: false });
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
  if (day !== "") state.meals.push({ id: makeId("meal"), recipeId: recipe.id, dayOfWeek: Number(day), time: String(form.get("time") || "18:30"), completed: false });
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
document.querySelector("#add-week-meal").addEventListener("click", () => {
  openRecipeForm({ day: (new Date().getDay() + 6) % 7 });
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

const THEME_KEY = "lokma-theme";
const themeToggle = document.querySelector(".theme-toggle");
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "☀" : "☾";
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

renderAll();
