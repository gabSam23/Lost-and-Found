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

module.exports = { isAuthenticated };