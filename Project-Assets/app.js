const express = require("express"); // Imports Express so we can create the web server
const fs = require("fs"); // Lets us read and write files
const path = require("path"); // Helps build file/folder paths safely

const app = express(); // Creates the Express app
const port = process.env.PORT || 3000; // Uses the environment port if available, otherwise 3000

// Build absolute paths to important folders/files in the project
const viewsPath = path.join(__dirname, "views");
const publicPath = path.join(__dirname, "public");
const dataPath = path.join(__dirname, "data");
const usersFile = path.join(dataPath, "users.json");
const itemsFile = path.join(dataPath, "items.json");
const reportsFile = path.join(dataPath, "reports.json");

// Tell Express to use EJS as the template engine
// This means res.render("Login") will load views/Login.ejs
app.set("view engine", "ejs");
app.set("views", viewsPath);

// Serve static files from the public folder
app.use(express.static(publicPath));

// Allows Express to read form data sent through POST requests
// Example: req.body.username or req.body.password
app.use(express.urlencoded({ extended: true }));


//Ensure JSON file exists for now, the Backend thing you gotta manage
function ensureDataFile(filePath, defaultValue) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    }
}

//Reads a JSON file 
function loadJson(filePath, defaultValue = []) {
    try {
        if (!fs.existsSync(filePath)) {
            return defaultValue;
        }

        const raw = fs.readFileSync(filePath, "utf8");

        // If the file is empty, return the default value
        return raw.trim() ? JSON.parse(raw) : defaultValue;
    } catch (error) {
        console.error(`Failed to load ${filePath}:`, error.message);
        return defaultValue;
    }
}

//Saves javascript on JSON
function saveJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

//Creates Unique ID
function createId(prefix) {
    return `${prefix}-${Date.now()}`;
}

// If the data folder does not exist, create it
if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
}

// Make sure the JSON files exist before the server starts
// users.json starts with one default admin account
ensureDataFile(usersFile, [
    {
        username: "admin",
        password: "admin123"
    }
]);

// items.json and reports.json start empty
ensureDataFile(itemsFile, []);
ensureDataFile(reportsFile, []);

//Shows Login page and error/logout messages
app.get("/", (req, res) => {
    res.render("Login", {
        pageTitle: "UR Lost & Found - Login",
        errorMessage: req.query.error ? "Invalid username or password." : "",
        logoutMessage: req.query.logout ? "You have been signed out." : ""
    });
});


//Reads username, then checks JSON and handles errors and login passing
app.post("/login", (req, res) => {
    const users = loadJson(usersFile, []);
    const submittedUsername = (req.body.username || "").trim();
    const submittedPassword = req.body.password || "";

    // Search for a user with matching username and password
    const user = users.find(
        (entry) =>
            entry.username === submittedUsername &&
            entry.password === submittedPassword
    );

    // If no matching user was found, send them back to login with an error
    if (!user) {
        return res.redirect("/?error=1");
    }

    // If login is successful, send them to the home page
    // The username is passed in the URL query string
    return res.redirect(`/home?user=${encodeURIComponent(user.username)}`);
});


//Logout handling
app.get("/logout", (req, res) => {
    res.redirect("/?logout=1");
});

//Renders homepage
app.get("/home", (req, res) => {
    res.render("Home", {
        pageTitle: "UR Lost & Found - Home",
        currentUser: req.query.user || "Account"
    });
});

//Gets items
app.get("/items", (req, res) => {
    const items = loadJson(itemsFile, []);
    res.render("ViewItems", {
        pageTitle: "UR Lost & Found - Storage",
        currentUser: req.query.user || "Account",
        items
    });
});

//Shows form for creating a new item
app.get("/items/new", (req, res) => {
    res.render("NewItem", {
        pageTitle: "UR Lost & Found - Log New Item",
        currentUser: req.query.user || "Account",
        isEdit: false,
        item: {}
    });
});

//Saves Data in JSON
app.post("/items", (req, res) => {
    const items = loadJson(itemsFile, []);

    items.push({
        id: createId("ITEM"),
        location: req.body.location,
        category: req.body.category,
        description: req.body.description,
        imageLabel: "No image uploaded",
        dateLogged: new Date().toISOString().slice(0, 10)
    });

    saveJson(itemsFile, items);
    res.redirect("/items");
});

