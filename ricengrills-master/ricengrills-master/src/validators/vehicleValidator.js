const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.validateRefillerVehicleInputs = data => {
    let errors = [];
    if (typeof data.registration_number === "undefined") data.registration_number = "";
    if (typeof data.insurance_validity === "undefined") data.insurance_validity = "";

    if (Validator.isEmpty(data.registration_number)) {
        errors.push("Registration number is required")
    }

    if (Validator.isEmpty(data.insurance_validity)) {
        errors.push("Insurance validity is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};


exports.validateRefillerDriverInputs = data => {
    let errors = [];
    if (typeof data.address === "undefined") data.address = "";
    if (typeof data.email === "undefined") data.email = "";
    if (typeof data.license_expiry === "undefined") data.license_expiry = "";
    if (typeof data.license_number === "undefined") data.license_number = "";
    if (typeof data.mobile === "undefined") data.mobile = "";
    if (typeof data.name === "undefined") data.name = "";
    // if (typeof data.type === "undefined") data.type = "";

    if (Validator.isEmpty(data.name)) {
        errors.push("Driver name is required")
    }
    if (Validator.isEmpty(data.email)) {
        errors.push("Driver email is required")
    } else {
        if (!Validator.isEmail(data.email)) {
            errors.push("Driver email is invalid")
        }
    }
    if (Validator.isEmpty(data.license_expiry)) {
        errors.push("Driver license expiry date is required")
    }
    if (Validator.isEmpty(data.license_number)) {
        errors.push("Driver license number is required")
    }
    if (Validator.isEmpty(data.mobile)) {
        errors.push("Driver mobile number is required")
    }
    // if (Validator.isEmpty(data.type)) {
    //     errors.push("Driver type is required")
    // }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};

exports.validateVehicleChangeInputs = data => {
    let errors = [];
    if (typeof data.vehicle === "undefined") data.vehicle = "";
    if (typeof data.driver === "undefined") data.driver = "";

    if (Validator.isEmpty(data.vehicle)) {
        errors.push("Vehicle is required")
    }
    if (Validator.isEmpty(data.driver)) {
        errors.push("Driver is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};

exports.ValidateDriverApproveInput = data => {
    let errors = []

    if(typeof data.driver === "undefined") data.driver = ""
    if(Validator.isEmpty(data.driver))
        errors.push("Sorry something went wrong")
    
    return {
        errors, 
        isValid: isEmpty(errors)
    }
}

exports.ValidateDriverRejectionInput = data => {
    let errors = []

    if(typeof data.driver === "undefined") data.driver = ""
    if(typeof data.admin_review === "undefined") data.admin_review = ""

    if(Validator.isEmpty(data.driver))
        errors.push("driver is required")

    if(Validator.isEmpty(data.admin_review))
        errors.push("Admin review is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}