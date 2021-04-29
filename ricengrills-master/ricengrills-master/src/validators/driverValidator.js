const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.ValidateDriverSignUpInputs = (data) => {
    let errors = [];
    if (typeof data.name === "undefined") data.name = "";
    if (typeof data.email === "undefined") data.email = "";
    if (typeof data.mobile === "undefined") data.mobile = "";

    if (Validator.isEmpty(data.name)) {
        errors.push("Name is required")
    }

    if (Validator.isEmpty(data.email)) {
        errors.push("Email is required")
    }

    if(!Validator.isEmpty(data.email)) {
        if(!Validator.isEmail(data.email))
            errors.push("Invalid email")
    }

    if (Validator.isEmpty(data.mobile)) {
        errors.push("Mobile number is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
}

exports.ValidateDriverResendOtpInputs = data => {
    let errors = []
    if(typeof data.mobile === "undefined") data.mobile == ''
    
    if(Validator.isEmpty(data.mobile))
        errors.push("Mobile number is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateDriverVerifyOtp = data => {
    let errors = []

    if(typeof data.mobile === "undefined") data.mobile = ""
    if(typeof data.otp === "undefined") data.otp = ""

    if(Validator.isEmpty(data.mobile)) 
        errors.push("Mobile number is required")
    if(Validator.isEmpty(data.otp))
        errors.push("OTP is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateDriverBasicDetails = data => {
    let errors = []

    if(typeof data.address === "undefined") data.address = ""
    if(typeof data.age_confirm === "undefined") data.age_confirm = ""
    if(typeof data.has_car === "undefined") data.has_car = ""
    if(typeof data.registration_number === "undefined") data.registration_number = ""
    if(typeof data.abn_number === "undefined") data.abn_number = ""

    if(Validator.isEmpty(data.address))
        errors.push("Address is required")
    
    if(Validator.isEmpty(data.age_confirm))
        errors.push("Age confirmation is required")

    if(Validator.isEmpty(data.has_car))
        errors.push("Has car is required")

    if(Validator.isEmpty(data.registration_number))
        errors.push("Registration number is required")

    if(Validator.isEmpty(data.abn_number))
        errors.push("ABN number is required")
        
    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateDriverExtraDetails = data => {
    let errors = []
    
    if(typeof data.license_expiry === "undefined") data.license_expiry = ""
    if(typeof data.insurance_validity === "undefined") data.insurance_validity = ""
    if(typeof data.license_number === "undefined") data.license_number = ""

    if(Validator.isEmpty(data.license_expiry))
        errors.push("License expiry date is required")
    if(Validator.isEmpty(data.insurance_validity))
        errors.push("Insurance validity date is required")
    if(Validator.isEmpty(data.license_number))
        errors.push("License number is required")
    
    return {
        errors,
        isValid: isEmpty(errors) 
    }
}

exports.ValidateDriverGenerateOTP = data => {
    let errors = []

    if(typeof data.mobile === "undefined") data.mobile = ""

    if(Validator.isEmpty(data.mobile)) {
        errors.push("Mobile number is required")
    }

    return {
        errors, 
        isValid: isEmpty(errors)
    }
}

exports.ValidateDriverLocationInput = data => {
    let errors = []
    
    if(typeof data.lat === "undefined") data.lat = ""
    if(typeof data.lng === "undefined") data.lng = ""

    if(Validator.isEmpty(data.lat))
        errors.push("Latitude is required")

    if(Validator.isEmpty(data.lng))
        errors.push("Longitude is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateDriverStartService = data => {
    let errors = []

    if(typeof data.lat === "undefined") data.lat = ""
    if(typeof data.lng === "undefined") data.lng = ""
    if(typeof data.shift_id === "undefined") data.shift_id = ""

    if(Validator.isEmpty(data.lat))
        errors.push("Latitude is required")

    if(Validator.isEmpty(data.lng))
        errors.push("Longitude is required")

    // if(Validator.isEmpty(data.shift_id))
    //     errors.push("Shift id is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateDriverAlerAdmin = data => {
    let errors = []

    if(typeof data.reason === "undefined") data.reason = ""
    if(typeof data.lat === "undefined") data.lat = ""
    if(typeof data.lng === "undefined") data.lng = ""

    if(Validator.isEmpty(data.reason)) 
        errors.push("Reason is required")

    if(Validator.isEmpty(data.lat))
        errors.push("Latitude is required")

    if(Validator.isEmpty(data.lng))
        errors.push("Longitude is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateDriverDeliverOrder = data => {
    let errors = []

    if(typeof data._id === "undefined")
        data._id = ""

    if(typeof data.delivered_as === "undefined") data.delivered_as = ""

    if(Validator.isEmpty(data.delivered_as)) {
        errors.push("Choose delivered as")
    }

    if(Validator.isEmpty(data._id))
        errors.push("Booking id is required")

    return {
        errors, 
        isValid: isEmpty(errors)
    }
}

exports.ValidateDriverFirebaseToken = data => {
    let errors = []

    if(typeof data.device_token === "undefined") data.device_token = ""
    if(Validator.isEmpty(data.device_token)) {
        errors.push("Device token is required")
    }
    return {
        errors, 
        isValid: isEmpty(errors)
    }
}

exports.ValidateDriverTransferRequest = data => {
    let errors = [];

    if(typeof data.from_driver === "undefined") data.from_driver = ""
    if(typeof data.to_driver === "undefined") data.to_driver = ""

    if(Validator.isEmpty(data.from_driver))
        errors.push("From driver is required")

    if(Validator.isEmpty(data.to_driver))
        errors.push("To driver is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateDriverRefill = data => {
    let errors = []

    if(typeof data.driver === "undefined") data.driver = ""

    if(Validator.isEmpty(data.driver))
        errors.push("Driver is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateCollectionPointRefill = data => {
    let errors = []
    if(typeof data.collection_point === "undefined") data.collection_point = ""

    if(Validator.isEmpty(data.collection_point))
        errors.push("Collection point is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}