/**
 * GET /items/:id/edit
 * Finds the item with the matching ID
 * and opens the same NewItem.ejs page in edit mode.
 */
app.get("/items/:id/edit", (req, res) => {
    const items = loadJson(itemsFile, []);
    const item = items.find((entry) => entry.id === req.params.id);

    // If the item does not exist, return to the item list
    if (!item) {
        return res.redirect("/items");
    }

    res.render("NewItem", {
        pageTitle: "UR Lost & Found - Edit Item",
        currentUser: req.query.user || "Account",
        isEdit: true,
        item
    });
});

//Updates existing item after form submission
app.post("/items/:id", (req, res) => {
    const items = loadJson(itemsFile, []);
    const itemIndex = items.findIndex((entry) => entry.id === req.params.id);

    // If no matching item is found, go back to the items page
    if (itemIndex === -1) {
        return res.redirect("/items");
    }

    items[itemIndex] = {
        ...items[itemIndex], // keep the existing fields like id/dateLogged
        location: req.body.location,
        category: req.body.category,
        description: req.body.description
    };

    saveJson(itemsFile, items);
    res.redirect("/items");
});

//Deletes item by removing it from the Array
app.post("/items/:id/delete", (req, res) => {
    const items = loadJson(itemsFile, []);
    const updatedItems = items.filter((entry) => entry.id !== req.params.id);
    saveJson(itemsFile, updatedItems);
    res.redirect("/items");
});

//Loads all the data and displays in in ViewReports
app.get("/reports", (req, res) => {
    const reports = loadJson(reportsFile, []);
    res.render("ViewReports", {
        pageTitle: "UR Lost & Found - Reports",
        currentUser: req.query.user || "Account",
        reports
    });
});

//Shows form for creating new report
app.get("/reports/new", (req, res) => {
    res.render("NewReport", {
        pageTitle: "UR Lost & Found - New Report",
        currentUser: req.query.user || "Account",
        isEdit: false,
        report: {}
    });
});

//Handles report submission
app.post("/reports", (req, res) => {
    const reports = loadJson(reportsFile, []);

    reports.push({
        id: createId("REPORT"),
        reporterName: req.body.reporterName,
        reporterEmail: req.body.reporterEmail,
        reporterPhone: req.body.reporterPhone,
        itemName: req.body.itemName,
        category: req.body.category,
        dateLost: req.body.dateLost,
        lostLocation: req.body.lostLocation,
        description: req.body.description,
        distinguishingFeatures: req.body.distinguishingFeatures,
        status: req.body.status || "Open",
        createdAt: new Date().toISOString()
    });

    saveJson(reportsFile, reports);
    res.redirect("/reports");
});

//Finds report with matching ID and opens NewReport.ejs in edit mode
app.get("/reports/:id/edit", (req, res) => {
    const reports = loadJson(reportsFile, []);
    const report = reports.find((entry) => entry.id === req.params.id);

    if (!report) {
        return res.redirect("/reports");
    }

    res.render("NewReport", {
        pageTitle: "UR Lost & Found - Edit Report",
        currentUser: req.query.user || "Account",
        isEdit: true,
        report
    });
});

//Updates existing report after form submission
app.post("/reports/:id", (req, res) => {
    const reports = loadJson(reportsFile, []);
    const reportIndex = reports.findIndex((entry) => entry.id === req.params.id);

    if (reportIndex === -1) {
        return res.redirect("/reports");
    }

    reports[reportIndex] = {
        ...reports[reportIndex],
        reporterName: req.body.reporterName,
        reporterEmail: req.body.reporterEmail,
        reporterPhone: req.body.reporterPhone,
        itemName: req.body.itemName,
        category: req.body.category,
        dateLost: req.body.dateLost,
        lostLocation: req.body.lostLocation,
        description: req.body.description,
        distinguishingFeatures: req.body.distinguishingFeatures,
        status: req.body.status || "Open"
    };

    saveJson(reportsFile, reports);
    res.redirect("/reports");
});

//Deletes report by removing it from the Array
app.post("/reports/:id/delete", (req, res) => {
    const reports = loadJson(reportsFile, []);
    const updatedReports = reports.filter((entry) => entry.id !== req.params.id);
    saveJson(reportsFile, updatedReports);
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