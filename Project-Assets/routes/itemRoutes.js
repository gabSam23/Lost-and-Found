const express = require("express");
const router = express.Router();
const multer = require("multer");
const supabase = require("../config/supabaseClient");
const { isAuthenticated } = require("../middleware/auth");
const { calculateMatchScore } = require("../utils/matcher");
const { 
    getLocationOptions, 
    getCategoryOptions, 
    getSubmittedLocation, 
    getSubmittedCategory 
} = require("../utils/optionHelpers");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Gets items from Supabase with search, filtering, sorting, and pagination
router.get("/", isAuthenticated, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const start = (page - 1) * limit;

    const inventoryView = req.query.view === "archived" ? "archived" : "current";
    const searchQuery = (req.query.search || "").toLowerCase().trim();
    const statusFilter = req.query.status || "all";
    const sortBy = req.query.sortBy || "top";

    let query = supabase.from("lost_items").select("*");
    
    if (inventoryView === "archived") {
        query = query.eq("status", "returned");
    } else {
        if (statusFilter === "all") {
            query = query.neq("status", "returned");
        } else {
            query = query.eq("status", statusFilter);
        }
    }

    const { data: allItems, error: itemsError } = await query;

    const { data: allOpenReports } = await supabase
        .from("item_reports")
        .select("*")
        .eq("status", "Open");

    if (itemsError) {
        console.error("Error fetching items:", itemsError.message);
    }

    let items = allItems || [];

    items.forEach(item => {
        item.matchCount = 0;
        if (inventoryView === "current" && allOpenReports && allOpenReports.length > 0) {
            item.matchCount = allOpenReports.filter(report => calculateMatchScore(item, report) > 20).length;
        }
    });

    if (searchQuery) {
        items = items.filter(item => 
            item.id.toString().includes(searchQuery) ||
            (item.description || "").toLowerCase().includes(searchQuery) ||
            (item.category || "").toLowerCase().includes(searchQuery) ||
            (item.location || "").toLowerCase().includes(searchQuery)
        );
    }

    items.sort((a, b) => {
        if (sortBy === "top") {
            if (inventoryView === "current") {
                const statusPriority = { 'available': 0, 'pending_pickup': 1 };
                const aPrio = statusPriority[a.status] ?? 2;
                const bPrio = statusPriority[b.status] ?? 2;
                if (aPrio !== bPrio) return aPrio - bPrio;
                if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
            }
            return new Date(b.created_at) - new Date(a.created_at);
        } else if (sortBy === "matches") {
            if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
            return new Date(b.created_at) - new Date(a.created_at);
        } else if (sortBy === "newest") {
            return new Date(b.created_at) - new Date(a.created_at);
        } else if (sortBy === "oldest") {
            return new Date(a.created_at) - new Date(b.created_at);
        } else if (sortBy === "category") {
            return (a.category || "").localeCompare(b.category || "");
        }
        return 0;
    });

    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / limit);
    const paginatedItems = items.slice(start, start + limit);

    res.render("ViewItems", {
        pageTitle: "UR Lost & Found - Storage",
        currentUser: req.session.user.username,
        items: paginatedItems,
        currentPage: page,
        totalPages,
        inventoryView,
        filters: { search: searchQuery, status: statusFilter, sortBy },
        locationOptions: getLocationOptions(),
        categoryOptions: getCategoryOptions()
    });
});

// Shows form for creating a new item
router.get("/new", isAuthenticated, (req, res) => {
    res.render("NewItem", {
        pageTitle: "UR Lost & Found - Log New Item",
        currentUser: req.session.user.username,
        isEdit: false,
        item: {},
        locationOptions: getLocationOptions(),
        categoryOptions: getCategoryOptions()
    });
});

// Saves Data in Supabase with Image Upload
router.post("/", isAuthenticated, upload.single("itemImage"), async (req, res) => {
    let imageUrl = null;

    if (req.file) {
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const { data, error } = await supabase.storage
            .from("item-images")
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (error) {
            console.error("Error uploading image:", error.message);
        } else {
            const { data: publicUrlData } = supabase.storage
                .from("item-images")
                .getPublicUrl(fileName);
            imageUrl = publicUrlData.publicUrl;
        }
    }

    const finalLocation = getSubmittedLocation(req);
    const finalCategory = getSubmittedCategory(req);

    const { error } = await supabase
        .from("lost_items")
        .insert([
            {
                location: finalLocation,
                category: finalCategory,
                description: req.body.description,
                image_url: imageUrl,
                owner_id: req.session.user.id
            }
        ]);

    if (error) {
        console.error("Error inserting item:", error.message);
    }

    res.redirect("/items");
});

// Archives an item by setting its status to "returned"
router.post("/:id/archive", isAuthenticated, async (req, res) => {
    const { error } = await supabase
        .from("lost_items")
        .update({ status: "returned" })
        .eq("id", req.params.id);

    if (error) {
        console.error("Error archiving item:", error.message);
    }

    res.redirect(req.body.redirectTo || "/items?view=current");
});

// Shows edit form for existing item
router.get("/:id/edit", isAuthenticated, async (req, res) => {
    const { data: item, error } = await supabase
        .from("lost_items")
        .select("*")
        .eq("id", req.params.id)
        .single();

    if (error || !item) {
        console.error("Error fetching item for edit:", error ? error.message : "Not found");
        return res.redirect("/items");
    }

    res.render("NewItem", {
        pageTitle: "UR Lost & Found - Edit Item",
        currentUser: req.session.user.username,
        isEdit: true,
        item,
        locationOptions: getLocationOptions(),
        categoryOptions: getCategoryOptions()
    });
});

// Updates existing item in Supabase
router.post("/:id", isAuthenticated, upload.single("itemImage"), async (req, res) => {
    let imageUrl = null;

    if (req.file) {
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const { data, error } = await supabase.storage
            .from("item-images")
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (error) {
            console.error("Error uploading image:", error.message);
        } else {
            const { data: publicUrlData } = supabase.storage
                .from("item-images")
                .getPublicUrl(fileName);
            imageUrl = publicUrlData.publicUrl;
        }
    }

    const finalLocation = getSubmittedLocation(req);
    const finalCategory = getSubmittedCategory(req);

    const updateData = {
        location: finalLocation,
        category: finalCategory,
        description: req.body.description,
        status: req.body.status || 'available',
        claim_notes: req.body.claim_notes || ''
    };

    if (imageUrl) {
        updateData.image_url = imageUrl;
    }

    const { error } = await supabase
        .from("lost_items")
        .update(updateData)
        .eq("id", req.params.id);

    if (error) {
        console.error("Error updating item:", error.message);
    }

    res.redirect(req.body.redirectTo || "/items?view=current");
});

// Deletes item from Supabase
router.post("/:id/delete", isAuthenticated, async (req, res) => {
    const { error } = await supabase
        .from("lost_items")
        .delete()
        .eq("id", req.params.id);

    if (error) {
        console.error("Error deleting item:", error.message);
    }

    res.redirect("/items");
});

module.exports = router;