const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.validateLoginInputs = data => {
    let errors = [];
    if (typeof data.email === "undefined") data.email = "";
    if (typeof data.password === "undefined") data.password = "";

    if (Validator.isEmpty(data.email)) {
        errors.push("Email ID is required")
    }

    if (Validator.isEmpty(data.password)) {
        errors.push("Password is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};

exports.validateNewAdminInputs = data => {
    let errors = [];
    if (typeof data.name === "undefined") data.name = "";
    if (typeof data.email === "undefined") data.email = "";

    if (Validator.isEmpty(data.name)) {
        errors.push("Name is required")
    }

    if (Validator.isEmpty(data.email)) {
        errors.push("Email ID is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
}