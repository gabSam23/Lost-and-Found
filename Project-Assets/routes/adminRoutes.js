const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const { isAuthenticated } = require("../middleware/auth");
const {
    getLocationOptions,
    getCategoryOptions,
    addLocationOption,
    addCategoryOption,
    editLocationOption,
    editCategoryOption,
    deleteLocationOption,
    deleteCategoryOption
} = require("../utils/optionHelpers");

// Build a small message object for the customize pages
function buildPageMessage(query) {
    const type = String(query.messageType || "").trim();
    const text = String(query.messageText || "").trim();

    if (!type || !text) {
        return null;
    }

    return {
        type,
        text
    };
}

// Count how many records currently use a saved location
async function countLocationUsage(value) {
    const [itemsResult, reportsResult] = await Promise.all([
        supabase
            .from("lost_items")
            .select("id", { count: "exact", head: true })
            .eq("location", value),
        supabase
            .from("item_reports")
            .select("id", { count: "exact", head: true })
            .eq("last_known_location", value)
    ]);

    return {
        itemsCount: itemsResult.count || 0,
        reportsCount: reportsResult.count || 0,
        itemsError: itemsResult.error,
        reportsError: reportsResult.error
    };
}

// Count how many records currently use a saved category
async function countCategoryUsage(value) {
    const [itemsResult, reportsResult] = await Promise.all([
        supabase
            .from("lost_items")
            .select("id", { count: "exact", head: true })
            .eq("category", value),
        supabase
            .from("item_reports")
            .select("id", { count: "exact", head: true })
            .eq("category", value)
    ]);

    return {
        itemsCount: itemsResult.count || 0,
        reportsCount: reportsResult.count || 0,
        itemsError: itemsResult.error,
        reportsError: reportsResult.error
    };
}

// Shows the page for managing saved locations
router.get("/locations", isAuthenticated, async (req, res) => {
    res.render("CustomizeLocations", {
        pageTitle: "UR Lost & Found - Customize Locations",
        currentUser: req.session.user.username,
        locationOptions: await getLocationOptions(),
        pageMessage: buildPageMessage(req.query)
    });
});

// Shows the page for managing saved categories
router.get("/categories", isAuthenticated, async (req, res) => {
    res.render("CustomizeCategories", {
        pageTitle: "UR Lost & Found - Customize Categories",
        currentUser: req.session.user.username,
        categoryOptions: await getCategoryOptions(),
        pageMessage: buildPageMessage(req.query)
    });
});

// Adds a new saved location
router.post("/locations/add", isAuthenticated, async (req, res) => {
    const newLocation = String(req.body.newLocation || "").trim();
    await addLocationOption(newLocation);
    res.redirect("/admin/locations");
});

// Adds a new saved category
router.post("/categories/add", isAuthenticated, async (req, res) => {
    const newCategory = String(req.body.newCategory || "").trim();
    await addCategoryOption(newCategory);
    res.redirect("/admin/categories");
});

// Updates an existing saved location option
router.post("/options/location/edit", isAuthenticated, async (req, res) => {
    const oldValue = String(req.body.oldValue || "").trim();
    const newValue = String(req.body.newValue || "").trim();

    const changed = await editLocationOption(oldValue, newValue);

    // If the location label changed, update matching item/report records too
    if (changed && oldValue.toLowerCase() !== newValue.toLowerCase()) {
        await supabase.from("lost_items").update({ location: newValue }).eq("location", oldValue);
        await supabase.from("item_reports").update({ last_known_location: newValue }).eq("last_known_location", oldValue);
    }

    res.redirect(req.body.redirectTo || "/admin/locations");
});

// Deletes a saved location option only if no items or reports still use it
router.post("/options/location/delete", isAuthenticated, async (req, res) => {
    const value = String(req.body.value || "").trim();

    if (!value) {
        return res.redirect("/admin/locations");
    }

    const usage = await countLocationUsage(value);

    if (usage.itemsError || usage.reportsError) {
        console.error("Error checking location usage:", usage.itemsError || usage.reportsError);
        return res.redirect(
            "/admin/locations?messageType=danger&messageText=" +
            encodeURIComponent("Could not verify whether that location is in use. No changes were made.")
        );
    }

    if (usage.itemsCount > 0 || usage.reportsCount > 0) {
        return res.redirect(
            "/admin/locations?messageType=warning&messageText=" +
            encodeURIComponent(
                `Cannot delete "${value}" because it is still used by ${usage.itemsCount} item(s) and ${usage.reportsCount} report(s).`
            )
        );
    }

    await deleteLocationOption(value);
    res.redirect("/admin/locations");
});

// Updates an existing saved category option
router.post("/options/category/edit", isAuthenticated, async (req, res) => {
    const oldValue = String(req.body.oldValue || "").trim();
    const newValue = String(req.body.newValue || "").trim();

    const changed = await editCategoryOption(oldValue, newValue);

    // If the category label changed, update matching item/report records too
    if (changed && oldValue.toLowerCase() !== newValue.toLowerCase()) {
        await supabase.from("lost_items").update({ category: newValue }).eq("category", oldValue);
        await supabase.from("item_reports").update({ category: newValue }).eq("category", oldValue);
    }

    res.redirect(req.body.redirectTo || "/admin/categories");
});

// Deletes a saved category option only if no items or reports still use it
router.post("/options/category/delete", isAuthenticated, async (req, res) => {
    const value = String(req.body.value || "").trim();

    if (!value) {
        return res.redirect("/admin/categories");
    }

    const usage = await countCategoryUsage(value);

    if (usage.itemsError || usage.reportsError) {
        console.error("Error checking category usage:", usage.itemsError || usage.reportsError);
        return res.redirect(
            "/admin/categories?messageType=danger&messageText=" +
            encodeURIComponent("Could not verify whether that category is in use. No changes were made.")
        );
    }

    if (usage.itemsCount > 0 || usage.reportsCount > 0) {
        return res.redirect(
            "/admin/categories?messageType=warning&messageText=" +
            encodeURIComponent(
                `Cannot delete "${value}" because it is still used by ${usage.itemsCount} item(s) and ${usage.reportsCount} report(s).`
            )
        );
    }

    await deleteCategoryOption(value);
    res.redirect("/admin/categories");
});

module.exports = router;