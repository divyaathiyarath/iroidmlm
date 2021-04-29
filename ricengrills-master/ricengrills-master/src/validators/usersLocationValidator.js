const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.ValidateUserAddLocation = data => {
    let errors = [];
    if (typeof data.location_name === "undefined") data.location_name = "";
    if (typeof data.lat === "undefined") data.lat = "";
    if (typeof data.lng === "undefined") data.lng = "";
    // if (typeof data.house_flat_no === "undefined") data.house_flat_no = "";
    // if (typeof data.appartment === "undefined") data.appartment = "";
    if (typeof data.suburb === "undefined") data.suburb = "";
    // if (typeof data.pincode === "undefined") data.pincode = ""

    if (Validator.isEmpty(data.location_name)) {
        errors.push("Location name is required")
    }
    if (Validator.isEmpty(data.lat)) {
        errors.push("Latitude is required")
    }
    if (Validator.isEmpty(data.lng)) {
        errors.push("Longitude is required")
    }
    // if (Validator.isEmpty(data.house_flat_no)) {
    //     errors.push("House / Flat number is required")
    // }
    // if (Validator.isEmpty(data.appartment)) {
    //     errors.push("Buliding / Appartment name is required")
    // }
    if (Validator.isEmpty(data.suburb)) {
        errors.push("Suburb is required")
    }

    // if(Validator.isEmpty(data.pincode)) {
    //     errors.push("Pin code is required")
    // }

    return {
        errors,
        isValid: isEmpty(errors)
    };
}

exports.ValidateUserAddLocationWeb = data => {
    let errors = [];
    if (typeof data.address_line1 === "undefined") data.address_line1 = "";
    if (typeof data.lat === "undefined") data.lat = "";
    if (typeof data.lng === "undefined") data.lng = "";
    // if (typeof data.house_flat_no === "undefined") data.house_flat_no = "";
    // if (typeof data.appartment === "undefined") data.appartment = "";
    if (typeof data.suburb === "undefined") data.suburb = "";

    if (Validator.isEmpty(data.address_line1)) {
        errors.push("Location name is required")
    }
    if (Validator.isEmpty(data.lat)) {
        errors.push("Latitude is required")
    }
    if (Validator.isEmpty(data.lng)) {
        errors.push("Longitude is required")
    }
    // if (Validator.isEmpty(data.house_flat_no)) {
    //     errors.push("House / Flat number is required")
    // }
    // if (Validator.isEmpty(data.appartment)) {
    //     errors.push("Buliding / Appartment name is required")
    // }
    if (Validator.isEmpty(data.suburb)) {
        errors.push("Suburb is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
}