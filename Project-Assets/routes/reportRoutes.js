const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const { isAuthenticated } = require("../middleware/auth");
const { calculateMatchScore } = require("../utils/matcher");
const {
    getLocationOptions,
    getCategoryOptions,
    getSubmittedLocation,
    getSubmittedCategory
} = require("../utils/optionHelpers");

// Normalize checkbox query values into a clean array.
// Express gives us either a string, an array, or undefined.
function normalizeCheckboxValues(value) {
    if (Array.isArray(value)) {
        return value
            .map((entry) => String(entry || "").trim())
            .filter((entry) => entry.length > 0);
    }

    if (typeof value === "string" && value.trim()) {
        return [value.trim()];
    }

    return [];
}

// Gets reports from Supabase with search, filtering, sorting, and pagination
router.get("/", isAuthenticated, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const start = (page - 1) * limit;

    const reportView = req.query.view === "archived" ? "archived" : "current";
    const searchQuery = (req.query.search || "").toLowerCase().trim();
    const statusFilter = req.query.status || "all";
    const sortBy = req.query.sortBy || "top";

    // Read selected checkbox filters for locations and categories.
    const selectedLocations = normalizeCheckboxValues(req.query.location);
    const selectedCategories = normalizeCheckboxValues(req.query.category);

    let query = supabase.from("item_reports").select("*");

    if (reportView === "archived") {
        query = query.eq("status", "Resolved");
    } else {
        if (statusFilter === "all") {
            query = query.eq("status", "Open");
        } else {
            query = query.eq("status", statusFilter);
        }
    }

    const { data: allReports, error: reportsError } = await query;

    const { data: allAvailableItems } = await supabase
        .from("lost_items")
        .select("*")
        .in("status", ["available", "pending_pickup"]);

    if (reportsError) {
        console.error("Error fetching reports:", reportsError.message);
    }

    let reports = allReports || [];

    reports.forEach(report => {
        report.matchCount = 0;
        if (reportView === "current" && allAvailableItems && allAvailableItems.length > 0) {
            report.matchCount = allAvailableItems.filter(item => calculateMatchScore(item, report) > 20).length;
        }
    });

    // Apply the text search first.
    if (searchQuery) {
        reports = reports.filter(r =>
            r.id.toString().includes(searchQuery) ||
            (r.missing_item_name || "").toLowerCase().includes(searchQuery) ||
            (r.reporter_name || "").toLowerCase().includes(searchQuery) ||
            (r.reporter_email || "").toLowerCase().includes(searchQuery) ||
            (r.description || "").toLowerCase().includes(searchQuery) ||
            (r.last_known_location || "").toLowerCase().includes(searchQuery)
        );
    }

    // Filter by any checked locations.
    // If "Other" is selected, match values like "Other - Something".
    if (selectedLocations.length > 0) {
        const normalizedLocations = selectedLocations.map((location) => location.toLowerCase());
        const includesOtherLocation = normalizedLocations.includes("other");

        reports = reports.filter((report) => {
            const reportLocation = String(report.last_known_location || "").trim();
            const normalizedReportLocation = reportLocation.toLowerCase();

            const matchesNormalLocation = normalizedLocations.includes(normalizedReportLocation);
            const matchesOtherLocation =
                includesOtherLocation && normalizedReportLocation.startsWith("other -");

            return matchesNormalLocation || matchesOtherLocation;
        });
    }

    // Filter by any checked categories.
    // If "Other" is selected, match values like "Other - Something".
    if (selectedCategories.length > 0) {
        const normalizedCategories = selectedCategories.map((category) => category.toLowerCase());
        const includesOtherCategory = normalizedCategories.includes("other");

        reports = reports.filter((report) => {
            const reportCategory = String(report.category || "").trim();
            const normalizedReportCategory = reportCategory.toLowerCase();

            const matchesNormalCategory = normalizedCategories.includes(normalizedReportCategory);
            const matchesOtherCategory =
                includesOtherCategory && normalizedReportCategory.startsWith("other -");

            return matchesNormalCategory || matchesOtherCategory;
        });
    }

    reports.sort((a, b) => {
        if (sortBy === "top") {
            if (reportView === "current") {
                if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
            }
            return new Date(b.date_lost) - new Date(a.date_lost);
        } else if (sortBy === "matches") {
            if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
            return new Date(b.date_lost) - new Date(a.date_lost);
        } else if (sortBy === "newest") {
            return new Date(b.date_lost) - new Date(a.date_lost);
        } else if (sortBy === "oldest") {
            return new Date(a.date_lost) - new Date(b.date_lost);
        } else if (sortBy === "category") {
            return (a.category || "").localeCompare(b.category || "");
        }
        return 0;
    });

    const totalCount = reports.length;
    const totalPages = Math.ceil(totalCount / limit);
    const paginatedReports = reports.slice(start, start + limit);

    res.render("ViewReports", {
        pageTitle: "UR Lost & Found - Reports",
        currentUser: req.session.user.username,
        reports: paginatedReports,
        currentPage: page,
        totalPages,
        reportView,
        filters: {
            search: searchQuery,
            status: statusFilter,
            sortBy,
            selectedLocations,
            selectedCategories
        },
        locationOptions: getLocationOptions(),
        categoryOptions: getCategoryOptions()
    });
});

