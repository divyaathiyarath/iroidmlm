const Validator = require("validator");
const isEmpty = require("./is-empty");

exports.ValidateUserSignUpInputs = (data) => {
    let errors = [];
    if (typeof data.name === "undefined") data.name = "";
    if (typeof data.email === "undefined") data.email = "";
    if (typeof data.mobile === "undefined") data.mobile = "";
    if (typeof data.password === "undefined") data.password = "";

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

    // if (Validator.isEmpty(data.password)) {
    //     errors.push("Password is required")
    // }

    return {
        errors,
        isValid: isEmpty(errors)
    };
}

exports.ValidateUserSignupResendOtpInputs = data => {
    let errors = [];
    if (typeof data.mobile === "undefined") data.mobile = "";

    if (Validator.isEmpty(data.mobile)) {
        errors.push("Mobile number is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
}

exports.ValidateUserSignUpVerifyOtpInputs = data => {
    let errors = [];
    if (typeof data.mobile === "undefined") data.mobile = "";
    if (typeof data.otp === "undefined") data.otp = "";

    if (Validator.isEmpty(data.mobile)) {
        errors.push("Mobile number is required")
    }
    if (Validator.isEmpty(data.otp)) {
        errors.push("OTP is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
}

exports.ValidateUserSignInVerifyOtpInputs = data => {
    let errors = [];
    if (typeof data.mobile === "undefined") data.mobile = "";
    if (typeof data.otp === "undefined") data.otp = "";

    if (Validator.isEmpty(data.mobile)) {
        errors.push("Mobile number is required")
    }
    if (Validator.isEmpty(data.otp)) {
        errors.push("OTP is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    };
}

exports.ValidateUserSignInInputs = data => {
    let errors = [];
    if(typeof data.mobile === "undefined") data.mobile  = "";

    if(Validator.isEmpty(data.mobile))
        errors.push("Mobile number is required")
    
    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserCreditsInput = data => {
    let errors = []
    if(typeof data.amount === "undefined") data.amount = ''
    if(typeof data.transaction_id === "undefined") data.transaction_id = ""

    if(Validator.isEmpty(data.amount)) {
        errors.push("Credit is required")
    } 
    // else {
    //     if(!Validator.isInt(data.amount, {min: 1})) {
    //         errors.push("Minimum value should be '1'")
    //     }
    // }

    if(Validator.isEmpty(data.transaction_id)){
        errors.push("Transaction id is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserCredit = data => {
    let errors = []
    if(typeof data.food === "undefined") data.food = ''
    if(typeof data.accessories === "undefined") data.accessories = ''

    if(Validator.isEmpty(data.food)) {
        errors.push("Food credit is required")
    } else {
        if(!Validator.isInt(data.food, {min: 1})) {
            errors.push("Minimum value should be '1'")
        }
    }

    if(Validator.isEmpty(data.accessories)) {
        errors.push("Accessories credit is required")
    }

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserScheduleBookingInput = data => {
    let errors = []
    
    if(typeof data.delivery_type === "undefined") data.delivery_type = ""

    if(Validator.isEmpty(data.delivery_type)) {
        errors.push("Delivery type is required")
    } else {
        if(data.delivery_type == 'ONLINE') {
            if(typeof data.address_id === "undefined") data.address_id = ""
            if(Validator.isEmpty(data.address_id)) {
                errors.push("Address is required")
            }
        } else if (data.delivery_type == 'COLLECTIONPOINT') {
            if(typeof data.collectionpoint_id === "undefined") data.collectionpoint_id = ""
            if(Validator.isEmpty(data.collectionpoint_id)) {
                errors.push("Collection point is required")
            }
        }
    }

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserSaveScheduleCart = data => {
    let errors = []
    if(typeof data.delivery_type === "undefined") data.delivery_type = ""
    if(typeof data.scheduled_date === "undefined") data.scheduled_date = ""
    if(typeof data.shift_id === "undefined") data.shift_id = ""
    if(typeof data.product_id === "undefined") data.product_id = ""
    if(typeof data.operation === "undefined") data.operation = ""
    if(typeof data.price === "undefined") data.price = ""

    if(Validator.isEmpty(data.delivery_type)) {
        errors.push("Delivery type is required")
    } else {
        if(data.delivery_type == 'ONLINE') {
            if(typeof data.address_id === "undefined") data.address_id = ""
            if(Validator.isEmpty(data.address_id)) {
                errors.push("Address is required")
            }
        } else if (data.delivery_type == 'COLLECTIONPOINT') {
            if(typeof data.collectionpoint_id === "undefined") data.collectionpoint_id = ""
            if(Validator.isEmpty(data.collectionpoint_id)) {
                errors.push("Collection point is required")
            }
        }
    }

    if(Validator.isEmpty(data.scheduled_date))
        errors.push("Scheduled date is required")
    
    if(Validator.isEmpty(data.shift_id))
        errors.push("Shift is required")

    if(Validator.isEmpty(data.product_id))
        errors.push("Product is required")

    if(Validator.isEmpty(data.operation)) {
        errors.push("Operation is required")
    }

    if(Validator.isEmpty(data.price))
        errors.push("Price is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserScheduleBookingConfirm = data => {
    let errors = []
    
    if(typeof data.delivery_type === "undefined") data.delivery_type = ""
    if(typeof data.shift_id === "undefined") data.shift_id = ""
    if(typeof data.credit_used === "undefined") data.credit_used = ""
    if(typeof data.transaction_id === "undefined") data.transaction_id = ""

    if(Validator.isEmpty(data.delivery_type)) {
        errors.push("Delivery type is required")
    } else {
        if(data.delivery_type == "ONLINE") {
            if(typeof data.address_id === "undefined") data.address_id = ""
            if(Validator.isEmpty(data.address_id)) {
                errors.push("Address is required")
            }
        } else {
            if(typeof data.collectionpoint_id === "undefined") data.collectionpoint_id = ""
            if(Validator.isEmpty(data.collectionpoint_id)) {
                errors.push("Collection point is required")
            }
        }
    }

    if(Validator.isEmpty(data.shift_id)) {
        errors.push("Shift is required")
    }

    if(Validator.isEmpty(data.credit_used)) {
        errors.push("Credit used is required")
    }

    if(!Validator.isEmpty(data.transaction_id)) {
        if(typeof data.amount === "undefined") {
            data.amount = ""
        }
        if(Validator.isEmpty(data.amount)) {
            errors.push("Amount is required")
        }
    }
    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserScheduledBookingUpdate = data => {
    let errors = []
    if(typeof data._id === "undefined") data._id = ""
    if(typeof data.shift_id === "undefined") data.shift_id = ""
    if(typeof data.delivery_type === "undefined") data.delivery_type = ""

    if(Validator.isEmpty(data.shift_id)) {
        errors.push("Shift is required")
    }
    if(Validator.isEmpty(data.delivery_type)) {
        errors.push("Delivery type is required")
    } else {
        if(data.delivery_type == 'ONLINE') {
            if(typeof data.address_id === "undefined") data.address_id = ""
            if(Validator.isEmpty(data.address_id)) {
                errors.push("Address is required")
            }
        } else {
            if(typeof data.collectionpoint_id === "undefined") data.collectionpoint_id = ""
            if(Validator.isEmpty(data.collectionpoint_id)) {
                errors.push("Collection point is required")
            }
        }
    }

    if(Validator.isEmpty(data._id)) {
        errors.push("Id is required")
    }
    
    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserScheduledCartList = data => {
    let errors = []

    if(typeof data.shift_id === "undefined") data.shift_id = ""
    if(typeof data.delivery_type === "undefined") data.delivery_type = ""

    if(Validator.isEmpty(data.shift_id)) {
        errors.push("Shift is required")
    }
    if(Validator.isEmpty(data.delivery_type)) {
        errors.push("Delivery type is required")
    } else {
        if(data.delivery_type == 'ONLINE') {
            if(typeof data.address_id === "undefined") data.address_id = ""
            if(Validator.isEmpty(data.address_id)) {
                errors.push("Address is required")
            }
        } else {
            if(typeof data.collectionpoint_id === "undefined") data.collectionpoint_id = ""
            if(Validator.isEmpty(data.collectionpoint_id)) {
                errors.push("Collection point is required")
            }
        }
    }
    
    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserRealtimeCart = data => {
    let errors = []
    if(typeof data.actual_price === "undefined") data.actual_price = ""
    if(typeof data.discount_price === "undefined") data.discount_price = ""
    if(typeof data.gst === "undefined") data.gst = ""
    if(typeof data.total_price === "undefined") data.total_price = ""
    if(typeof data.delivery_type === "undefined") data.delivery_type = ""

        
    if(Validator.isEmpty(data.delivery_type)) {
        errors.push("Delivery type is required")
    } else {
        if(data.delivery_type == 'ONLINE') {
            if(typeof data.address_id === "undefined") data.address_id = ""
            if(Validator.isEmpty(data.address_id)) {
                errors.push("Address is required")
            }
        } else {
            if(typeof data.collectionpoint_id === "undefined") data.collectionpoint_id = ""
            if(Validator.isEmpty(data.collectionpoint_id)) {
                errors.push("Collection point is required")
            }
        }
    }

    
    if(Validator.isEmpty(data.actual_price)) {
        errors.push("Actual price is required")
    }
    if(Validator.isEmpty(data.discount_price)) {
        errors.push("Discount price is required")
    }
    if(Validator.isEmpty(data.gst)) {
        errors.push("GST is required")
    }
    if(Validator.isEmpty(data.total_price)) {
        errors.push("Total price is required")
    }
    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserCouponVerify = data => {
    let errors = []

    if(typeof data.delivery_type === "undefined") data.delivery_type = ""
    if(typeof data.coupon === "undefined") data.coupon = ""

    if(Validator.isEmpty(data.delivery_type)) {
        errors.push("Delivery type is required")
    } else {
        if(data.delivery_type == 'ONLINE') {
            if(typeof data.address_id === "undefined") data.address_id = ""
            if(Validator.isEmpty(data.address_id)) {
                errors.push("Address is required")
            }
        } else {
            if(typeof data.collectionpoint_id === "undefined") data.collectionpoint_id = ""
            if(Validator.isEmpty(data.collectionpoint_id)) {
                errors.push("Collection point is required")
            }
        }
    }

    if(Validator.isEmpty(data.coupon))
        errors.push("Coupon is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserRealTimeBookingConfirm = data => {
    let errors = []

    if(typeof data.tmp_booking_id === "undefined") data.tmp_booking_id = ""
    // if(typeof data.transaction_id === "undefined") data.transaction_id = ""
    
    if(Validator.isEmpty(data.tmp_booking_id)) 
        errors.push("Temporary booking id is required")

    // if(Validator.isEmpty(data.transaction_id))
    //     errors.push("Transaction id is required")

    return {
        errors, 
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserCreditConfirm = data => {
    let errors = []

    if(typeof data.transaction_id === "undefined") data.transaction_id = ""
    if(typeof data.tmp_payment_id === "undefined") data.tmp_payment_id = ""

    if(Validator.isEmpty(data.transaction_id))
        errors.push("Transaction id is required")

    if(Validator.isEmpty(data.tmp_payment_id))
        errors.push("Temporary paymrnt id is required")
    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserInputWeb = data => {
    let errors = []
    if(typeof data.mobile === "undefined") data.mobile = ""
    
    if(Validator.isEmpty(data.mobile)) 
        errors.push("Mobile is required")

    return {
        errors, 
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserBulkBooking = data => {
    let errors = []
    if(typeof data.scheduled_date === "undefined") data.scheduled_date = ""
    if(typeof data.scheduled_time === "undefined") data.scheduled_time = ""
    if(typeof data.address === "undefined") data.address = ""
    if(typeof data.contact_person === "undefined") data.contact_person = ""
    if(typeof data.lat === "undefined") data.lat = ""
    if(typeof data.lng === "undefined") data.lng = ""

    if(Validator.isEmpty(data.scheduled_date)) 
        errors.push("Scheduled date is required")

    if(Validator.isEmpty(data.scheduled_time))
        errors.push("Scheduled time is required")

    if(Validator.isEmpty(data.address)) errors.push("Address is required")
    if(Validator.isEmpty(data.contact_person)) errors.push("Contact person is required")
    if(Validator.isEmpty(data.lat)) errors.push("Latitude is required")
    if(Validator.isEmpty(data.lng)) errors.push("Longitude is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserFireBaseToken = data => {
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

exports.ValidateUserAddressActive = data => {
    let errors = []

    if(typeof data._id === "undefined") data._id = ""
    if(Validator.isEmpty(data._id)) errors.push("Address id is required")
    return {
        errors, 
        isValid: isEmpty(errors)
    }
}

exports.ValidateScheduledOrderList = data => {
    let errors = []

    if(typeof data.delivery_type === "undefined") data.delivery_type = ""
    if(Validator.isEmpty(data.delivery_type))
        errors.push("Delivery type is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}

exports.ValidateUserRateBooking = data => {
    let errors = []
    if(typeof data.booking_id === "undefined") data.booking_id = ""
    if(Validator.isEmpty(data.booking_id))
        errors.push("Booking id is required")

    return {
        errors,
        isValid: isEmpty(errors)
    }
}