const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;

// Set EJS as the view engine for the files in the /views folder
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, Images) from the /public folder
app.use(express.static("public"));

// Configure express to access variables in req.body object when submitting forms
app.use(express.urlencoded({ extended: true }));

// Route for the Landing Page (Login)
app.get("/", (req, res) => {
    // Renders views/Login.ejs
    res.render("Login");

});

// A POST route for when the user submits the login form
app.post("/login", (req, res) => {

    // Note: You will eventually replace this fs.readFile with a Supabase query!
    fs.readFile(__dirname + "/users.json", "utf8", (err, jsonString) => {

        if (err) {
            console.log("Error reading file:", err);
            // If users.json doesn't exist yet, we'll just log it and redirect for now
            return res.redirect("/");

        }

        try {
            const users = JSON.parse(jsonString);
            const submittedEmail = req.body.email;
            const submittedPassword = req.body.password;

            // Validating if users actually has submittedEmail and submittedPassword
            const user = users.find(u => u.email === submittedEmail && u.password === submittedPassword);

            if (user) {
                // Redirect to the Home page on success
                res.redirect("/home");

            } else {
                // Back to login page if invalid
                res.redirect("/");
            }


        } catch (err) {
            console.log("Error parsing JSON:", err);
            res.redirect("/");
        }
    });
});

// Route for the Home Page
app.get("/home", (req, res) => {
    res.render("Home"); // Renders views/Home.ejs
});

// Route for Viewing Items
app.get("/items", (req, res) => {
    res.render("ViewItems"); // Renders views/ViewItems.ejs
});

app.get("/NewItem", (req, res) => {
    res.render("NewItem");
});

//DATABASE CONN CHECK
// 1. Import your database connection
const supabase = require('./config/supabaseClient'); 

// ... (your other app configurations like app.set('view engine', 'ejs') go here) ...

// 2. Create the Test Route
app.get('/test-db', async (req, res) => {
    try {
        // Try to fetch just 1 item from the lost_items table to prove we have access
        const { data, error } = await supabase
            .from('lost_items')
            .select('*')
            .limit(1);

        // If Supabase throws an error (e.g., wrong password, bad table name)
        if (error) {
            console.error("Supabase Error:", error);
            return res.status(500).json({ success: false, message: "Database connection failed!", error: error.message });
        }

        // If it works, send a success message to the browser!
        res.json({ 
            success: true, 
            message: "Connection successful! 🎉", 
            data: data 
        });

    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).send("Something broke on the server end.");
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