// Shows form for creating new report
router.get("/new", isAuthenticated, (req, res) => {
    res.render("NewReport", {
        pageTitle: "UR Lost & Found - New Report",
        currentUser: req.session.user.username,
        isEdit: false,
        report: {},
        locationOptions: getLocationOptions(),
        categoryOptions: getCategoryOptions()
    });
});

// Handles report submission to Supabase
router.post("/", isAuthenticated, async (req, res) => {
    const finalCategory = getSubmittedCategory(req);
    const finalLocation = getSubmittedLocation(req);

    const { error } = await supabase
        .from("item_reports")
        .insert([
            {
                reporter_name: req.body.reporterName,
                reporter_email: req.body.reporterEmail,
                phone_number: req.body.reporterPhone,
                missing_item_name: req.body.itemName,
                category: finalCategory,
                date_lost: req.body.dateLost,
                last_known_location: finalLocation,
                description: req.body.description,
                distinguishing_features: req.body.distinguishingFeatures,
                status: req.body.status || "Open",
                owner_id: req.session.user.id
            }
        ]);

    if (error) {
        console.error("Error inserting report:", error.message);
    }

    res.redirect("/reports");
});

// Finds report with matching ID and opens edit form
router.get("/:id/edit", isAuthenticated, async (req, res) => {
    const { data: report, error } = await supabase
        .from("item_reports")
        .select("*")
        .eq("id", req.params.id)
        .single();

    if (error || !report) {
        console.error("Error fetching report for edit:", error ? error.message : "Not found");
        return res.redirect("/reports");
    }

    res.render("NewReport", {
        pageTitle: "UR Lost & Found - Edit Report",
        currentUser: req.session.user.username,
        isEdit: true,
        report,
        locationOptions: getLocationOptions(),
        categoryOptions: getCategoryOptions()
    });
});

// Updates existing report in Supabase
router.post("/:id", isAuthenticated, async (req, res) => {
    const { data: existingReport, error: fetchError } = await supabase
        .from("item_reports")
        .select("*")
        .eq("id", req.params.id)
        .single();

    if (fetchError || !existingReport) {
        console.error("Error fetching existing report before update:", fetchError ? fetchError.message : "Not found");
        return res.redirect(req.body.redirectTo || "/reports");
    }

    const submittedCategory = getSubmittedCategory(req);
    const submittedLocation = getSubmittedLocation(req);

    const finalCategory = submittedCategory || existingReport.category;
    const finalLocation = submittedLocation || existingReport.last_known_location;

    const updateData = {
        reporter_name: req.body.reporterName || existingReport.reporter_name,
        reporter_email: req.body.reporterEmail || existingReport.reporter_email,
        phone_number: req.body.reporterPhone || existingReport.phone_number,
        missing_item_name: req.body.itemName || existingReport.missing_item_name,
        category: finalCategory,
        date_lost: req.body.dateLost || existingReport.date_lost,
        last_known_location: finalLocation,
        description: req.body.description || existingReport.description,
        distinguishing_features: req.body.distinguishingFeatures || existingReport.distinguishing_features,
        status: req.body.status || existingReport.status || "Open"
    };

    const { error } = await supabase
        .from("item_reports")
        .update(updateData)
        .eq("id", req.params.id);

    if (error) {
        console.error("Error updating report:", error.message);
    }

    res.redirect(req.body.redirectTo || "/reports");
});

// Deletes report from Supabase
router.post("/:id/delete", isAuthenticated, async (req, res) => {
    const { error } = await supabase
        .from("item_reports")
        .delete()
        .eq("id", req.params.id);

    if (error) {
        console.error("Error deleting report:", error.message);
    }

    res.redirect("/reports");
});

// Archives a report
router.post("/:id/archive", isAuthenticated, async (req, res) => {
    const { error } = await supabase
        .from("item_reports")
        .update({ status: "Resolved" })
        .eq("id", req.params.id);

    if (error) {
        console.error("Error archiving report:", error.message);
        return res.status(500).send(error.message);
    }

    res.redirect(req.body.redirectTo || "/reports?view=current");
});

module.exports = router;