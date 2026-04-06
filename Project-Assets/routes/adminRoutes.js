const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const { isAuthenticated } = require("../middleware/auth");
const { 
    getLocationOptions, 
    getCategoryOptions, 
    addOption, 
    editOption, 
    deleteOption,
    locationsPath,
    categoriesPath,
    DEFAULT_LOCATIONS,
    DEFAULT_CATEGORIES,
    legacyCustomLocationsPath,
    legacyCustomCategoriesPath
} = require("../utils/optionHelpers");

// --- Admin Views ---

// Shows the page for managing saved locations
router.get("/locations", isAuthenticated, (req, res) => {
    res.render("CustomizeLocations", {
        pageTitle: "UR Lost & Found - Customize Locations",
        currentUser: req.session.user.username,
        locationOptions: getLocationOptions()
    });
});

// Shows the page for managing saved categories
router.get("/categories", isAuthenticated, (req, res) => {
    res.render("CustomizeCategories", {
        pageTitle: "UR Lost & Found - Customize Categories",
        currentUser: req.session.user.username,
        categoryOptions: getCategoryOptions()
    });
});

// --- Admin Actions (Add) ---

// Adds a new saved location
router.post("/locations/add", isAuthenticated, (req, res) => {
    const newLocation = (req.body.newLocation || "").trim();
    addOption(locationsPath, DEFAULT_LOCATIONS, legacyCustomLocationsPath, newLocation);
    res.redirect("/admin/locations");
});

// Adds a new saved category
router.post("/categories/add", isAuthenticated, (req, res) => {
    const newCategory = (req.body.newCategory || "").trim();
    addOption(categoriesPath, DEFAULT_CATEGORIES, legacyCustomCategoriesPath, newCategory);
    res.redirect("/admin/categories");
});

// --- Option Actions (Edit/Delete) ---

// Updates an existing saved location option
router.post("/options/location/edit", isAuthenticated, async (req, res) => {
    const oldValue = (req.body.oldValue || "").trim();
    const newValue = (req.body.newValue || "").trim();

    const changed = editOption(locationsPath, DEFAULT_LOCATIONS, legacyCustomLocationsPath, oldValue, newValue);

    if (changed && oldValue.toLowerCase() !== newValue.toLowerCase()) {
        await supabase.from("lost_items").update({ location: newValue }).eq("location", oldValue);
        await supabase.from("item_reports").update({ last_known_location: newValue }).eq("last_known_location", oldValue);
    }

    res.redirect(req.body.redirectTo || "/items/new");
});

// Deletes a saved location option
router.post("/options/location/delete", isAuthenticated, (req, res) => {
    const value = (req.body.value || "").trim();
    deleteOption(locationsPath, DEFAULT_LOCATIONS, legacyCustomLocationsPath, value);
    res.redirect(req.body.redirectTo || "/items/new");
});

// Updates an existing saved category option
router.post("/options/category/edit", isAuthenticated, async (req, res) => {
    const oldValue = (req.body.oldValue || "").trim();
    const newValue = (req.body.newValue || "").trim();

    const changed = editOption(categoriesPath, DEFAULT_CATEGORIES, legacyCustomCategoriesPath, oldValue, newValue);

    if (changed && oldValue.toLowerCase() !== newValue.toLowerCase()) {
        await supabase.from("lost_items").update({ category: newValue }).eq("category", oldValue);
        await supabase.from("item_reports").update({ category: newValue }).eq("category", oldValue);
    }

    res.redirect(req.body.redirectTo || "/items/new");
});

// Deletes a saved category option
router.post("/options/category/delete", isAuthenticated, (req, res) => {
    const value = (req.body.value || "").trim();
    deleteOption(categoriesPath, DEFAULT_CATEGORIES, legacyCustomCategoriesPath, value);
    res.redirect(req.body.redirectTo || "/items/new");
});

module.exports = router;