/**
 * Simple matching engine to cross-reference items and reports.
 * Calculates a score based on Category, Location, and Description overlap.
 */

function calculateMatchScore(item, report) {
    let score = 0;

    // 1. Category Match (High Importance)
    if (item.category && report.category && item.category.toLowerCase() === report.category.toLowerCase()) {
        score += 40;
    }

    // 2. Location Match (Medium Importance)
    // We check if the report's last known location is similar to the item's found location.
    if (item.location && report.last_known_location) {
        const itemLoc = item.location.toLowerCase();
        const reportLoc = report.last_known_location.toLowerCase();
        if (itemLoc === reportLoc || itemLoc.includes(reportLoc) || reportLoc.includes(itemLoc)) {
            score += 30;
        }
    }

    // 3. Description/Name Overlap (Keyword based)
    const itemText = (item.description || "").toLowerCase();
    const reportText = ((report.missing_item_name || "") + " " + (report.description || "")).toLowerCase();
    
    const itemWords = new Set(itemText.split(/\W+/).filter(w => w.length > 3));
    const reportWords = new Set(reportText.split(/\W+/).filter(w => w.length > 3));
    
    let overlap = 0;
    itemWords.forEach(word => {
        if (reportWords.has(word)) overlap++;
    });

    score += (overlap * 10); // 10 points per matching keyword

    return score;
}

module.exports = { calculateMatchScore };
