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

    // Get total count
    const { count } = await supabase
        .from("lost_items")
        .select("*", { count: 'exact', head: true });

    // Get paginated data
    const { data: items, error } = await supabase
        .from("lost_items")
        .select("*")
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
        item: {}
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

    const { error } = await supabase
        .from("lost_items")
        .insert([
            {
                location: req.body.location,
                category: req.body.category,
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
        item
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

    const updateData = {
        location: req.body.location,
        category: req.body.category,
        description: req.body.description
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
        report: {}
    });
});

//Handles report submission to Supabase
app.post("/reports", isAuthenticated, async (req, res) => {
    const { error } = await supabase
        .from("item_reports")
        .insert([
            {
                reporter_name: req.body.reporterName,
                reporter_email: req.body.reporterEmail,
                phone_number: req.body.reporterPhone,
                missing_item_name: req.body.itemName,
                category: req.body.category,
                date_lost: req.body.dateLost,
                last_known_location: req.body.lostLocation,
                description: req.body.description,
                distinguishing_features: req.body.distinguishingFeatures,
                status: req.body.status || "Open",
                owner_id: req.session.user.id // Associate with logged in user
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
        report
    });
});

//Updates existing report in Supabase after form submission
app.post("/reports/:id", isAuthenticated, async (req, res) => {
    const { error } = await supabase
        .from("item_reports")
        .update({
            reporter_name: req.body.reporterName,
            reporter_email: req.body.reporterEmail,
            phone_number: req.body.reporterPhone,
            missing_item_name: req.body.itemName,
            category: req.body.category,
            date_lost: req.body.dateLost,
            last_known_location: req.body.lostLocation,
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