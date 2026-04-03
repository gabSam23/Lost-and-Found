const express = require("express"); // Imports Express so we can create the web server
const fs = require("fs"); // Lets us read and write files
const path = require("path"); // Helps build file/folder paths safely
const session = require("express-session"); // For secure session management
const multer = require("multer"); // For handling file uploads
const supabase = require("./config/supabaseClient"); // Import Supabase client

const app = express(); // Creates the Express app
const port = process.env.PORT || 3000; // Uses the environment port if available, otherwise 3000

// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Build absolute paths to important folders/files in the project
const viewsPath = path.join(__dirname, "views");
const publicPath = path.join(__dirname, "public");
const dataPath = path.join(__dirname, "data");
// Path to the older custom locations JSON file
const legacyCustomLocationsPath = path.join(dataPath, "customLocations.json");

// Path to the older custom categories JSON file
const legacyCustomCategoriesPath = path.join(dataPath, "customCategories.json");

// Path to the main shared locations JSON file
const locationsPath = path.join(dataPath, "locations.json");

// Path to the main shared categories JSON file
const categoriesPath = path.join(dataPath, "categories.json");

// Default locations used to seed the locations file if needed
const DEFAULT_LOCATIONS = [
    "Classroom Building",
    "Riddell Centre",
    "Library",
    "Residence"
];

// Default categories used to seed the categories file if needed
const DEFAULT_CATEGORIES = [
    "Accessories",
    "Electronics",
    "Identification",
    "Clothing"
];

// Cleans a list of options by:
// 1) making sure values are trimmed
// 2) removing empty values
// 3) removing duplicates without caring about uppercase/lowercase
function normalizeOptionList(values) {
    const cleaned = [];

    (Array.isArray(values) ? values : []).forEach((value) => {
        const normalizedValue = (value || "").trim();

        if (
            normalizedValue &&
            !cleaned.some(
                (existingValue) =>
                    existingValue.toLowerCase() === normalizedValue.toLowerCase()
            )
        ) {
            cleaned.push(normalizedValue);
        }
    });

    return cleaned;
}

// Reads an old legacy JSON file if it exists
// Returns an empty array if the file does not exist or cannot be read
function readLegacyArray(filePath) {
    if (!fs.existsSync(filePath)) {
        return [];
    }

    try {
        const fileData = fs.readFileSync(filePath, "utf8");
        const parsedData = JSON.parse(fileData);
        return normalizeOptionList(parsedData);
    } catch (error) {
        return [];
    }
}

// Makes sure the option file exists and contains valid JSON
// If the file does not exist, create it using defaults + legacy values
// If the file exists but is invalid, reset it using default values
function ensureOptionFile(filePath, defaultValues, legacyPath) {
    if (!fs.existsSync(filePath)) {
        const seededValues = normalizeOptionList([
            ...defaultValues,
            ...readLegacyArray(legacyPath)
        ]);

        fs.writeFileSync(
            filePath,
            JSON.stringify(seededValues, null, 2),
            "utf8"
        );
        return;
    }

    try {
        const fileData = fs.readFileSync(filePath, "utf8");
        const parsedData = JSON.parse(fileData);

        // Make sure the JSON file contains an array
        if (!Array.isArray(parsedData)) {
            throw new Error("Invalid option file format");
        }

        const normalizedValues = normalizeOptionList(parsedData);

        // Rewrite the file only if cleanup changed the contents
        if (JSON.stringify(parsedData) !== JSON.stringify(normalizedValues)) {
            fs.writeFileSync(
                filePath,
                JSON.stringify(normalizedValues, null, 2),
                "utf8"
            );
        }
    } catch (error) {
        fs.writeFileSync(
            filePath,
            JSON.stringify(normalizeOptionList(defaultValues), null, 2),
            "utf8"
        );
    }
}

// Reads the main option file safely
// First ensures the file exists and is valid
function readOptionFile(filePath, defaultValues, legacyPath) {
    ensureOptionFile(filePath, defaultValues, legacyPath);

    try {
        const fileData = fs.readFileSync(filePath, "utf8");
        const parsedData = JSON.parse(fileData);
        return normalizeOptionList(parsedData);
    } catch (error) {
        console.error("Error reading option file:", error.message);
        return normalizeOptionList(defaultValues);
    }
}

