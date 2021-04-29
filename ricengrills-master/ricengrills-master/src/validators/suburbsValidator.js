const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.validateSuburbsInputs = data => {
    let errors = [];
    if (typeof data.name === "undefined") data.name = "";
    if (typeof data.radius === "undefined") data.radius = "";
    if (typeof data.address === "undefined") data.address = "";
    if (typeof data.lat === "undefined") data.lat = "";
    if (typeof data.lng === "undefined") data.lng = "";

    if (Validator.isEmpty(data.name)) {
        errors.push("Suburb Name is required")
    }
    if (Validator.isEmpty(data.address)) {
        errors.push("Suburb Address is required")
    }
    if (Validator.isEmpty(data.radius)) {
        errors.push("Suburb radius is required")
    }
    if (Validator.isEmpty(data.lat)) {
        errors.push("Suburb latitude is required")
    }
    if (Validator.isEmpty(data.lng)) {
        errors.push("Suburb longitude is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};