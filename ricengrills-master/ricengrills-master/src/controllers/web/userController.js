const mongoose = require("mongoose");
const User = mongoose.model("users");
const Address = mongoose.model("addresses");
const Suburb = mongoose.model("suburbs");
const Booking = mongoose.model("bookings");
const Company = mongoose.model("companies");
let ObjectId = mongoose.Types.ObjectId;
const { ValidateUserSignUpInputs } = require("../../validators/usersValidator");
const {
  ValidateUserAddLocationWeb,
} = require("../../validators/usersLocationValidator");
const { sendUserSignInSms } = require("../../jobs/sendSms");
const { trimMobile } = require("../../utils/general");
const { render } = require("ejs");

exports.getRndInteger = (min, max) => {
  return Math.floor(Math.random() * (max - min)) + min;
};

exports.logout = async (req, res) => {
  req.session._id = null;
  req.session.email = null;
  req.session.mobile = null;
  req.session.role = null;
  return res.redirect(res.locals.app_url + "/home");
};

exports.orders = async (req, res) => {
  return res.render("web/orders");
};

exports.profile = async (req, res) => {
  return res.render("web/profile");
};

exports.checkEmailExists = async (email, id) => {
  let query = {
    delete_status: false,
    email,
  };
  if (id != null) {
    query._id = {
      $ne: id,
    };
  }
  return await User.countDocuments(query);
};

// check mobile exists
exports.checkMobileExists = async (mobile, id) => {
  mobile = trimMobile(mobile);
  let query = {
    delete_status: false,
    mobile,
  };
  if (id != null) {
    query._id = {
      $ne: id,
    };
  }
  return await User.countDocuments(query);
};

exports.update = async (req, res) => {
  const { errors, isValid } = ValidateUserSignUpInputs(req.body);
  if (!isValid) {
    return res.json({
      status: false,
      message: errors[0],
    });
  }
  try {
    let { name, email, mobile, password, confirm_password, current_password } = req.body;
    mobile = trimMobile(mobile);
    if (await this.checkEmailExists(email, req.session._id)) {
      return res.json({
        status: false,
        message: "Email already registered with us",
      });
    }
    if (await this.checkMobileExists(mobile, req.session._id)) {
      return res.json({
        status: false,
        message: "Mobile number already registered with us",
      });
    }

    let user = await User.findOne({ _id: req.session._id });

    if (current_password) {
      if (!password) {
        return res.json({
          status: false,
          message: "New password is required",
        });
      } else if (password != confirm_password) {
        return res.json({
          status: false,
          message: "New password and confirm password should be the same",
        });
      }
      if (!user.validatePassword(current_password)) {
        return res.json({
          status: false,
          message: "Current password is incorrect",
        });
      }
      user.setPassword(password)
    }

    if (user) {
      user.name = name;
      user.mobile = mobile;
      user.email = email;
      await user.save();

      req.session._id = user._id;
      req.session.name = user.name;
      req.session.image = user.profile_pic;
      req.session.role = "user";
      return res.json({
        status: true,
        message: "Profile updated",
      });
    } else {
      return res.json({
        status: false,
        message: "Sorry something went wrong",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

// Check user location with suburbs
exports.userLocationVerify = async (lat, lng, suburb) => {
  if (!suburb) {
    return false
  }
  let distances = await Suburb.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [parseFloat(lng), parseFloat(lat)],
        },
        key: "location",
        spherical: true,
        distanceField: "distance",
        distanceMultiplier: 0.001,
        query: {
          delete_status: false,
        },
      },
    },
    {
      $addFields: {
        isokey: {
          $cmp: ["$radius", "$distance"],
        },
      },
    },
    {
      $match: {
        _id: ObjectId(suburb),
        isokey: {
          $gte: 0,
        },
      },
    },
  ]);
  if (distances.length > 0) {
    return true;
  } else {
    return false;
  }
};

exports.addresses = async (req, res) => {
  let suburbs = await Suburb.find({ delete_status: false });
  let addresses = await Address.aggregate([
    {
      $match: {
        delete_status: false,
        user_id: ObjectId(req.session._id),
      },
    },
  ]);
  return res.render("web/addresses", {
    suburbs,
    addresses,
  });
};