// Writes a cleaned option list into a JSON file
function writeOptionFile(filePath, values) {
    fs.writeFileSync(
        filePath,
        JSON.stringify(normalizeOptionList(values), null, 2),
        "utf8"
    );
}

// Adds a new option only if it is not empty and not already in the file
function addOption(filePath, defaultValues, legacyPath, value) {
    const cleanedValue = (value || "").trim();

    // Stop if the new value is empty
    if (!cleanedValue) return;

    const existingValues = readOptionFile(filePath, defaultValues, legacyPath);

    // Stop if the value already exists (case-insensitive)
    if (
        existingValues.some(
            (existingValue) =>
                existingValue.toLowerCase() === cleanedValue.toLowerCase()
        )
    ) {
        return;
    }

    // Add the new value and save the file again
    existingValues.push(cleanedValue);
    writeOptionFile(filePath, existingValues);
}

// Edits an existing option
// Returns true if the edit worked, otherwise false
function editOption(filePath, defaultValues, legacyPath, oldValue, newValue) {
    const cleanedOldValue = (oldValue || "").trim();
    const cleanedNewValue = (newValue || "").trim();

    // Stop if either value is empty
    if (!cleanedOldValue || !cleanedNewValue) {
        return false;
    }

    const existingValues = readOptionFile(filePath, defaultValues, legacyPath);

    // Find the existing value that should be changed
    const oldIndex = existingValues.findIndex(
        (existingValue) =>
            existingValue.toLowerCase() === cleanedOldValue.toLowerCase()
    );

    // Stop if the old value was not found
    if (oldIndex === -1) {
        return false;
    }

    // Stop if the new value already exists somewhere else in the list
    const duplicateIndex = existingValues.findIndex(
        (existingValue, index) =>
            index !== oldIndex &&
            existingValue.toLowerCase() === cleanedNewValue.toLowerCase()
    );

    if (duplicateIndex !== -1) {
        return false;
    }

    // Replace the old value with the new value and save
    existingValues[oldIndex] = cleanedNewValue;
    writeOptionFile(filePath, existingValues);
    return true;
}

// Deletes an option from the JSON file
// Returns true if something was deleted, otherwise false
function deleteOption(filePath, defaultValues, legacyPath, value) {
    const cleanedValue = (value || "").trim();

    // Stop if the value is empty
    if (!cleanedValue) return false;

    const existingValues = readOptionFile(filePath, defaultValues, legacyPath);

    // Remove the matching value from the list
    const filteredValues = existingValues.filter(
        (existingValue) =>
            existingValue.toLowerCase() !== cleanedValue.toLowerCase()
    );

    // If the length did not change, nothing was deleted
    if (filteredValues.length === existingValues.length) {
        return false;
    }

    // Save the updated list
    writeOptionFile(filePath, filteredValues);
    return true;
}

// Returns the saved list of location options
function getLocationOptions() {
    return readOptionFile(
        locationsPath,
        DEFAULT_LOCATIONS,
        legacyCustomLocationsPath
    );
}

// Returns the saved list of category options
function getCategoryOptions() {
    return readOptionFile(
        categoriesPath,
        DEFAULT_CATEGORIES,
        legacyCustomCategoriesPath
    );
}

// Builds the final location value from the submitted form
function getSubmittedLocation(req) {
    const selectedLocation = String(req.body.location || "").trim();
    const otherLocation = String(req.body.otherLocation || "").trim();

    // If the user selected "Other", save it as:
    // Other - whatever they typed
    if (selectedLocation === "__other__") {
        return otherLocation ? `Other - ${otherLocation}` : "";
    }

    // Otherwise return the selected location from the dropdown
    return selectedLocation;
}

// Builds the final category value from the submitted form
function getSubmittedCategory(req) {
    const selectedCategory = String(req.body.category || "").trim();
    const otherCategory = String(req.body.otherCategory || "").trim();

    // If the user selected "Other", save it as:
    // Other - whatever they typed
    if (selectedCategory === "__other__") {
        return otherCategory ? `Other - ${otherCategory}` : "";
    }

    // Otherwise return the selected category from the dropdown
    return selectedCategory;
}


// Tell Express to use EJS as the template engine
app.set("view engine", "ejs");
app.set("views", viewsPath);

// Serve static files from the public folder
app.use(express.static(publicPath));

// Allows Express to read form data sent through POST requests
app.use(express.urlencoded({ extended: true }));

