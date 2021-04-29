const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.validateProductsInputs = data => {
    let errors = [];
    if (typeof data.name === "undefined") data.name = "";
    if (typeof data.type === "undefined") data.type = "";
    if (typeof data.price === "undefined") data.price = "";

    if (Validator.isEmpty(data.name)) {
        errors.push("Product Name is required")
    }

    if (Validator.isEmpty(data.type)) {
        errors.push("Product type is required")
    } else if(data.type == 'FOOD') {
        if(typeof data.is_veg === "undefined") data.is_veg = "";
        if(Validator.isEmpty(data.is_veg)) errors.push("Food category is required")
    }
    
    if (Validator.isEmpty(data.price)) {
        errors.push("Product price is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
};