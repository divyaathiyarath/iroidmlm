const Validator = require('validator')
const isEmpty = require('../is-empty')


exports.validateUpdateProfileInputs = data => {
    let errors = [];
    if (typeof data.email === "undefined") data.email = "";
    if (typeof data.name === "undefined") data.name = "";

    if (Validator.isEmpty(data.email)) {
        errors.push("Email ID is required")
    }

    if (Validator.isEmpty(data.name)) {
        errors.push("Name is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};

exports.validatePasswordUpdateInputs = data => {
    let errors = [];
    if(typeof data.password === 'undefined') data.password = ""
    if(typeof data.cpassword === 'undefined') data.cpassword = ""

    if(Validator.isEmpty(data.password))
        errors.push("Password is required")
    if(Validator.isEmpty(data.cpassword))
        errors.push("Confirm password is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateForgotPasswordInput = data => {
    let errors = [];
    if(typeof data.email === 'undefined') data.email = ""

    if(Validator.isEmpty(data.email)) 
        errors.push("Email is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateForgotUpdatePassword = data => {
    let errors = [];
    if(typeof data.password === 'undefined') data.password = ""
    if(typeof data.cpassword === 'undefined') data.cpassword = ""
    if(typeof data.token === 'undefined') data.token = ""

    if(Validator.isEmpty(data.password))
        errors.push("Password is required")
    if(Validator.isEmpty(data.cpassword))
        errors.push("Confirm password is required")
    if(Validator.isEmpty(data.token))
        errors.push("Sorry something went wrong!. Please try again with a new magic link")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}