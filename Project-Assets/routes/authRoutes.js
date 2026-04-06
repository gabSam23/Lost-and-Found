const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const { isAuthenticated } = require("../middleware/auth");

// Shows Login page and error/logout messages
router.get("/", (req, res) => {
    let errorMessage = "";
    if (req.query.error === "1") errorMessage = "Invalid username or password.";
    if (req.query.error === "auth") errorMessage = "Please log in to access that page.";

    res.render("Login", {
        pageTitle: "UR Lost & Found - Login",
        errorMessage,
        logoutMessage: req.query.logout ? "You have been signed out." : ""
    });
});

// Reads email, then checks Supabase and handles errors and login passing
router.post("/login", async (req, res) => {
    const submittedEmail = (req.body.email || "").trim();
    const submittedPassword = req.body.password || "";

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: submittedEmail,
        password: submittedPassword
    });

    if (authError || !authData.user) {
        console.error("Login error:", authError ? authError.message : "No user data");
        return res.redirect("/?error=1");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", authData.user.id)
        .single();

    req.session.user = {
        id: authData.user.id,
        email: authData.user.email,
        username: profile ? profile.username : submittedEmail.split("@")[0]
    };

    return res.redirect("/home");
});

// Logout handling
router.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/?logout=1");
});

// Renders homepage
router.get("/home", isAuthenticated, (req, res) => {
    res.render("Home", {
        pageTitle: "UR Lost & Found - Home",
        currentUser: req.session.user.username
    });
});

module.exports = router;