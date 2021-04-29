const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.validateShiftInputs = data => {
    let errors = [];
    if (typeof data.name === "undefined") data.uid = "";
    if (typeof data.duration === "undefined") data.sensor_id = "";
    if (typeof data.time === "undefined") data.time = "";

    if (Validator.isEmpty(data.name)) {
        errors.push("Name is required")
    }
    if (Validator.isEmpty(data.duration)) {
        errors.push("Duration is required")
    }
    if (Validator.isEmpty(data.time)) {
        errors.push("Time is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};