// Configure Session middleware
app.use(session({
    secret: 'ur-lost-and-found-secret-key', // In production, use a secure env variable
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

/**
 * Authentication Middleware
 * Protects routes by checking if a user is logged in via session.
 */
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect("/?error=auth");
}
// Updates an existing saved location option
app.post("/options/location/edit", isAuthenticated, async (req, res) => {
    // Read the old and new location values from the submitted form
    const oldValue = (req.body.oldValue || "").trim();
    const newValue = (req.body.newValue || "").trim();

    // Update the location inside the shared JSON options file
    const changed = editOption(
        locationsPath,
        DEFAULT_LOCATIONS,
        legacyCustomLocationsPath,
        oldValue,
        newValue
    );

    // If the location name actually changed, also update existing records in Supabase
    if (changed && oldValue.toLowerCase() !== newValue.toLowerCase()) {
        // Update matching locations in lost items
        await supabase
            .from("lost_items")
            .update({ location: newValue })
            .eq("location", oldValue);

        // Update matching locations in item reports
        await supabase
            .from("item_reports")
            .update({ last_known_location: newValue })
            .eq("last_known_location", oldValue);
    }

    // Send the user back to the page they came from
    res.redirect(req.body.redirectTo || "/items/new");
});

// Deletes a saved location option
app.post("/options/location/delete", isAuthenticated, (req, res) => {
    // Read the location value that should be deleted
    const value = (req.body.value || "").trim();

    // Remove the location from the shared JSON options file
    deleteOption(
        locationsPath,
        DEFAULT_LOCATIONS,
        legacyCustomLocationsPath,
        value
    );

    // Send the user back to the page they came from
    res.redirect(req.body.redirectTo || "/items/new");
});

// Updates an existing saved category option
app.post("/options/category/edit", isAuthenticated, async (req, res) => {
    // Read the old and new category values from the submitted form
    const oldValue = (req.body.oldValue || "").trim();
    const newValue = (req.body.newValue || "").trim();

    // Update the category inside the shared JSON options file
    const changed = editOption(
        categoriesPath,
        DEFAULT_CATEGORIES,
        legacyCustomCategoriesPath,
        oldValue,
        newValue
    );

    // If the category name actually changed, also update existing records in Supabase
    if (changed && oldValue.toLowerCase() !== newValue.toLowerCase()) {
        // Update matching categories in lost items
        await supabase
            .from("lost_items")
            .update({ category: newValue })
            .eq("category", oldValue);

        // Update matching categories in item reports
        await supabase
            .from("item_reports")
            .update({ category: newValue })
            .eq("category", oldValue);
    }

    // Send the user back to the page they came from
    res.redirect(req.body.redirectTo || "/items/new");
});

// Deletes a saved category option
app.post("/options/category/delete", isAuthenticated, (req, res) => {
    // Read the category value that should be deleted
    const value = (req.body.value || "").trim();

    // Remove the category from the shared JSON options file
    deleteOption(
        categoriesPath,
        DEFAULT_CATEGORIES,
        legacyCustomCategoriesPath,
        value
    );

    // Send the user back to the page they came from
    res.redirect(req.body.redirectTo || "/items/new");
});


//Shows Login page and error/logout messages
app.get("/", (req, res) => {
    let errorMessage = "";
    if (req.query.error === "1") errorMessage = "Invalid username or password.";
    if (req.query.error === "auth") errorMessage = "Please log in to access that page.";

    res.render("Login", {
        pageTitle: "UR Lost & Found - Login",
        errorMessage,
        logoutMessage: req.query.logout ? "You have been signed out." : ""
    });
});


//Reads email, then checks Supabase and handles errors and login passing
app.post("/login", async (req, res) => {
    const submittedEmail = (req.body.email || "").trim();
    const submittedPassword = req.body.password || "";

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: submittedEmail,
        password: submittedPassword
    });

    // If login is not successful, send them back to login with an error
    if (authError || !authData.user) {
        console.error("Login error:", authError ? authError.message : "No user data");
        return res.redirect("/?error=1");
    }

    // Try to get the username from the profiles table
    const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", authData.user.id)
        .single();

    // Store user data in session
    req.session.user = {
        id: authData.user.id,
        email: authData.user.email,
        username: profile ? profile.username : submittedEmail.split("@")[0]
    };

    // If login is successful, send them to the home page
    return res.redirect("/home");
});

