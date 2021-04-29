const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.validateLoginInputs = data => {
    let errors = [];
    if (typeof data.email === "undefined") data.email = "";
    if (typeof data.password === "undefined") data.password = "";
    if (Validator.isEmpty(data.email)) {
        errors.push("Email is required")
    }
    if (Validator.isEmpty(data.password)) {
        errors.push("Password is required")
    }
    return {
        errors,
        isValid: isEmpty(errors)
    };
}

exports.validateCollectionPointInputs = data => {
    let errors = [];
    if (typeof data.name === "undefined") data.name = "";
    if (typeof data.contact_name === "undefined") data.contact_name = "";
    if (typeof data.email === "undefined") data.email = "";
    if (typeof data.mobile === "undefined") data.mobile = "";
    if (typeof data.address_line1 === "undefined") data.address_line1 = "";
    if (typeof data.lat === "undefined") data.lat = "";
    if (typeof data.lng === "undefined") data.lng = "";

    if (Validator.isEmpty(data.name)) {
        errors.push("Collection point name is required")
    }
    if (Validator.isEmpty(data.contact_name)) {
        errors.push("Collection point contact person name is required")
    }
    if (Validator.isEmpty(data.email)) {
        errors.push("Email is required")
        if (!Validator.isEmail(data.email)) {
            errors.push("Email is not valid")
        }
    }
    if (Validator.isEmpty(data.mobile)) {
        errors.push("Mobile is required")
    }
    if (Validator.isEmpty(data.address_line1)) {
        errors.push("Address is required")
    }
    if (Validator.isEmpty(data.lat)) {
        errors.push("Lattitude & Longiture could n't fetch from current address")
    }
    if (Validator.isEmpty(data.lng)) {
        errors.push("Lattitude & Longiture could n't fetch from current address")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};