exports.addAddress = async (req, res) => {
  try {
    const { errors, isValid } = ValidateUserAddLocationWeb(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let {
      _id,
      address_line1,
      lat,
      lng,
      house_flat_no,
      appartment,
      landmark,
      to_reach,
      contact_person,
      address_type,
      suburb,
    } = req.body;

    let location_nearby = await this.userLocationVerify(lat, lng, suburb)
    if (!location_nearby) {
      return res.json({
        status: false,
        errors: ["Sorry, please pick address near your selected suburb rather than <b>" + address_line1 + "</b>"],
      });
    }

    if (_id) {
      user_location = await Address.findOne({
        _id,
        user_id: req.session._id,
      });
      user_location.updated_at = Date.now();
    } else {
      user_location = new Address();
      user_location.created_at = Date.now();
      user_location.active_location = true;
    }

    user_location.address_line1 = address_line1;
    user_location.location = {
      type: "Point",
      coordinates: [lng, lat],
    };

    user_location.suburb_id = suburb;
    user_location.house_flat_no = house_flat_no;
    user_location.appartment = appartment;
    user_location.landmark = landmark;
    user_location.to_reach = to_reach;
    user_location.contact_person = contact_person;
    user_location.address_type = address_type;
    user_location.user_id = req.session._id;
    await user_location.save();
    await Address.updateMany(
      {
        _id: {
          $ne: user_location._id,
        },
        user_id: ObjectId(req.session._id),
      },
      {
        $set: {
          active_location: false,
        },
      }
    );
    return res.json({
      status: true,
      message: "Location has been updated successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    let { address_id } = req.body;
    await Address.updateOne(
      {
        _id: ObjectId(address_id),
        user_id: ObjectId(req.session._id),
      },
      {
        $set: {
          active_location: false,
          delete_status: true,
        },
      }
    );
    await Address.updateOne(
      {
        _id: {
          $ne: ObjectId(address_id),
        },
        user_id: ObjectId(req.session._id),
        delete_status: false,
      },
      {
        $set: {
          active_location: true,
        },
      }
    );
    return res.json({
      status: true,
      message: "Location has been deleted successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.addressDetails = async (req, res) => {
  try {
    let { address_id } = req.query;
    console.log({ address_id });
    if (!address_id) {
      return res.json({
        status: false,
        message: "No address found",
      });
    }
    let address = await Address.findOne({
      _id: ObjectId(address_id),
    });
    if (address) {
      return res.json({
        status: true,
        address,
      });
    } else {
      return res.json({
        status: false,
        message: "No address found",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.trackDriver = async (req, res) => {
  let { booking_id } = req.query

  if (!booking_id) {
    return res.redirect(res.locals.app_url + "/user")
  }

  let booking = await Booking.findOne({ _id: ObjectId(booking_id) }).populate('address_id').populate('driver_id')

  let { address_id: address, driver_id: driver } = booking

  let mylocation = {}
  let driverlocation = {}
  let driver_name = ""
  let driver_id = ""

  if (address) { //get my location
    let { location } = address
    if (location) {
      let { coordinates } = location
      if (coordinates) {
        mylocation = {
          lat: coordinates[1],
          lng: coordinates[0]
        }
      }
    }
  }

  if (driver) {//get driver location
    let { location, name, _id } = driver
    driver_id = _id
    if (name) {
      driver_name = name
    }
    if (location) {
      let { coordinates } = location
      if (coordinates) {
        driverlocation = {
          lat: coordinates[1],
          lng: coordinates[0]
        }
      }
    }
  }

  if (!driverlocation) {
    return res.redirect(res.locals.app_url + "/user")
  }

  return res.render("web/trackdriver.ejs", { mylocation, driverlocation, driver_name, driver_id })
}

exports.getcompanydetails = async (req, res) => {
  let { company_id } = req.query
  let company = await Company.findOne({ _id: ObjectId(company_id) })
  if (company) {
    let address = await Address.findOne({ company_id: ObjectId(company._id) })
    return res.json({
      status: true,
      address
    })
  } else {
    return res.json({
      status: false
    })
  }
}