// Shows the page for managing saved locations
app.get("/admin/locations", isAuthenticated, (req, res) => {
    res.render("CustomizeLocations", {
        pageTitle: "UR Lost & Found - Customize Locations",
        currentUser: req.session.user.username,
        locationOptions: getLocationOptions()
    });
});

// Shows the page for managing saved categories
app.get("/admin/categories", isAuthenticated, (req, res) => {
    res.render("CustomizeCategories", {
        pageTitle: "UR Lost & Found - Customize Categories",
        currentUser: req.session.user.username,
        categoryOptions: getCategoryOptions()
    });
});

// Adds a new saved location from the locations admin page
app.post("/admin/locations/add", isAuthenticated, (req, res) => {
    const newLocation = (req.body.newLocation || "").trim();

    // Save the location into the shared locations list
    addOption(
        locationsPath,
        DEFAULT_LOCATIONS,
        legacyCustomLocationsPath,
        newLocation
    );

    // Go back to the locations admin page
    res.redirect("/admin/locations");
});

// Adds a new saved category from the categories admin page
app.post("/admin/categories/add", isAuthenticated, (req, res) => {
    const newCategory = (req.body.newCategory || "").trim();

    // Save the category into the shared categories list
    addOption(
        categoriesPath,
        DEFAULT_CATEGORIES,
        legacyCustomCategoriesPath,
        newCategory
    );

    // Go back to the categories admin page
    res.redirect("/admin/categories");
});

//Logout handling
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/?logout=1");
});

//Renders homepage
app.get("/home", isAuthenticated, (req, res) => {
    res.render("Home", {
        pageTitle: "UR Lost & Found - Home",
        currentUser: req.session.user.username
    });
});

//Gets items from Supabase with pagination
app.get("/items", isAuthenticated, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // Get total count of items that are NOT returned
    const { count } = await supabase
        .from("lost_items")
        .select("*", { count: 'exact', head: true })
        .neq("status", "returned");

    // Get paginated data, filtering out 'returned' items
    const { data: items, error } = await supabase
        .from("lost_items")
        .select("*")
        .neq("status", "returned")
        .order("created_at", { ascending: false })
        .range(start, end);

    if (error) {
        console.error("Error fetching items:", error.message);
    }

    const totalPages = Math.ceil((count || 0) / limit);

    res.render("ViewItems", {
        pageTitle: "UR Lost & Found - Storage",
        currentUser: req.session.user.username,
        items: items || [],
        currentPage: page,
        totalPages
    });
});

//Shows form for creating a new item
app.get("/items/new", isAuthenticated, (req, res) => {
    res.render("NewItem", {
        pageTitle: "UR Lost & Found - Log New Item",
        currentUser: req.session.user.username,
        isEdit: false,
        item: {},
        locationOptions: getLocationOptions(),
        categoryOptions: getCategoryOptions()
    });
});

