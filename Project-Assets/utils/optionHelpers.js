const supabase = require("../config/supabaseClient");

const DEFAULT_LOCATIONS = [
    "Classroom Building",
    "Riddell Centre",
    "Library",
    "Residence"
];

const DEFAULT_CATEGORIES = [
    "Accessories",
    "Electronics",
    "Identification",
    "Clothing"
];

// Sort options alphabetically in a case-insensitive way
function sortOptionList(values) {
    return [...values].sort((a, b) =>
        String(a).localeCompare(String(b), undefined, {
            sensitivity: "base",
            numeric: true
        })
    );
}

// Clean a list of options, remove blanks/duplicates, then sort alphabetically
function normalizeOptionList(values) {
    const cleaned = [];

    (Array.isArray(values) ? values : []).forEach((value) => {
        const normalizedValue = String(value || "").trim();

        if (
            normalizedValue &&
            !cleaned.some((existingValue) => existingValue.toLowerCase() === normalizedValue.toLowerCase())
        ) {
            cleaned.push(normalizedValue);
        }
    });

    return sortOptionList(cleaned);
}

// Return saved locations in alphabetical order
async function getLocationOptions() {
    try {
        const { data, error } = await supabase.from('locations').select('name');
        if (error) {
            console.error("Supabase Error (getLocationOptions):", error.message);
            return normalizeOptionList(DEFAULT_LOCATIONS);
        }
        if (!data || data.length === 0) {
            return normalizeOptionList(DEFAULT_LOCATIONS);
        }
        return normalizeOptionList(data.map(loc => loc.name));
    } catch (err) {
        console.error("Fetch Error (getLocationOptions):", err);
        return normalizeOptionList(DEFAULT_LOCATIONS);
    }
}

// Return saved categories in alphabetical order
async function getCategoryOptions() {
    try {
        // Trying 'Categories' (capital C) first based on your schema image
        const { data, error } = await supabase.from('Categories').select('name');
        if (error) {
            // If capital C fails, try lowercase
            const { data: dataLow, error: errorLow } = await supabase.from('categories').select('name');
            if (errorLow) {
                console.error("Supabase Error (getCategoryOptions):", errorLow.message);
                return normalizeOptionList(DEFAULT_CATEGORIES);
            }
            return normalizeOptionList(dataLow.map(cat => cat.name));
        }
        if (!data || data.length === 0) {
            return normalizeOptionList(DEFAULT_CATEGORIES);
        }
        return normalizeOptionList(data.map(cat => cat.name));
    } catch (err) {
        console.error("Fetch Error (getCategoryOptions):", err);
        return normalizeOptionList(DEFAULT_CATEGORIES);
    }
}

// Build the final submitted location string
function getSubmittedLocation(req) {
    const selectedLocation = String(req.body.location || "").trim();
    const otherLocation = String(req.body.otherLocation || "").trim();

    if (selectedLocation === "__other__") {
        return otherLocation ? `Other - ${otherLocation}` : "";
    }

    return selectedLocation;
}

// Build the final submitted category string
function getSubmittedCategory(req) {
    const selectedCategory = String(req.body.category || "").trim();
    const otherCategory = String(req.body.otherCategory || "").trim();

    if (selectedCategory === "__other__") {
        return otherCategory ? `Other - ${otherCategory}` : "";
    }

    return selectedCategory;
}

// Add a new option if it does not already exist
async function addLocationOption(value) {
    const cleanedValue = String(value || "").trim();
    if (!cleanedValue) return;

    const { data, error: fetchError } = await supabase.from('locations').select('name').ilike('name', cleanedValue);
    if (fetchError) {
        console.error("Error checking existing location:", fetchError.message);
        return;
    }
    
    if (data && data.length > 0) {
        console.log(`Location "${cleanedValue}" already exists.`);
        return; 
    }

    const { error: insertError } = await supabase.from('locations').insert([{ name: cleanedValue }]);
    if (insertError) {
        console.error("Error inserting new location:", insertError.message);
        console.error("Check if RLS is enabled or if the table name is correct.");
    }
}

async function addCategoryOption(value) {
    const cleanedValue = String(value || "").trim();
    if (!cleanedValue) return;

    // Determine the correct table name by checking which one exists
    let tableName = 'Categories';
    const { error: testError } = await supabase.from(tableName).select('name').limit(1);
    if (testError && testError.message.includes("relation") && testError.message.includes("does not exist")) {
        tableName = 'categories';
    }

    const { data, error: fetchError } = await supabase.from(tableName).select('name').ilike('name', cleanedValue);
    if (fetchError) {
        console.error("Error checking existing category:", fetchError.message);
        return;
    }

    if (data && data.length > 0) return; 

    const { error: insertError } = await supabase.from(tableName).insert([{ name: cleanedValue }]);
    if (insertError) {
        console.error("Error inserting new category:", insertError.message);
    }
}

// Edit an existing option
async function editLocationOption(oldValue, newValue) {
    const cleanedOldValue = String(oldValue || "").trim();
    const cleanedNewValue = String(newValue || "").trim();

    if (!cleanedOldValue || !cleanedNewValue) return false;

    const { data } = await supabase.from('locations').select('name').ilike('name', cleanedNewValue);
    if (data && data.length > 0 && data[0].name.toLowerCase() !== cleanedOldValue.toLowerCase()) {
        return false; 
    }

    const { error } = await supabase.from('locations').update({ name: cleanedNewValue }).ilike('name', cleanedOldValue);
    if (error) console.error("Error updating location:", error.message);
    return !error;
}

async function editCategoryOption(oldValue, newValue) {
    const cleanedOldValue = String(oldValue || "").trim();
    const cleanedNewValue = String(newValue || "").trim();

    if (!cleanedOldValue || !cleanedNewValue) return false;

    let tableName = 'Categories';
    const { error: testError } = await supabase.from(tableName).select('name').limit(1);
    if (testError) tableName = 'categories';

    const { data } = await supabase.from(tableName).select('name').ilike('name', cleanedNewValue);
    if (data && data.length > 0 && data[0].name.toLowerCase() !== cleanedOldValue.toLowerCase()) {
        return false; 
    }

    const { error } = await supabase.from(tableName).update({ name: cleanedNewValue }).ilike('name', cleanedOldValue);
    if (error) console.error("Error updating category:", error.message);
    return !error;
}

// Delete one option
async function deleteLocationOption(value) {
    const cleanedValue = String(value || "").trim();
    if (!cleanedValue) return false;

    const { error } = await supabase.from('locations').delete().ilike('name', cleanedValue);
    if (error) console.error("Error deleting location:", error.message);
    return !error;
}

async function deleteCategoryOption(value) {
    const cleanedValue = String(value || "").trim();
    if (!cleanedValue) return false;

    let tableName = 'Categories';
    const { error: testError } = await supabase.from(tableName).select('name').limit(1);
    if (testError) tableName = 'categories';

    const { error } = await supabase.from(tableName).delete().ilike('name', cleanedValue);
    if (error) console.error("Error deleting category:", error.message);
    return !error;
}

module.exports = {
    getLocationOptions,
    getCategoryOptions,
    getSubmittedLocation,
    getSubmittedCategory,
    addLocationOption,
    addCategoryOption,
    editLocationOption,
    editCategoryOption,
    deleteLocationOption,
    deleteCategoryOption,
    DEFAULT_LOCATIONS,
    DEFAULT_CATEGORIES
};
