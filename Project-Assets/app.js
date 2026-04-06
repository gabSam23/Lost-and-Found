const express = require("express");
const path = require("path");
const session = require("express-session");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const itemRoutes = require("./routes/itemRoutes");
const reportRoutes = require("./routes/reportRoutes");
const adminRoutes = require("./routes/adminRoutes");
const apiRoutes = require("./routes/apiRoutes");

const app = express();
const port = process.env.PORT || 3000;

// Setup View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Global Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // For handling JSON in API requests

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'ur-lost-and-found-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Route Registration
app.use("/", authRoutes);
app.use("/items", itemRoutes);
app.use("/reports", reportRoutes);
app.use("/admin", adminRoutes);
app.use("/api", apiRoutes);
app.use("/", adminRoutes); // Fallback for /options routes which are currently under /

// Error handling for unmatched routes (optional but good practice)
app.use((req, res) => {
    res.status(404).render("Home", {
        pageTitle: "404 - Page Not Found",
        currentUser: req.session.user ? req.session.user.username : null
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});