//Saves Data in Supabase with Image Upload
app.post("/items", isAuthenticated, upload.single("itemImage"), async (req, res) => {
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
    description: req.body.description
};

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

/**
 * GET /items/:id/edit
 * Finds the item with the matching ID
 * and opens the same NewItem.ejs page in edit mode.
 */
app.get("/items/:id/edit", isAuthenticated, async (req, res) => {
    const { data: item, error } = await supabase
        .from("lost_items")
        .select("*")
        .eq("id", req.params.id)
        .single();

    // If the item does not exist or error, return to the item list
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

//Updates existing item in Supabase after form submission
app.post("/items/:id", isAuthenticated, upload.single("itemImage"), async (req, res) => {
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

    res.redirect("/items");
});

//Deletes item from Supabase
app.post("/items/:id/delete", isAuthenticated, async (req, res) => {
    const { error } = await supabase
        .from("lost_items")
        .delete()
        .eq("id", req.params.id);

    if (error) {
        console.error("Error deleting item:", error.message);
    }

    res.redirect("/items");
});

//Loads all the data and displays in in ViewReports with pagination
app.get("/reports", isAuthenticated, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // Get total count
    const { count } = await supabase
        .from("item_reports")
        .select("*", { count: 'exact', head: true });

    const { data: reports, error } = await supabase
        .from("item_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .range(start, end);

    if (error) {
        console.error("Error fetching reports:", error.message);
    }

    const totalPages = Math.ceil((count || 0) / limit);

    res.render("ViewReports", {
        pageTitle: "UR Lost & Found - Reports",
        currentUser: req.session.user.username,
        reports: reports || [],
        currentPage: page,
        totalPages
    });
});

//Shows form for creating new report
app.get("/reports/new", isAuthenticated, (req, res) => {
    res.render("NewReport", {
        pageTitle: "UR Lost & Found - New Report",
        currentUser: req.session.user.username,
        isEdit: false,
        report: {},
        locationOptions: getLocationOptions(),
        categoryOptions: getCategoryOptions()
    });
});

//Handles report submission to Supabase
app.post("/reports", isAuthenticated, async (req, res) => {
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

//Finds report with matching ID and opens NewReport.ejs in edit mode
app.get("/reports/:id/edit", isAuthenticated, async (req, res) => {
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

//Updates existing report in Supabase after form submission
app.post("/reports/:id", isAuthenticated, async (req, res) => {
    const finalCategory = getSubmittedCategory(req);
    const finalLocation = getSubmittedLocation(req);

    const { error } = await supabase
        .from("item_reports")
        .update({
            reporter_name: req.body.reporterName,
            reporter_email: req.body.reporterEmail,
            phone_number: req.body.reporterPhone,
            missing_item_name: req.body.itemName,
            category: finalCategory,
            date_lost: req.body.dateLost,
            last_known_location: finalLocation,
            description: req.body.description,
            distinguishing_features: req.body.distinguishingFeatures,
            status: req.body.status || "Open"
        })
        .eq("id", req.params.id);

    if (error) {
        console.error("Error updating report:", error.message);
    }

    res.redirect("/reports");
});

//Deletes report from Supabase
app.post("/reports/:id/delete", isAuthenticated, async (req, res) => {
    const { error } = await supabase
        .from("item_reports")
        .delete()
        .eq("id", req.params.id);

    if (error) {
        console.error("Error deleting report:", error.message);
    }

    res.redirect("/reports");
});

/**
 * GET /api/matches/:type/:id
 * Fetches potential matches for an item or report.
 */
app.get("/api/matches/:type/:id", isAuthenticated, async (req, res) => {
    const { type, id } = req.params;
    let target, candidates, matches = [];

    try {
        if (type === "item") {
            // Get the item details
            const { data: item } = await supabase.from("lost_items").select("*").eq("id", id).single();
            // Get all open reports
            const { data: reports } = await supabase.from("item_reports").select("*").eq("status", "Open");
            if (item && reports) {
                matches = reports.map(report => ({
                    ...report,
                    score: calculateMatchScore(item, report)
                })).filter(m => m.score > 20).sort((a, b) => b.score - a.score);
            }
        } else if (type === "report") {
            // Get the report details
            const { data: report } = await supabase.from("item_reports").select("*").eq("id", id).single();
            // Get all available items
            const { data: items } = await supabase.from("lost_items").select("*").neq("status", "returned");
            if (report && items) {
                matches = items.map(item => ({
                    ...item,
                    score: calculateMatchScore(item, report)
                })).filter(m => m.score > 20).sort((a, b) => b.score - a.score);
            }
        }
        res.json(matches.slice(0, 5)); // Return top 5 matches
    } catch (err) {
        console.error("Match API Error:", err);
        res.status(500).json({ error: "Failed to fetch matches" });
    }
});


//GET /test-db
//Tests whether the Supabase connection is working.
//It tries to fetch 1 record from the lost_items table.
//This route is just for testing the database connection.

app.get("/test-db", async (req, res) => {
    try {
        const supabase = require("./config/supabaseClient");

        // If Supabase was not set up correctly, show an error
        if (!supabase) {
            return res.status(500).json({
                success: false,
                message: "Supabase is not configured yet. Add your keys to .env first."
            });
        }

        // Try reading 1 row from the lost_items table
        const { data, error } = await supabase
            .from("lost_items")
            .select("*")
            .limit(1);

        // If Supabase returns an error, show it
        if (error) {
            return res.status(500).json({
                success: false,
                message: "Database connection failed.",
                error: error.message
            });
        }

        // If successful, return the data
        return res.json({
            success: true,
            message: "Connection successful!",
            data
        });
    } catch (error) {
        // If the Supabase file is missing or something crashes, show that here
        return res.status(500).json({
            success: false,
            message: "Supabase client is missing or not configured.",
            error: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});