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

// Cleans a list of options
function normalizeOptionList(values) {
    const cleaned = [];
    (Array.isArray(values) ? values : []).forEach((value) => {
        const normalizedValue = (value || "").trim();
        if (normalizedValue && !cleaned.some(v => v.toLowerCase() === normalizedValue.toLowerCase())) {
            cleaned.push(normalizedValue);
        }
    });
    return cleaned;
}

// Reads an old legacy JSON file if it exists
function readLegacyArray(filePath) {
    if (!fs.existsSync(filePath)) return [];
    try {
        const fileData = fs.readFileSync(filePath, "utf8");
        return normalizeOptionList(JSON.parse(fileData));
    } catch (error) {
        return [];
    }
}

// Makes sure the option file exists and contains valid JSON
function ensureOptionFile(filePath, defaultValues, legacyPath) {
    if (!fs.existsSync(filePath)) {
        const seededValues = normalizeOptionList([...defaultValues, ...readLegacyArray(legacyPath)]);
        fs.writeFileSync(filePath, JSON.stringify(seededValues, null, 2), "utf8");
        return;
    }

    try {
        const fileData = fs.readFileSync(filePath, "utf8");
        const parsedData = JSON.parse(fileData);
        if (!Array.isArray(parsedData)) throw new Error("Invalid format");
        const normalizedValues = normalizeOptionList(parsedData);
        if (JSON.stringify(parsedData) !== JSON.stringify(normalizedValues)) {
            fs.writeFileSync(filePath, JSON.stringify(normalizedValues, null, 2), "utf8");
        }
    } catch (error) {
        fs.writeFileSync(filePath, JSON.stringify(normalizeOptionList(defaultValues), null, 2), "utf8");
    }
}

function readOptionFile(filePath, defaultValues, legacyPath) {
    ensureOptionFile(filePath, defaultValues, legacyPath);
    try {
        return normalizeOptionList(JSON.parse(fs.readFileSync(filePath, "utf8")));
    } catch (error) {
        return normalizeOptionList(defaultValues);
    }
}

function writeOptionFile(filePath, values) {
    fs.writeFileSync(filePath, JSON.stringify(normalizeOptionList(values), null, 2), "utf8");
}

function addOption(filePath, defaultValues, legacyPath, value) {
    const cleanedValue = (value || "").trim();
    if (!cleanedValue) return;
    const existingValues = readOptionFile(filePath, defaultValues, legacyPath);
    if (existingValues.some(v => v.toLowerCase() === cleanedValue.toLowerCase())) return;
    existingValues.push(cleanedValue);
    writeOptionFile(filePath, existingValues);
}

function editOption(filePath, defaultValues, legacyPath, oldValue, newValue) {
    const cleanedOldValue = (oldValue || "").trim();
    const cleanedNewValue = (newValue || "").trim();
    if (!cleanedOldValue || !cleanedNewValue) return false;

    const existingValues = readOptionFile(filePath, defaultValues, legacyPath);
    const oldIndex = existingValues.findIndex(v => v.toLowerCase() === cleanedOldValue.toLowerCase());
    if (oldIndex === -1) return false;

    if (existingValues.some((v, i) => i !== oldIndex && v.toLowerCase() === cleanedNewValue.toLowerCase())) return false;

    existingValues[oldIndex] = cleanedNewValue;
    writeOptionFile(filePath, existingValues);
    return true;
}

function deleteOption(filePath, defaultValues, legacyPath, value) {
    const cleanedValue = (value || "").trim();
    if (!cleanedValue) return false;
    const existingValues = readOptionFile(filePath, defaultValues, legacyPath);
    const filteredValues = existingValues.filter(v => v.toLowerCase() !== cleanedValue.toLowerCase());
    if (filteredValues.length === existingValues.length) return false;
    writeOptionFile(filePath, filteredValues);
    return true;
}

function getLocationOptions() {
    return readOptionFile(locationsPath, DEFAULT_LOCATIONS, legacyCustomLocationsPath);
}

function getCategoryOptions() {
    return readOptionFile(categoriesPath, DEFAULT_CATEGORIES, legacyCustomCategoriesPath);
}

function getSubmittedLocation(req) {
    const selectedLocation = String(req.body.location || "").trim();
    const otherLocation = String(req.body.otherLocation || "").trim();
    if (selectedLocation === "__other__") {
        return otherLocation ? `Other - ${otherLocation}` : "";
    }
    return selectedLocation;
}

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