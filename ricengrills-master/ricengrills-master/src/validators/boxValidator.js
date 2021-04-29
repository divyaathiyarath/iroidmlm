const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.validateBoxInputs = data => {
    let errors = [];
    if (typeof data.uid === "undefined") data.uid = "";
    if (typeof data.sensor_id === "undefined") data.sensor_id = "";

    if (Validator.isEmpty(data.uid)) {
        errors.push("Box uid is required")
    }
    if (Validator.isEmpty(data.sensor_id)) {
        errors.push("Sensor is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};