const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.validateCompanyInputs = data => {
    let errors = [];
    if (typeof data.name === "undefined") data.name = "";
    if (typeof data.email === "undefined") data.email = "";
    if (typeof data.mobile === "undefined") data.mobile = "";
    if (typeof data.address_line1 === "undefined") data.address_line1 = "";
    if (typeof data.lat === "undefined") data.lat = "";
    if (typeof data.lng === "undefined") data.lng = "";

    if (Validator.isEmpty(data.name)) {
        errors.push("Company name is required")
    }
    if (!Validator.isEmpty(data.email)) {
        if (!Validator.isEmail(data.email)) {
            errors.push("Email is not valid")
        }
    }else{
        errors.push("Email is required")
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