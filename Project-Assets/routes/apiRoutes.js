const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const { isAuthenticated } = require("../middleware/auth");
const { calculateMatchScore } = require("../utils/matcher");

/**
 * GET /api/matches/:type/:id
 * Fetches potential matches for an item or report.
 */
router.get("/matches/:type/:id", isAuthenticated, async (req, res) => {
    const { type, id } = req.params;
    let matches = [];

    try {
        if (type === "item") {
            const { data: item } = await supabase.from("lost_items").select("*").eq("id", id).single();
            const { data: reports } = await supabase.from("item_reports").select("*").eq("status", "Open");
            if (item && reports) {
                matches = reports.map(report => ({
                    ...report,
                    score: calculateMatchScore(item, report)
                })).filter(m => m.score > 20).sort((a, b) => b.score - a.score);
            }
        } else if (type === "report") {
            const { data: report } = await supabase.from("item_reports").select("*").eq("id", id).single();
            const { data: items } = await supabase.from("lost_items").select("*").in("status", ["available", "pending_pickup"]);
            if (report && items) {
                matches = items.map(item => ({
                    ...item,
                    score: calculateMatchScore(item, report)
                })).filter(m => m.score > 20).sort((a, b) => b.score - a.score);
            }
        }
        res.json(matches.slice(0, 5));
    } catch (err) {
        console.error("Match API Error:", err);
        res.status(500).json({ error: "Failed to fetch matches" });
    }
});

// GET /test-db
router.get("/test-db", async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({
                success: false,
                message: "Supabase is not configured yet. Add your keys to .env first."
            });
        }

        const { data, error } = await supabase.from("lost_items").select("*").limit(1);

        if (error) {
            return res.status(500).json({
                success: false,
                message: "Database connection failed.",
                error: error.message
            });
        }

        return res.json({ success: true, message: "Connection successful!", data });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Supabase client error.",
            error: error.message
        });
    }
});

module.exports = router;