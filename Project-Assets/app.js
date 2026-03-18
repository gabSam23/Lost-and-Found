const express = require("express");
const fs = require("fs");
const path = require("path");

// Import database connection
const supabase = require('./config/supabaseClient'); 

const app = express();
const port = 3000;

// Set EJS as the view engine for the files in the /views folder
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, Images) from the /public folder
app.use(express.static("public"));

// Configure express to access variables in req.body object when submitting forms
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Route for the Landing Page (Login)
app.get("/", (req, res) => {
    // Renders views/Login.ejs
    res.render("Login");

});

// A POST route for when the user submits the login form
// Update: Made changes to link to Supabase Authentication
app.post("/login", async (req, res) => {
    
    // Grab the email and password from your form
    const submittedEmail = req.body.email; 
    const submittedPassword = req.body.password;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: submittedEmail,
            password: submittedPassword,
        });

        if (error) {
            console.log("Supabase login error:", error.message);
            // INSTEAD OF REDIRECTING: Re-render the page and pass the error message and email!
            return res.render("Login", { 
                error: "Invalid email or password. Please try again.", 
                email: submittedEmail 
            });
        }

        // SUCCESS!
        console.log("Successfully logged in user:", data.user.email);
        res.redirect("/home");

    } catch (err) {
        console.log("Server error during login:", err);
        res.render("Login", { 
            error: "A server error occurred. Please try again later.",
            email: submittedEmail
        });
    }
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

// Create the Test Route
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

        // If it works, send a success message to the browser
        res.json({ 
            success: true, 
            message: "Connection successful!", 
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
