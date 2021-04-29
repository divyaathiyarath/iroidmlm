const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.validateNotificationInputs = data => {
    let errors = [];
    if (typeof data.title === "undefined") data.title = "";
    if (typeof data.description === "undefined") data.description = "";

    if (Validator.isEmpty(data.title)) {
        errors.push("Notification title is required")
    }

    if (Validator.isEmpty(data.description)) {
        errors.push("Notification description is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};