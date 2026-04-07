const fs = require("fs");
const path = require("path");

// Build absolute paths to important folders/files in the project
const dataPath = path.join(__dirname, "..", "data");
const legacyCustomLocationsPath = path.join(dataPath, "customLocations.json");
const legacyCustomCategoriesPath = path.join(dataPath, "customCategories.json");
const locationsPath = path.join(dataPath, "locations.json");
const categoriesPath = path.join(dataPath, "categories.json");

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

// Make sure the /data folder exists before reading or writing JSON files
function ensureDataDirectory() {
    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
    }
}

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

// Read an old legacy JSON file if it exists
function readLegacyArray(filePath) {
    ensureDataDirectory();

    if (!fs.existsSync(filePath)) {
        return [];
    }

    try {
        const fileData = fs.readFileSync(filePath, "utf8");
        return normalizeOptionList(JSON.parse(fileData));
    } catch (error) {
        return [];
    }
}

// Make sure the option file exists and contains valid JSON
function ensureOptionFile(filePath, defaultValues, legacyPath) {
    ensureDataDirectory();

    if (!fs.existsSync(filePath)) {
        const seededValues = normalizeOptionList([
            ...defaultValues,
            ...readLegacyArray(legacyPath)
        ]);

        fs.writeFileSync(filePath, JSON.stringify(seededValues, null, 2), "utf8");
        return;
    }

    try {
        const fileData = fs.readFileSync(filePath, "utf8");
        const parsedData = JSON.parse(fileData);

        if (!Array.isArray(parsedData)) {
            throw new Error("Invalid option file format");
        }

        const normalizedValues = normalizeOptionList(parsedData);

        if (JSON.stringify(parsedData) !== JSON.stringify(normalizedValues)) {
            fs.writeFileSync(filePath, JSON.stringify(normalizedValues, null, 2), "utf8");
        }
    } catch (error) {
        fs.writeFileSync(
            filePath,
            JSON.stringify(normalizeOptionList(defaultValues), null, 2),
            "utf8"
        );
    }
}

// Read one saved option file safely
function readOptionFile(filePath, defaultValues, legacyPath) {
    ensureOptionFile(filePath, defaultValues, legacyPath);

    try {
        const rawData = fs.readFileSync(filePath, "utf8");
        return normalizeOptionList(JSON.parse(rawData));
    } catch (error) {
        return normalizeOptionList(defaultValues);
    }
}

// Write one saved option file safely
function writeOptionFile(filePath, values) {
    ensureDataDirectory();
    fs.writeFileSync(filePath, JSON.stringify(normalizeOptionList(values), null, 2), "utf8");
}

// Add a new option if it does not already exist
function addOption(filePath, defaultValues, legacyPath, value) {
    const cleanedValue = String(value || "").trim();

    if (!cleanedValue) {
        return;
    }

    const existingValues = readOptionFile(filePath, defaultValues, legacyPath);

    if (existingValues.some((existingValue) => existingValue.toLowerCase() === cleanedValue.toLowerCase())) {
        return;
    }

    existingValues.push(cleanedValue);
    writeOptionFile(filePath, existingValues);
}

// Edit an existing option and keep the final list alphabetized
function editOption(filePath, defaultValues, legacyPath, oldValue, newValue) {
    const cleanedOldValue = String(oldValue || "").trim();
    const cleanedNewValue = String(newValue || "").trim();

    if (!cleanedOldValue || !cleanedNewValue) {
        return false;
    }

    const existingValues = readOptionFile(filePath, defaultValues, legacyPath);
    const oldIndex = existingValues.findIndex(
        (existingValue) => existingValue.toLowerCase() === cleanedOldValue.toLowerCase()
    );

    if (oldIndex === -1) {
        return false;
    }

    const duplicateExists = existingValues.some(
        (existingValue, index) =>
            index !== oldIndex && existingValue.toLowerCase() === cleanedNewValue.toLowerCase()
    );

    if (duplicateExists) {
        return false;
    }

    existingValues[oldIndex] = cleanedNewValue;
    writeOptionFile(filePath, existingValues);
    return true;
}

// Delete one option from the saved list
function deleteOption(filePath, defaultValues, legacyPath, value) {
    const cleanedValue = String(value || "").trim();

    if (!cleanedValue) {
        return false;
    }

    const existingValues = readOptionFile(filePath, defaultValues, legacyPath);
    const filteredValues = existingValues.filter(
        (existingValue) => existingValue.toLowerCase() !== cleanedValue.toLowerCase()
    );

    if (filteredValues.length === existingValues.length) {
        return false;
    }

    writeOptionFile(filePath, filteredValues);
    return true;
}

// Return saved locations in alphabetical order
function getLocationOptions() {
    return readOptionFile(locationsPath, DEFAULT_LOCATIONS, legacyCustomLocationsPath);
}

// Return saved categories in alphabetical order
function getCategoryOptions() {
    return readOptionFile(categoriesPath, DEFAULT_CATEGORIES, legacyCustomCategoriesPath);
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

module.exports = {
    getLocationOptions,
    getCategoryOptions,
    getSubmittedLocation,
    getSubmittedCategory,
    addOption,
    editOption,
    deleteOption,
    locationsPath,
    categoriesPath,
    DEFAULT_LOCATIONS,
    DEFAULT_CATEGORIES,
    legacyCustomLocationsPath,
    legacyCustomCategoriesPath
};