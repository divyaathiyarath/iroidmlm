const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.validateStockInputs = data => {
    let errors = [];
    if (typeof data.suburb_id === "undefined") data.suburb_id = "";
    if (typeof data.shift_id === "undefined") data.shift_id = "";
    if (typeof data.type === "undefined") data.type = "";
    if (typeof data.driver_id === "undefined") data.driver_id = "";
    if (typeof data.vehicle_id === "undefined") data.vehicle_id = "";

    if (Validator.isEmpty(data.suburb_id)) {
        errors.push("Suburb is required")
    }
    if (Validator.isEmpty(data.shift_id)) {
        errors.push("Shift is required")
    }
    if (Validator.isEmpty(data.type)) {
        errors.push("Type is required")
    }
    if (Validator.isEmpty(data.driver_id)) {
        errors.push("Driver is required")
    }
    if (data.type != "DELIVERY") {
        if (Validator.isEmpty(data.vehicle_id)) {
            errors.push("Vehicle is required")
        }
    }
    return {
        errors,
        isValid: isEmpty(errors)
    };
};

exports.ValidateStockLimitInput = data => {
    let errors = []

    if(typeof data.shift_id === "undefined") data.shift_id = ""
    // if(typeof data.product_id === "undefined") data.product_id = ""
    // if(typeof data.suburb_id === "undefined") data.suburb_id = ""
    if(typeof data.limit === "undefined") data.limit = ""

    if(Validator.isEmpty(data.shift_id))
        errors.push("Shift is required")

    // if(Validator.isEmpty(data.suburb_id))
    //     errors.push("Suburb is required")

    // if(Validator.isEmpty(data.product_id))
    //     errors.push("Product is required")

    if(Validator.isEmpty(data.limit))
        errors.push("Limit is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}